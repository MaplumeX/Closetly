from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..deps import CurrentUserDep, DbDep
from ..item_queries import load_user_items, sorted_briefs
from ..models import Category, Item, Outfit, WearLog, wear_log_items
from ..schemas import WearLogCreateIn, WearLogOut, WearLogUpdateIn

router = APIRouter(prefix="/api/wear-logs", tags=["wear-logs"])


def _options():
    return (
        selectinload(WearLog.items).joinedload(Item.category).joinedload(Category.parent),
        joinedload(WearLog.outfit),
    )


def _out(log: WearLog) -> WearLogOut:
    return WearLogOut(
        id=log.id,
        worn_on=log.worn_on,
        outfit_id=log.outfit_id,
        outfit_name=log.outfit.name if log.outfit else None,
        notes=log.notes,
        items=sorted_briefs(log.items),
        created_at=log.created_at,
    )


def _get(db: Session, user_id: int, log_id: int) -> WearLog:
    log = db.scalar(select(WearLog).where(WearLog.id == log_id, WearLog.user_id == user_id).options(*_options()))
    if not log:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "记录不存在")
    return log


@router.get("", response_model=list[WearLogOut])
def list_wear_logs(
    user: CurrentUserDep,
    db: DbDep,
    start: date | None = None,
    end: date | None = None,
    outfit_id: int | None = None,
    item_id: int | None = None,
    limit: int = 500,
):
    """按日期倒序。start/end 都是闭区间，日历按月查询时使用。"""
    stmt = select(WearLog).where(WearLog.user_id == user.id).options(*_options())
    if start:
        stmt = stmt.where(WearLog.worn_on >= start)
    if end:
        stmt = stmt.where(WearLog.worn_on <= end)
    if outfit_id is not None:
        stmt = stmt.where(WearLog.outfit_id == outfit_id)
    if item_id is not None:
        stmt = stmt.where(
            WearLog.id.in_(select(wear_log_items.c.wear_log_id).where(wear_log_items.c.item_id == item_id))
        )
    stmt = stmt.order_by(WearLog.worn_on.desc(), WearLog.id.desc()).limit(min(max(limit, 1), 2000))
    return [_out(log) for log in db.scalars(stmt).unique()]


@router.post("", response_model=WearLogOut, status_code=status.HTTP_201_CREATED)
def create_wear_log(body: WearLogCreateIn, user: CurrentUserDep, db: DbDep):
    outfit = None
    if body.outfit_id is not None:
        outfit = db.scalar(select(Outfit).where(Outfit.id == body.outfit_id, Outfit.user_id == user.id))
        if not outfit:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "搭配不存在")

    # 保存单品快照：之后搭配被修改或删除，这条记录不受影响
    if body.item_ids:
        items = load_user_items(db, user.id, body.item_ids)
    elif outfit:
        items = list(outfit.items)
    else:
        items = []
    if not items:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "请至少选择一件衣物")

    log = WearLog(user_id=user.id, worn_on=body.worn_on, outfit_id=body.outfit_id, notes=body.notes)
    log.items = items
    db.add(log)
    db.commit()
    return _out(_get(db, user.id, log.id))


@router.get("/{log_id}", response_model=WearLogOut)
def get_wear_log(log_id: int, user: CurrentUserDep, db: DbDep):
    return _out(_get(db, user.id, log_id))


@router.patch("/{log_id}", response_model=WearLogOut)
def update_wear_log(log_id: int, body: WearLogUpdateIn, user: CurrentUserDep, db: DbDep):
    log = _get(db, user.id, log_id)
    changes = body.model_dump(exclude_unset=True)
    for field in ("worn_on", "item_ids"):
        if field in changes and changes[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{field} 不能为空")
    if "item_ids" in changes:
        log.items = load_user_items(db, user.id, changes.pop("item_ids"))
    for k, v in changes.items():
        setattr(log, k, v)
    db.commit()
    return _out(_get(db, user.id, log_id))


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wear_log(log_id: int, user: CurrentUserDep, db: DbDep):
    db.delete(_get(db, user.id, log_id))
    db.commit()
