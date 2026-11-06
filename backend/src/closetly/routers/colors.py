from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import CurrentUserDep, DbDep
from ..models import CustomColor, Item
from ..schemas import PRESET_COLOR_LABELS, CustomColorIn, CustomColorOut, CustomColorUpdateIn

router = APIRouter(prefix="/api/colors", tags=["colors"])


def _get(db: Session, user_id: int, color_id: int) -> CustomColor:
    c = db.scalar(select(CustomColor).where(CustomColor.id == color_id, CustomColor.user_id == user_id))
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "颜色不存在")
    return c


def _check_name(db: Session, user_id: int, name: str, color_id: int | None = None) -> None:
    q = select(CustomColor.id).where(CustomColor.user_id == user_id, CustomColor.name == name)
    if color_id is not None:
        q = q.where(CustomColor.id != color_id)
    if name in PRESET_COLOR_LABELS or db.scalar(q):
        raise HTTPException(status.HTTP_409_CONFLICT, f"已经有叫「{name}」的颜色了")


def _out(db: Session, c: CustomColor) -> CustomColorOut:
    count = db.scalar(select(func.count(Item.id)).where(Item.custom_color_id == c.id)) or 0
    return CustomColorOut(id=c.id, name=c.name, hex=c.hex, count=count)


@router.get("", response_model=list[CustomColorOut])
def list_colors(user: CurrentUserDep, db: DbDep):
    """当前用户的自定义颜色，按添加顺序排列，接在预设色后面。"""
    count = func.count(Item.id)
    rows = db.execute(
        select(CustomColor, count)
        .outerjoin(Item, Item.custom_color_id == CustomColor.id)
        .where(CustomColor.user_id == user.id)
        .group_by(CustomColor.id)
        .order_by(CustomColor.created_at, CustomColor.id)
    ).all()
    return [CustomColorOut(id=c.id, name=c.name, hex=c.hex, count=n) for c, n in rows]


@router.post("", response_model=CustomColorOut, status_code=status.HTTP_201_CREATED)
def create_color(body: CustomColorIn, user: CurrentUserDep, db: DbDep):
    _check_name(db, user.id, body.name)
    c = CustomColor(user_id=user.id, name=body.name, hex=body.hex)
    db.add(c)
    db.commit()
    return _out(db, c)


@router.patch("/{color_id}", response_model=CustomColorOut)
def update_color(color_id: int, body: CustomColorUpdateIn, user: CurrentUserDep, db: DbDep):
    c = _get(db, user.id, color_id)
    if body.name is not None:
        _check_name(db, user.id, body.name, c.id)
        c.name = body.name
    if body.hex is not None:
        c.hex = body.hex
    db.commit()
    return _out(db, c)


@router.delete("/{color_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_color(color_id: int, user: CurrentUserDep, db: DbDep):
    """删除颜色，用它的衣物变为未填主色（外键 ON DELETE SET NULL）。"""
    db.delete(_get(db, user.id, color_id))
    db.commit()
