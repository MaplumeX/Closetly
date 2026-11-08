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


class RegisterIn(BaseModel):
    username: Username
    password: NewPassword


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


class AuthConfigOut(BaseModel):
    """未登录也能读取的公开配置，登录页据此决定是否显示注册入口。"""

    registration_open: bool


class SiteSettingsUpdateIn(BaseModel):
    registration_open: bool | None = None


# ---------- 衣物 ----------

Season = Literal["spring", "summer", "autumn", "winter"]
Occasion = Literal["commute", "casual", "sport", "formal"]
Fit = Literal["slim", "regular", "relaxed", "oversized"]
Cut = Literal["straight", "skinny", "tapered", "wide", "flared", "a_line", "pencil", "pleated", "fishtail"]
PresetColor = Literal[
    "black", "white", "gray", "beige", "brown", "red", "pink", "orange",
    "yellow", "green", "blue", "navy", "purple", "multi",
]  # fmt: skip
# 预设色的中文名，自定义颜色不能与之重名，免得色板里出现两个「红」
PRESET_COLOR_LABELS = frozenset(
    ["黑", "白", "灰", "米", "棕", "红", "粉", "橙", "黄", "绿", "蓝", "藏青", "紫", "多色"]
)
CUSTOM_COLOR_PREFIX = "custom:"
# 主色：预设色的值，或 "custom:<id>" 表示当前用户的一个自定义颜色
Color = Annotated[str, StringConstraints(pattern=r"^(" + "|".join(PresetColor.__args__) + r"|custom:\d{1,9})$")]


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


KindName = OptText(32)
TagName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
ImageKey = Annotated[str, StringConstraints(pattern=KEY_PATTERN)]
Seasons = Annotated[list[Season], AfterValidator(_dedupe), Field(min_length=1)]
Occasions = Annotated[list[Occasion], AfterValidator(_dedupe)]
Tags = Annotated[list[TagName], AfterValidator(_dedupe), Field(max_length=20)]
Price = Annotated[Decimal, Field(ge=0, le=Decimal("9999999.99"), decimal_places=2)]


class ItemCreateIn(BaseModel):
    slot: Slot
    kind: KindName = None
    image_key: ImageKey | None = None
    seasons: Seasons
    name: OptText(128) = None
    color: Color | None = None
    occasions: Occasions = []
    warmth: Annotated[int, Field(ge=1, le=5)] | None = None
    fit: Fit | None = None
    cut: Cut | None = None
    brand: OptText(128) = None
    price: Price | None = None
    purchase_date: date | None = None
    location: OptText(128) = None
    notes: OptText(2000) = None
    status: ItemStatus = ItemStatus.ACTIVE
    tags: Tags = []


class ItemUpdateIn(BaseModel):
    """部分更新：只修改请求里出现的字段；可空字段传 null 表示清空。"""

    slot: Slot | None = None
    kind: KindName = None
    image_key: ImageKey | None = None
    seasons: Seasons | None = None
    name: OptText(128) = None
    color: Color | None = None
    occasions: Occasions | None = None
    warmth: Annotated[int, Field(ge=1, le=5)] | None = None
    fit: Fit | None = None
    cut: Cut | None = None
    brand: OptText(128) = None
    price: Price | None = None
    purchase_date: date | None = None
    location: OptText(128) = None
    notes: OptText(2000) = None
    status: ItemStatus | None = None
    tags: Tags | None = None


class ItemOut(BaseModel):
    id: int
    slot: Slot
    kind: str | None
    image_key: str | None
    name: str | None
    seasons: list[Season]
    color: str | None
    occasions: list[Occasion]
    warmth: int | None
    fit: Fit | None
    cut: Cut | None
    brand: str | None
    price: float | None
    purchase_date: date | None
    location: str | None
    notes: str | None
    status: ItemStatus
    tags: list[str]
    wear_count: int
    last_worn_on: date | None
    created_at: datetime
    updated_at: datetime


class TagOut(BaseModel):
    name: str
    count: int


class KindOut(BaseModel):
    slot: Slot
    name: str
    count: int


class KindRenameIn(BaseModel):
    """把某个部位下的一个类型改名；new_name 为空表示清除（衣物只保留部位）。
    改成同部位下已有的类型名，就相当于合并。"""

    slot: Slot
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
    new_name: KindName = None


HexColor = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, pattern=r"^#[0-9a-fA-F]{6}$")
]
ColorName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=16)]


class CustomColorIn(BaseModel):
    name: ColorName
    hex: HexColor


class CustomColorUpdateIn(BaseModel):
    name: ColorName | None = None
    hex: HexColor | None = None


class CustomColorOut(BaseModel):
    id: int
    name: str
    hex: str
    count: int  # 使用这个颜色的衣物数量（含已淘汰）


class ImageOut(BaseModel):
    key: str


# ---------- 搭配与穿着记录 ----------

ItemIds = Annotated[list[int], AfterValidator(_dedupe), Field(max_length=30)]


class ItemBrief(BaseModel):
    """搭配、穿着记录中展示单品用的精简信息。"""

    id: int
    image_key: str | None
    name: str | None
    slot: Slot
    color: str | None
    kind: str | None
    status: ItemStatus
    # 挑选搭配时，前端据此判断其余单品是否合适
    seasons: list[Season]
    occasions: list[Occasion]
    warmth: int | None


class OutfitCreateIn(BaseModel):
    name: OptText(128) = None
    notes: OptText(2000) = None
    item_ids: Annotated[ItemIds, Field(min_length=1)]


class OutfitUpdateIn(BaseModel):
    name: OptText(128) = None
    notes: OptText(2000) = None
    item_ids: Annotated[ItemIds, Field(min_length=1)] | None = None


class OutfitOut(BaseModel):
    id: int
    name: str | None
    notes: str | None
    items: list[ItemBrief]
    # 以下由单品推导，规则见 outfit_profile.py
    seasons: list[Season]  # 每件单品都适合的季节
    occasions: list[Occasion] | None  # None 表示不限（没有单品填写场合）
    warmth_min: int | None
    warmth_max: int | None
    wear_count: int
    last_worn_on: date | None
    created_at: datetime
    updated_at: datetime


class WearLogCreateIn(BaseModel):
    """item_ids 为空且给了 outfit_id 时，复制这套搭配当前的单品。"""

    worn_on: date
    outfit_id: int | None = None
    item_ids: ItemIds = []
    notes: OptText(2000) = None


class WearLogUpdateIn(BaseModel):
    worn_on: date | None = None
    item_ids: Annotated[ItemIds, Field(min_length=1)] | None = None
    notes: OptText(2000) = None


class WearLogOut(BaseModel):
    id: int
    worn_on: date
    outfit_id: int | None
    outfit_name: str | None
    notes: str | None
    items: list[ItemBrief]
    created_at: datetime


# ---------- 今日推荐 ----------


class BandOut(BaseModel):
    label: str
    min_warmth: int
    max_warmth: int
    need_outer: bool


class RecommendationOut(BaseModel):
    source: Literal["outfit", "generated", "empty"]
    outfit_id: int | None
    outfit_name: str | None
    items: list[ItemBrief]
    band: BandOut
    season: Season
    notes: list[str]
