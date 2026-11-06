from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..deps import CurrentUserDep, DbDep
from ..item_queries import load_user_items, sorted_briefs
from ..models import Outfit, WearLog, outfit_items
from ..schemas import OutfitCreateIn, OutfitOut, OutfitUpdateIn

router = APIRouter(prefix="/api/outfits", tags=["outfits"])


def _options():
    return (selectinload(Outfit.items),)


def _wear_stats(db: Session, user_id: int, outfit_ids: list[int]) -> dict[int, tuple[int, object]]:
    rows = db.execute(
        select(WearLog.outfit_id, func.count(func.distinct(WearLog.worn_on)), func.max(WearLog.worn_on))
        .where(WearLog.user_id == user_id, WearLog.outfit_id.in_(outfit_ids))
        .group_by(WearLog.outfit_id)
    )
    return {oid: (count, last) for oid, count, last in rows}


def _out(outfit: Outfit, stats: dict) -> OutfitOut:
    count, last = stats.get(outfit.id, (0, None))
    return OutfitOut(
        id=outfit.id,
        name=outfit.name,
        notes=outfit.notes,
        items=sorted_briefs(outfit.items),
        wear_count=count,
        last_worn_on=last,
        created_at=outfit.created_at,
        updated_at=outfit.updated_at,
    )


def _get(db: Session, user_id: int, outfit_id: int) -> Outfit:
    outfit = db.scalar(select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == user_id).options(*_options()))
    if not outfit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "搭配不存在")
    return outfit


def _single(db: Session, outfit: Outfit) -> OutfitOut:
    return _out(outfit, _wear_stats(db, outfit.user_id, [outfit.id]))


@router.get("", response_model=list[OutfitOut])
def list_outfits(user: CurrentUserDep, db: DbDep, item_id: int | None = None):
    """item_id：只返回包含这件衣物的搭配。"""
    stmt = select(Outfit).where(Outfit.user_id == user.id).options(*_options())
    if item_id is not None:
        stmt = stmt.where(
            Outfit.id.in_(select(outfit_items.c.outfit_id).where(outfit_items.c.item_id == item_id))
        )
    outfits = db.scalars(stmt.order_by(Outfit.updated_at.desc(), Outfit.id.desc())).unique().all()
    stats = _wear_stats(db, user.id, [o.id for o in outfits])
    return [_out(o, stats) for o in outfits]


@router.post("", response_model=OutfitOut, status_code=status.HTTP_201_CREATED)
def create_outfit(body: OutfitCreateIn, user: CurrentUserDep, db: DbDep):
    outfit = Outfit(user_id=user.id, name=body.name, notes=body.notes)
    outfit.items = load_user_items(db, user.id, body.item_ids)
    db.add(outfit)
    db.commit()
    return _single(db, _get(db, user.id, outfit.id))


@router.get("/{outfit_id}", response_model=OutfitOut)
def get_outfit(outfit_id: int, user: CurrentUserDep, db: DbDep):
    return _single(db, _get(db, user.id, outfit_id))


@router.patch("/{outfit_id}", response_model=OutfitOut)
def update_outfit(outfit_id: int, body: OutfitUpdateIn, user: CurrentUserDep, db: DbDep):
    outfit = _get(db, user.id, outfit_id)
    changes = body.model_dump(exclude_unset=True)
    if "item_ids" in changes:
        if changes["item_ids"] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "item_ids 不能为空")
        outfit.items = load_user_items(db, user.id, changes.pop("item_ids"))
    for k, v in changes.items():
        setattr(outfit, k, v)
    db.commit()
    return _single(db, _get(db, user.id, outfit_id))


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outfit(outfit_id: int, user: CurrentUserDep, db: DbDep):
    """穿着记录保留（它们保存了当时的单品），只是不再关联到这套搭配。"""
    db.delete(_get(db, user.id, outfit_id))
    db.commit()


