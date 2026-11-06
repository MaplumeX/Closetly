"""启动时执行：数据库迁移、创建首个管理员、清理图片。"""

import logging
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, func, make_url, select
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import Session

from .config import Settings
from .images import ImageStore
from .models import Item, User
from .security import hash_password

log = logging.getLogger("closetly")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def run_migrations(database_url: str, backup_dir: Path | None = None) -> None:
    """升级到最新的数据库结构。

    传入 backup_dir 时，如果已有数据库需要迁移，先在该目录备份一份。
    迁移只能向前执行，升级出问题时用这份备份回退到旧版本。
    """
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    cfg.set_main_option("sqlalchemy.url", database_url)
    if backup_dir is not None:
        _backup_before_migration(cfg, database_url, backup_dir)
    command.upgrade(cfg, "head")


def _backup_before_migration(cfg: Config, database_url: str, backup_dir: Path) -> None:
    db_path = make_url(database_url).database
    if not db_path or not Path(db_path).is_file():
        return  # 全新安装，没有可备份的数据

    engine = create_engine(database_url, poolclass=NullPool)
    try:
        with engine.connect() as conn:
            current = MigrationContext.configure(conn).get_current_revision()
    finally:
        engine.dispose()
    head = ScriptDirectory.from_config(cfg).get_current_head()
    if current is None or current == head:
        return

    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    dest = backup_dir / f"closetly-{stamp}-{current}.db"
    # 用 SQLite 的在线备份接口，WAL 中尚未合并的数据也会包含在内
    with closing(sqlite3.connect(db_path)) as src, closing(sqlite3.connect(dest)) as dst:
        src.backup(dst)
    log.info("数据库需要从 %s 迁移到 %s，已备份到 %s", current, head, dest)


def ensure_admin(db: Session, settings: Settings) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    if not (settings.admin_username and settings.admin_password):
        log.warning(
            "数据库中还没有用户。请设置 CLOSETLY_ADMIN_USERNAME 和 CLOSETLY_ADMIN_PASSWORD 后重启。"
        )
        return
    if len(settings.admin_password) < 8:
        raise RuntimeError("CLOSETLY_ADMIN_PASSWORD 至少需要 8 位")
    db.add(
        User(
            username=settings.admin_username,
            password_hash=hash_password(settings.admin_password),
            is_admin=True,
        )
    )
    db.commit()
    log.info("已创建管理员账号 %s", settings.admin_username)


def cleanup_orphan_images(db: Session, store: ImageStore) -> None:
    referenced: dict[int, set[str]] = {}
    for user_id, key in db.execute(select(Item.user_id, Item.image_key)):
        referenced.setdefault(user_id, set()).add(key)
    if removed := store.cleanup_orphans(referenced):
        log.info("已清理 %d 个未被使用的图片文件", removed)
