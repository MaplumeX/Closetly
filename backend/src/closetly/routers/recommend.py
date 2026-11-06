import random
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..deps import CurrentUserDep, DbDep
from ..item_queries import item_load_options, wear_stats
from ..models import Category, Item, ItemStatus, Outfit
from ..recommend import Recommender, band_for, season_for
from ..schemas import BandOut, Occasion, RecommendationOut

router = APIRouter(prefix="/api/recommendation", tags=["recommendation"])


@router.get("", response_model=RecommendationOut)
def recommend(
    user: CurrentUserDep,
    db: DbDep,
    temperature: Annotated[float, Query(ge=-60, le=60)],
    day: Annotated[date, Query(alias="date")],
    occasion: Occasion | None = None,
    seed: int = 0,
    skip: Annotated[list[int] | None, Query()] = None,
    avoid_days: Annotated[int, Query(ge=0, le=60)] = 7,
):
    """temperature：当天体感温度（℃）；date：用户本地日期（决定季节、「最近穿过」的计算）；
    seed：「换一套」时递增；skip：本轮已经展示过的单品 id。"""
    items = db.scalars(
        select(Item).where(Item.user_id == user.id, Item.status == ItemStatus.ACTIVE).options(*item_load_options())
    ).unique().all()
    outfits = db.scalars(
        select(Outfit)
        .where(Outfit.user_id == user.id)
        .options(selectinload(Outfit.items).joinedload(Item.category).joinedload(Category.parent))
    ).unique().all()
    last_worn = {item_id: last for item_id, (_, last) in wear_stats(db, user.id).items()}

    band = band_for(temperature)
    rec = Recommender(
        items=list(items),
        outfits=list(outfits),
        last_worn=last_worn,
        today=day,
        band=band,
        occasion=occasion,
        skip=set(skip or []),
        avoid_days=avoid_days,
        # 同样的输入得到同样的结果，「换一套」靠 seed 变化
        rng=random.Random(f"{user.id}:{day}:{seed}"),
    ).recommend()

    return RecommendationOut(
        source=rec.source,
        outfit_id=rec.outfit.id if rec.outfit else None,
        outfit_name=rec.outfit.name if rec.outfit else None,
        items=rec.briefs(),
        band=BandOut(**band.__dict__),
        season=season_for(day),
        notes=rec.notes,
    )
