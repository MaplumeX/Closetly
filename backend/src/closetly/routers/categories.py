from fastapi import APIRouter
from sqlalchemy import select

from ..deps import CurrentUserDep, DbDep
from ..models import Category
from ..schemas import CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(_: CurrentUserDep, db: DbDep):
    return db.scalars(
        select(Category).where(Category.parent_id.is_(None)).order_by(Category.sort_order)
    ).all()
