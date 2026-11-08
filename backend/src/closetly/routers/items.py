from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import exists, func, or_, select, update
from sqlalchemy.orm import Session

from ..deps import CurrentUserDep, DbDep
from ..images import ImageStore
from ..item_queries import color_value, item_load_options, resolve_color, wear_stats
from ..models import CUT_SLOTS, FIT_SLOTS, Item, ItemStatus, Slot, Tag, item_tags
from ..schemas import (
    CUSTOM_COLOR_PREFIX,
    Color,
    Cut,
    Fit,
    ItemCreateIn,
    ItemOut,
    ItemUpdateIn,
    KindOut,
    KindRenameIn,
    Occasion,
    Season,
    TagOut,
)

router = APIRouter(prefix="/api", tags=["items"])


def item_out(item: Item, stats: tuple[int, date] | None = None) -> ItemOut:
    wear_count, last_worn_on = stats or (0, None)
    return ItemOut(
        id=item.id,
        slot=item.slot,
        kind=item.kind,
        image_key=item.image_key,
        name=item.name,
        seasons=item.seasons,
        color=color_value(item),
        occasions=item.occasions,
        warmth=item.warmth,
        fit=item.fit,
        cut=item.cut,
        brand=item.brand,
        price=item.price_cents / 100 if item.price_cents is not None else None,
        purchase_date=item.purchase_date,
        location=item.location,
        notes=item.notes,
        status=item.status,
        tags=sorted(t.name for t in item.tags),
        wear_count=wear_count,
        last_worn_on=last_worn_on,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _item_out_with_stats(db: Session, item: Item) -> ItemOut:
    return item_out(item, wear_stats(db, item.user_id, [item.id]).get(item.id))


def _get_item(db: Session, user_id: int, item_id: int) -> Item:
    item = db.scalar(
        select(Item).where(Item.id == item_id, Item.user_id == user_id).options(*item_load_options())
    )
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "衣物不存在")
    return item


def _json_has_any(column, values: list[str]):
    """JSON 数组列中至少包含 values 里的一个值（SQLite json_each）。"""
    each = func.json_each(column).table_valued("value")
    return exists(select(1).select_from(each).where(each.c.value.in_(values)))


def _resolve_tags(db: Session, user_id: int, names: list[str]) -> list[Tag]:
    if not names:
        return []
    existing = {t.name: t for t in db.scalars(select(Tag).where(Tag.user_id == user_id, Tag.name.in_(names)))}
    tags = []
    for n in names:
        if n not in existing:
            existing[n] = Tag(user_id=user_id, name=n)
            db.add(existing[n])
        tags.append(existing[n])
    return tags


def _check_image(db: Session, store: ImageStore, user_id: int, key: str, item_id: int | None = None) -> None:
    if not store.exists(user_id, key):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "图片不存在，请重新上传")
    # 一张图片只能属于一件衣物，否则删除其中一件会连带删掉另一件的图片
    q = select(Item.id).where(Item.user_id == user_id, Item.image_key == key)
    if item_id is not None:
        q = q.where(Item.id != item_id)
    if db.scalar(q):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "这张图片已被其他衣物使用，请重新上传")


def _clear_inapplicable(fields: dict, slot: Slot) -> None:
    """部位不适用的版型、廓形直接清空，不报错：用户改部位时不该被已隐藏的字段拦住。"""
    if slot not in FIT_SLOTS:
        fields["fit"] = None
    if slot not in CUT_SLOTS:
        fields["cut"] = None


def _to_cents(price: Decimal | None) -> int | None:
    return None if price is None else int(price * 100)


@router.get("/items", response_model=list[ItemOut])
def list_items(
    user: CurrentUserDep,
    db: DbDep,
    q: str | None = None,
    slot: Slot | None = None,
    kind: str | None = None,
    season: Annotated[list[Season] | None, Query()] = None,
    color: Annotated[list[Color] | None, Query()] = None,
    occasion: Annotated[list[Occasion] | None, Query()] = None,
    fit: Annotated[list[Fit] | None, Query()] = None,
    cut: Annotated[list[Cut] | None, Query()] = None,
    item_status: Annotated[list[ItemStatus] | None, Query(alias="status")] = None,
    tag: Annotated[list[str] | None, Query()] = None,
    photo: bool | None = None,
    sort: Literal["created", "updated", "purchase"] = "created",
):
    """多个筛选条件之间是「并且」；同一条件选多个值是「或者」。
    不传 status 时默认隐藏「已淘汰」。photo=false 只看还没有照片的衣物。"""
    stmt = select(Item).where(Item.user_id == user.id).options(*item_load_options())

    if slot is not None:
        stmt = stmt.where(Item.slot == slot)
    if kind:
        stmt = stmt.where(Item.kind == kind)
    if season:
        stmt = stmt.where(_json_has_any(Item.seasons, season))
    if occasion:
        stmt = stmt.where(_json_has_any(Item.occasions, occasion))
    if fit:
        stmt = stmt.where(Item.fit.in_(fit))
    if cut:
        stmt = stmt.where(Item.cut.in_(cut))
    if color:
        presets = [c for c in color if not c.startswith(CUSTOM_COLOR_PREFIX)]
        custom_ids = [int(c.removeprefix(CUSTOM_COLOR_PREFIX)) for c in color if c.startswith(CUSTOM_COLOR_PREFIX)]
        stmt = stmt.where(or_(Item.color.in_(presets), Item.custom_color_id.in_(custom_ids)))
    stmt = stmt.where(Item.status.in_(item_status) if item_status else Item.status != ItemStatus.RETIRED)
    if tag:
        stmt = stmt.where(Item.tags.any(Tag.name.in_(tag)))
    if photo is not None:
        stmt = stmt.where(Item.image_key.is_not(None) if photo else Item.image_key.is_(None))
    if q and (kw := q.strip()):
        like = "%" + kw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(
            or_(*(col.ilike(like, escape="\\") for col in (Item.name, Item.brand, Item.notes, Item.location)))
        )

    order = {
        "created": Item.created_at.desc(),
        "updated": Item.updated_at.desc(),
        "purchase": Item.purchase_date.desc().nulls_last(),
    }[sort]
    items = db.scalars(stmt.order_by(order, Item.id.desc())).unique().all()
    stats = wear_stats(db, user.id)
    return [item_out(i, stats.get(i.id)) for i in items]


@router.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(body: ItemCreateIn, request: Request, user: CurrentUserDep, db: DbDep):
    if body.image_key:
        _check_image(db, request.app.state.image_store, user.id, body.image_key)
    data = body.model_dump(exclude={"tags", "price", "color"})
    _clear_inapplicable(data, body.slot)
    item = Item(
        user_id=user.id, price_cents=_to_cents(body.price), **resolve_color(db, user.id, body.color), **data
    )
    item.tags = _resolve_tags(db, user.id, body.tags)
    db.add(item)
    db.commit()
    return _item_out_with_stats(db, _get_item(db, user.id, item.id))


@router.get("/items/{item_id}", response_model=ItemOut)
def get_item(item_id: int, user: CurrentUserDep, db: DbDep):
    return _item_out_with_stats(db, _get_item(db, user.id, item_id))


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdateIn, request: Request, user: CurrentUserDep, db: DbDep):
    item = _get_item(db, user.id, item_id)
    store: ImageStore = request.app.state.image_store
    changes = body.model_dump(exclude_unset=True)

    # 这几个字段必填，不允许传 null
    for field in ("slot", "seasons", "occasions", "status", "tags"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{field} 不能为空")

    _clear_inapplicable(changes, changes.get("slot", item.slot))

    # 换照片或删除照片（image_key 传 null）后，旧图片文件在提交成功后删除
    old_image = None
    if "image_key" in changes and changes["image_key"] != item.image_key:
        if changes["image_key"]:
            _check_image(db, store, user.id, changes["image_key"], item.id)
        old_image = item.image_key
    if "tags" in changes:
        item.tags = _resolve_tags(db, user.id, changes.pop("tags"))
    if "price" in changes:
        item.price_cents = _to_cents(body.price)
        changes.pop("price")
    if "color" in changes:
        changes.update(resolve_color(db, user.id, changes.pop("color")))
    for k, v in changes.items():
        setattr(item, k, v)
    db.commit()

    if old_image:
        store.delete(user.id, old_image)
    return _item_out_with_stats(db, _get_item(db, user.id, item.id))


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, request: Request, user: CurrentUserDep, db: DbDep):
    item = _get_item(db, user.id, item_id)
    key = item.image_key
    db.delete(item)
    db.commit()
    if key:
        request.app.state.image_store.delete(user.id, key)


@router.get("/tags", response_model=list[TagOut])
def list_tags(user: CurrentUserDep, db: DbDep):
    """当前用户正在使用的标签及其衣物数量，用于筛选和输入联想。"""
    count = func.count(item_tags.c.item_id)
    rows = db.execute(
        select(Tag.name, count)
        .join(item_tags, item_tags.c.tag_id == Tag.id)
        .where(Tag.user_id == user.id)
        .group_by(Tag.id)
        .order_by(count.desc(), Tag.name)
    ).all()
    return [TagOut(name=n, count=c) for n, c in rows]


@router.get("/kinds", response_model=list[KindOut])
def list_kinds(user: CurrentUserDep, db: DbDep):
    """当前用户用过的类型及衣物数量（含已淘汰的衣物），用于输入联想、筛选和管理。"""
    count = func.count(Item.id)
    rows = db.execute(
        select(Item.slot, Item.kind, count)
        .where(Item.user_id == user.id, Item.kind.is_not(None))
        .group_by(Item.slot, Item.kind)
        .order_by(Item.slot, count.desc(), Item.kind)
    ).all()
    order = list(Slot)
    rows = sorted(rows, key=lambda r: order.index(r[0]))  # 按部位的固定顺序，而不是字母顺序
    return [KindOut(slot=s, name=k, count=c) for s, k, c in rows]


@router.patch("/kinds", status_code=status.HTTP_204_NO_CONTENT)
def rename_kind(body: KindRenameIn, user: CurrentUserDep, db: DbDep):
    """重命名、合并或清除一个类型，作用于该部位下所有用这个类型的衣物。"""
    db.execute(
        update(Item)
        .where(Item.user_id == user.id, Item.slot == body.slot, Item.kind == body.name)
        .values(kind=body.new_name, updated_at=Item.updated_at)  # 只是整理类型，不算修改衣物
    )
    db.commit()
