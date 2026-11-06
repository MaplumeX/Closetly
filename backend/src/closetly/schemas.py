from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)

from .images import KEY_PATTERN
from .models import ItemStatus, Slot

Username = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=64, pattern=r"^[\w.-]+$")
]
NewPassword = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: NewPassword


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class UserCreateIn(BaseModel):
    username: Username
    password: NewPassword
    is_admin: bool = False


class UserUpdateIn(BaseModel):
    is_admin: bool | None = None
    is_active: bool | None = None


class ResetPasswordIn(BaseModel):
    password: NewPassword


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slot: Slot | None
    children: list["CategoryOut"] = []


# ---------- 衣物 ----------

Season = Literal["spring", "summer", "autumn", "winter"]
Occasion = Literal["commute", "casual", "sport", "formal"]
Color = Literal[
    "black", "white", "gray", "beige", "brown", "red", "pink", "orange",
    "yellow", "green", "blue", "navy", "purple", "multi",
]  # fmt: skip


def _blank_to_none(v: object) -> object:
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def _dedupe(v: list) -> list:
    return list(dict.fromkeys(v))


def OptText(max_length: int):  # noqa: N802
    return Annotated[
        Annotated[str, StringConstraints(max_length=max_length)] | None,
        BeforeValidator(_blank_to_none),
    ]


TagName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
ImageKey = Annotated[str, StringConstraints(pattern=KEY_PATTERN)]
Seasons = Annotated[list[Season], AfterValidator(_dedupe), Field(min_length=1)]
Occasions = Annotated[list[Occasion], AfterValidator(_dedupe)]
Tags = Annotated[list[TagName], AfterValidator(_dedupe), Field(max_length=20)]
Price = Annotated[Decimal, Field(ge=0, le=Decimal("9999999.99"), decimal_places=2)]


class ItemCreateIn(BaseModel):
    category_id: int
    image_key: ImageKey
    seasons: Seasons
    name: OptText(128) = None
    color: Color | None = None
    occasions: Occasions = []
    warmth: Annotated[int, Field(ge=1, le=5)] | None = None
    brand: OptText(128) = None
    price: Price | None = None
    purchase_date: date | None = None
    location: OptText(128) = None
    notes: OptText(2000) = None
    status: ItemStatus = ItemStatus.ACTIVE
    tags: Tags = []


class ItemUpdateIn(BaseModel):
    """部分更新：只修改请求里出现的字段；可空字段传 null 表示清空。"""

    category_id: int | None = None
    image_key: ImageKey | None = None
    seasons: Seasons | None = None
    name: OptText(128) = None
    color: Color | None = None
    occasions: Occasions | None = None
    warmth: Annotated[int, Field(ge=1, le=5)] | None = None
    brand: OptText(128) = None
    price: Price | None = None
    purchase_date: date | None = None
    location: OptText(128) = None
    notes: OptText(2000) = None
    status: ItemStatus | None = None
    tags: Tags | None = None


class ItemOut(BaseModel):
    id: int
    category_id: int
    category_path: str  # 例如「上装 / T恤」
    slot: Slot | None
    image_key: str
    name: str | None
    seasons: list[Season]
    color: Color | None
    occasions: list[Occasion]
    warmth: int | None
    brand: str | None
    price: float | None
    purchase_date: date | None
    location: str | None
    notes: str | None
    status: ItemStatus
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class TagOut(BaseModel):
    name: str
    count: int


class ImageOut(BaseModel):
    key: str
