import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow


def _str_enum(cls: type[enum.StrEnum]) -> Enum:
    """按枚举值（而不是成员名）存储，与 API 保持一致。"""
    return Enum(cls, native_enum=False, length=16, values_callable=lambda e: [m.value for m in e])


class ItemStatus(enum.StrEnum):
    ACTIVE = "active"  # 在用
    LAUNDRY = "laundry"  # 送洗
    IDLE = "idle"  # 闲置
    RETIRED = "retired"  # 已淘汰


class Slot(enum.StrEnum):
    """部位：衣物的一级分类，固定不变。推荐时按部位组合搭配。"""

    TOP = "top"
    BOTTOM = "bottom"
    ONEPIECE = "onepiece"
    OUTER = "outer"
    SHOES = "shoes"
    ACCESSORY = "accessory"


SLOT_LABELS = {
    Slot.TOP: "上装",
    Slot.BOTTOM: "下装",
    Slot.ONEPIECE: "连衣裙/连体",
    Slot.OUTER: "外套",
    Slot.SHOES: "鞋",
    Slot.ACCESSORY: "配饰",
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppSetting(Base):
    """全站设置（键值对），由管理员在网页上修改。读写见 site_settings.py。"""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)


class UserSession(Base):
    __tablename__ = "sessions"

    # 存储 token 的 SHA-256，数据库泄露时无法直接拿来登录
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped[User] = relationship()


item_tags = Table(
    "item_tags",
    Base.metadata,
    Column("item_id", ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

# 删除衣物时，自动从搭配和穿着记录中移除
outfit_items = Table(
    "outfit_items",
    Base.metadata,
    Column("outfit_id", ForeignKey("outfits.id", ondelete="CASCADE"), primary_key=True),
    Column("item_id", ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
)

wear_log_items = Table(
    "wear_log_items",
    Base.metadata,
    Column("wear_log_id", ForeignKey("wear_logs.id", ondelete="CASCADE"), primary_key=True),
    Column("item_id", ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(32))


class CustomColor(Base):
    """用户自己添加的颜色，补充预设色板里没有的颜色。"""

    __tablename__ = "custom_colors"
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(16))
    hex: Mapped[str] = mapped_column(String(7))  # #rrggbb，小写
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (Index("ix_items_user_slot_kind", "user_id", "slot", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    slot: Mapped[Slot] = mapped_column(_str_enum(Slot))
    # 类型（二级分类），由用户自由填写，例如「牛仔裤」；同一用户同一部位下的相同文字视为同一类型
    kind: Mapped[str | None] = mapped_column(String(32))
    # 图片文件名前缀，对应 images/<user_id>/<key>.webp 与 <key>_thumb.webp；
    # 照片选填，没有照片时前端按部位、类型和主色画占位剪影
    image_key: Mapped[str | None] = mapped_column(String(64))

    name: Mapped[str | None] = mapped_column(String(128))
    seasons: Mapped[list[str]] = mapped_column(JSON, default=list)  # spring/summer/autumn/winter
    # 主色二选一：预设色（color）或自定义颜色（custom_color_id）。
    # 对外统一成一个 color 字符串，自定义颜色写作 "custom:<id>"
    color: Mapped[str | None] = mapped_column(String(32))
    custom_color_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_colors.id", ondelete="SET NULL"), index=True
    )
    occasions: Mapped[list[str]] = mapped_column(JSON, default=list)
    warmth: Mapped[int | None] = mapped_column(Integer)  # 1–5
    brand: Mapped[str | None] = mapped_column(String(128))
    price_cents: Mapped[int | None] = mapped_column(Integer)  # 以分为单位，避免浮点误差
    purchase_date: Mapped[date | None] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ItemStatus] = mapped_column(
        _str_enum(ItemStatus), default=ItemStatus.ACTIVE
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    tags: Mapped[list[Tag]] = relationship(secondary=item_tags)


class Outfit(Base):
    __tablename__ = "outfits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    items: Mapped[list[Item]] = relationship(secondary=outfit_items)


class WearLog(Base):
    """一条穿着记录。即使来源于某套搭配，也会把当时的单品复制到 items，
    这样搭配被修改或删除后，历史记录依然准确。"""

    __tablename__ = "wear_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    worn_on: Mapped[date] = mapped_column(Date, index=True)
    outfit_id: Mapped[int | None] = mapped_column(ForeignKey("outfits.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    items: Mapped[list[Item]] = relationship(secondary=wear_log_items)
    outfit: Mapped[Outfit | None] = relationship()
