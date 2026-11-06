"""衣物相关的公共查询：精简展示、按用户加载、穿着统计。"""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .models import CustomColor, Item, Slot, WearLog, wear_log_items
from .schemas import CUSTOM_COLOR_PREFIX, ItemBrief

# 展示一套搭配时的单品顺序：从外到内、从上到下
SLOT_ORDER = {Slot.OUTER: 0, Slot.ONEPIECE: 1, Slot.TOP: 2, Slot.BOTTOM: 3, Slot.SHOES: 4, Slot.ACCESSORY: 5}


def item_load_options():
    return (selectinload(Item.tags),)


def item_brief(item: Item) -> ItemBrief:
    return ItemBrief(
        id=item.id, image_key=item.image_key, name=item.name, slot=item.slot, kind=item.kind, status=item.status
    )


def sorted_briefs(items: list[Item]) -> list[ItemBrief]:
    briefs = [item_brief(i) for i in items]
    return sorted(briefs, key=lambda b: (SLOT_ORDER.get(b.slot, 9), b.id))


def load_user_items(db: Session, user_id: int, ids: list[int]) -> list[Item]:
    """按 id 加载当前用户的衣物；有任何一件不存在（或属于别人）就报错。"""
    if not ids:
        return []
    items = db.scalars(
        select(Item).where(Item.user_id == user_id, Item.id.in_(ids)).options(*item_load_options())
    ).unique().all()
    if len(items) != len(set(ids)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "部分衣物不存在，请刷新后重试")
    return list(items)


def wear_stats(db: Session, user_id: int, item_ids: list[int] | None = None) -> dict[int, tuple[int, date]]:
    """{item_id: (穿着次数, 最近一次日期)}；同一天记录多次只算一次。"""
    q = (
        select(
            wear_log_items.c.item_id,
            func.count(func.distinct(WearLog.worn_on)),
            func.max(WearLog.worn_on),
        )
        .join(WearLog, WearLog.id == wear_log_items.c.wear_log_id)
        .where(WearLog.user_id == user_id)
        .group_by(wear_log_items.c.item_id)
    )
    if item_ids is not None:
        q = q.where(wear_log_items.c.item_id.in_(item_ids))
    return {item_id: (count, last) for item_id, count, last in db.execute(q)}


def color_value(item: Item) -> str | None:
    """衣物的主色，对外统一成一个字符串。"""
    if item.custom_color_id is not None:
        return f"{CUSTOM_COLOR_PREFIX}{item.custom_color_id}"
    return item.color


def resolve_color(db: Session, user_id: int, value: str | None) -> dict[str, str | int | None]:
    """把接口里的 color 拆成数据库的两列；自定义颜色必须属于当前用户。"""
    if value is None or not value.startswith(CUSTOM_COLOR_PREFIX):
        return {"color": value, "custom_color_id": None}
    color_id = int(value.removeprefix(CUSTOM_COLOR_PREFIX))
    if not db.scalar(select(CustomColor.id).where(CustomColor.id == color_id, CustomColor.user_id == user_id)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "这个颜色不存在，请刷新后重试")
    return {"color": None, "custom_color_id": color_id}
