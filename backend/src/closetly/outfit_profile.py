"""搭配的属性：由单品推导，不单独存储。

规则与推荐时的单品过滤一致（见 recommend.py）：一套搭配「适合」某个条件，
当且仅当其中每件单品都适合。
- 季节：各单品季节的交集。
- 场合：填写了场合的单品取交集；没有单品填写场合时为 None，表示不限。
- 保暖度：填写了保暖度的单品的最小值和最大值；都没填时为 None，表示不限。
"""

from collections.abc import Iterable
from dataclasses import dataclass

from .models import Item

SEASON_ORDER = ("spring", "summer", "autumn", "winter")
OCCASION_ORDER = ("commute", "casual", "sport", "formal")


@dataclass(frozen=True)
class OutfitProfile:
    seasons: list[str]
    occasions: list[str] | None
    warmth_min: int | None
    warmth_max: int | None

    def fits(self, *, season: str, min_warmth: int, max_warmth: int, occasion: str | None) -> bool:
        if season not in self.seasons:
            return False
        if self.warmth_min is not None and not (min_warmth <= self.warmth_min and self.warmth_max <= max_warmth):
            return False
        if occasion and self.occasions is not None and occasion not in self.occasions:
            return False
        return True


def _intersect(sets: Iterable[set[str]], order: tuple[str, ...]) -> list[str]:
    common = set(order)
    for s in sets:
        common &= s
    return [v for v in order if v in common]


def outfit_profile(items: list[Item]) -> OutfitProfile:
    seasons = _intersect((set(i.seasons) for i in items), SEASON_ORDER) if items else []
    with_occasions = [set(i.occasions) for i in items if i.occasions]
    occasions = _intersect(with_occasions, OCCASION_ORDER) if with_occasions else None
    warmths = [i.warmth for i in items if i.warmth is not None]
    return OutfitProfile(
        seasons=seasons,
        occasions=occasions,
        warmth_min=min(warmths) if warmths else None,
        warmth_max=max(warmths) if warmths else None,
    )
