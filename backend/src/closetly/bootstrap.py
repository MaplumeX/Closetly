"""启动时执行：数据库迁移、创建首个管理员、清理图片。"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import Settings
from .images import ImageStore
from .models import Item, User
from .security import hash_password

log = logging.getLogger("closetly")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def run_migrations(database_url: str) -> None:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(cfg, "head")


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
