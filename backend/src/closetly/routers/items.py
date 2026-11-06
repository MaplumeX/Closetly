from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from ..deps import CurrentUserDep, DbDep
from ..images import ImageStore
from ..item_queries import category_info, item_load_options, wear_stats
from ..models import Category, Item, ItemStatus, Tag, item_tags
from ..schemas import Color, ItemCreateIn, ItemOut, ItemUpdateIn, Occasion, Season, TagOut

router = APIRouter(prefix="/api", tags=["items"])


def item_out(item: Item, stats: tuple[int, date] | None = None) -> ItemOut:
    path, slot = category_info(item)
    wear_count, last_worn_on = stats or (0, None)
    return ItemOut(
        id=item.id,
        category_id=item.category_id,
        category_path=path,
        slot=slot,
        image_key=item.image_key,
        name=item.name,
        seasons=item.seasons,
        color=item.color,
        occasions=item.occasions,
        warmth=item.warmth,
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


def _check_category(db: Session, category_id: int) -> None:
    if not db.get(Category, category_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "分类不存在")


def _check_image(db: Session, store: ImageStore, user_id: int, key: str, item_id: int | None = None) -> None:
    if not store.exists(user_id, key):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "图片不存在，请重新上传")
    # 一张图片只能属于一件衣物，否则删除其中一件会连带删掉另一件的图片
    q = select(Item.id).where(Item.user_id == user_id, Item.image_key == key)
    if item_id is not None:
        q = q.where(Item.id != item_id)
    if db.scalar(q):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "这张图片已被其他衣物使用，请重新上传")


def _to_cents(price: Decimal | None) -> int | None:
    return None if price is None else int(price * 100)


@router.get("/items", response_model=list[ItemOut])
def list_items(
    user: CurrentUserDep,
    db: DbDep,
    q: str | None = None,
    category_id: int | None = None,
    season: Annotated[list[Season] | None, Query()] = None,
    color: Annotated[list[Color] | None, Query()] = None,
    occasion: Annotated[list[Occasion] | None, Query()] = None,
    item_status: Annotated[list[ItemStatus] | None, Query(alias="status")] = None,
    tag: Annotated[list[str] | None, Query()] = None,
    sort: Literal["created", "updated", "purchase"] = "created",
):
    """多个筛选条件之间是「并且」；同一条件选多个值是「或者」。
    不传 status 时默认隐藏「已淘汰」。"""
    stmt = select(Item).where(Item.user_id == user.id).options(*item_load_options())

    if category_id is not None:
        child_ids = select(Category.id).where(Category.parent_id == category_id)
        stmt = stmt.where(or_(Item.category_id == category_id, Item.category_id.in_(child_ids)))
    if season:
        stmt = stmt.where(_json_has_any(Item.seasons, season))
    if occasion:
        stmt = stmt.where(_json_has_any(Item.occasions, occasion))
    if color:
        stmt = stmt.where(Item.color.in_(color))
    stmt = stmt.where(Item.status.in_(item_status) if item_status else Item.status != ItemStatus.RETIRED)
    if tag:
        stmt = stmt.where(Item.tags.any(Tag.name.in_(tag)))
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
    _check_category(db, body.category_id)
    _check_image(db, request.app.state.image_store, user.id, body.image_key)
    data = body.model_dump(exclude={"tags", "price"})
    item = Item(user_id=user.id, price_cents=_to_cents(body.price), **data)
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
    for field in ("category_id", "image_key", "seasons", "occasions", "status", "tags"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{field} 不能为空")

    old_image = None
    if "category_id" in changes:
        _check_category(db, changes["category_id"])
    if "image_key" in changes and changes["image_key"] != item.image_key:
        _check_image(db, store, user.id, changes["image_key"], item.id)
        old_image = item.image_key
    if "tags" in changes:
        item.tags = _resolve_tags(db, user.id, changes.pop("tags"))
    if "price" in changes:
        item.price_cents = _to_cents(body.price)
        changes.pop("price")
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
