"""启动时执行：数据库迁移、预置分类、创建首个管理员。"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import Settings
from .models import Category, Slot, User
from .security import hash_password

log = logging.getLogger("closetly")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

DEFAULT_CATEGORIES: list[tuple[str, Slot, list[str]]] = [
    ("上装", Slot.TOP, ["T恤", "衬衫", "毛衣/针织衫", "卫衣", "背心/吊带", "Polo衫"]),
    ("下装", Slot.BOTTOM, ["牛仔裤", "休闲裤", "西裤", "短裤", "半身裙", "运动裤"]),
    ("连衣裙/连体", Slot.ONEPIECE, ["连衣裙", "连体裤"]),
    ("外套", Slot.OUTER, ["夹克", "风衣", "大衣", "羽绒服", "西装外套", "开衫", "冲锋衣"]),
    ("鞋", Slot.SHOES, ["运动鞋", "休闲鞋", "皮鞋", "靴子", "凉鞋/拖鞋"]),
    ("配饰", Slot.ACCESSORY, ["包", "帽子", "围巾", "腰带", "首饰", "眼镜", "其他"]),
]


def run_migrations(database_url: str) -> None:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(cfg, "head")


def seed_categories(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(Category)):
        return
    for i, (name, slot, children) in enumerate(DEFAULT_CATEGORIES):
        parent = Category(name=name, slot=slot, sort_order=i)
        parent.children = [Category(name=c, sort_order=j) for j, c in enumerate(children)]
        db.add(parent)
    db.commit()
    log.info("已写入预置分类")


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
