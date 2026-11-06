import enum
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
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
    """分类在推荐组合中占据的位置，只设置在一级分类上。"""

    TOP = "top"
    BOTTOM = "bottom"
    ONEPIECE = "onepiece"
    OUTER = "outer"
    SHOES = "shoes"
    ACCESSORY = "accessory"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class UserSession(Base):
    __tablename__ = "sessions"

    # 存储 token 的 SHA-256，数据库泄露时无法直接拿来登录
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped[User] = relationship()


class Category(Base):
    """全局共用的两级分类。"""

    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("parent_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(64))
    slot: Mapped[Slot | None] = mapped_column(_str_enum(Slot))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    children: Mapped[list["Category"]] = relationship(
        back_populates="parent", order_by="Category.sort_order"
    )
    parent: Mapped["Category | None"] = relationship(back_populates="children", remote_side=[id])


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


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    # 图片文件名前缀，对应 images/<user_id>/<key>.webp 与 <key>_thumb.webp
    image_key: Mapped[str] = mapped_column(String(64))

    name: Mapped[str | None] = mapped_column(String(128))
    seasons: Mapped[list[str]] = mapped_column(JSON, default=list)  # spring/summer/autumn/winter
    color: Mapped[str | None] = mapped_column(String(32))
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

    category: Mapped[Category] = relationship()
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
