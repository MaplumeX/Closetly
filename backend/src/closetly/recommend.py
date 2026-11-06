"""今日推荐：根据气温、季节、场合和最近穿着情况，挑一套衣服。

策略
1. 气温 → 需要的保暖度区间，以及是否需要外套。
2. 候选单品：状态为「在用」，季节匹配、保暖度在区间内（未填写保暖度的不受限制）、场合匹配（未填写场合的不受限制）。
   某个位置（如鞋）没有候选时，依次放宽季节、保暖度，并在 notes 里说明。
3. 优先从已保存的搭配中挑选（搭配里每件单品都满足条件）；
   本轮「换一套」已经展示过的搭配跳过，全部展示过后改为自动组合单品。
4. 最近 N 天穿过的、本轮已经展示过的单品降低权重，再按权重随机抽取。
"""

import random
from dataclasses import dataclass, field
from datetime import date

from .item_queries import category_info, sorted_briefs
from .models import Item, Outfit, Slot
from .schemas import ItemBrief

RECENT_WEIGHT = 0.15
SKIP_WEIGHT = 0.25

SLOT_LABELS = {
    Slot.TOP: "上装",
    Slot.BOTTOM: "下装",
    Slot.ONEPIECE: "连衣裙/连体",
    Slot.OUTER: "外套",
    Slot.SHOES: "鞋",
}
SEASON_LABELS = {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"}


@dataclass(frozen=True)
class Band:
    label: str
    min_warmth: int
    max_warmth: int
    need_outer: bool


def band_for(temperature: float) -> Band:
    if temperature >= 26:
        return Band("炎热", 1, 2, False)
    if temperature >= 18:
        return Band("温暖", 2, 3, False)
    if temperature >= 10:
        return Band("凉爽", 3, 4, True)
    return Band("寒冷", 4, 5, True)


def season_for(d: date) -> str:
    return {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
            6: "summer", 7: "summer", 8: "summer"}.get(d.month, "autumn")  # fmt: skip


@dataclass
class Result:
    source: str  # outfit | generated | empty
    items: list[Item] = field(default_factory=list)
    outfit: Outfit | None = None
    notes: list[str] = field(default_factory=list)

    def briefs(self) -> list[ItemBrief]:
        return sorted_briefs(self.items)


class Recommender:
    def __init__(
        self,
        *,
        items: list[Item],
        outfits: list[Outfit],
        last_worn: dict[int, date],
        today: date,
        band: Band,
        occasion: str | None,
        skip: set[int],
        avoid_days: int,
        rng: random.Random,
    ) -> None:
        self.items = [i for i in items if i.status == "active"]
        self.outfits = outfits
        self.last_worn = last_worn
        self.today = today
        self.band = band
        self.season = season_for(today)
        self.occasion = occasion
        self.skip = skip
        self.avoid_days = avoid_days
        self.rng = rng
        self.by_slot: dict[Slot | None, list[Item]] = {}
        for it in self.items:
            self.by_slot.setdefault(category_info(it)[1], []).append(it)

    # ---- 单品 ----

    def _ok(self, it: Item, relax_season: bool = False, relax_warmth: bool = False) -> bool:
        if not relax_season and self.season not in it.seasons:
            return False
        if not relax_warmth and it.warmth is not None and not (self.band.min_warmth <= it.warmth <= self.band.max_warmth):
            return False
        if self.occasion and it.occasions and self.occasion not in it.occasions:
            return False
        return True

    def _weight(self, it: Item) -> float:
        w = 1.0
        last = self.last_worn.get(it.id)
        if last is not None and 0 <= (self.today - last).days < self.avoid_days:
            w *= RECENT_WEIGHT
        if it.id in self.skip:
            w *= SKIP_WEIGHT
        return w

    def _pool(self, slot: Slot, notes: list[str]) -> list[Item]:
        candidates = self.by_slot.get(slot, [])
        label = SLOT_LABELS[slot]
        season = SEASON_LABELS[self.season]
        for relax_season, relax_warmth, note in (
            (False, False, None),
            (True, False, f"没有适合{season}季的{label}，放宽了季节"),
            (True, True, f"没有保暖度合适的{label}，放宽了季节和保暖度"),
        ):
            pool = [i for i in candidates if self._ok(i, relax_season, relax_warmth)]
            if pool:
                if note:
                    notes.append(note)
                return pool
        return []

    def _pick(self, pool: list[Item]) -> Item:
        return self.rng.choices(pool, weights=[self._weight(i) for i in pool])[0]

    # ---- 推荐 ----

    def recommend(self) -> Result:
        if not self.items:
            return Result("empty", notes=["衣柜里还没有「在用」的衣物"])
        return self._from_outfits() or self._generate()

    def _from_outfits(self) -> Result | None:
        valid = [
            o
            for o in self.outfits
            if o.items
            and all(i.status == "active" and self._ok(i) for i in o.items)
            and not {i.id for i in o.items} <= self.skip  # 本轮已经展示过
        ]
        if not valid:
            return None
        weights = [min(self._weight(i) for i in o.items) for o in valid]
        outfit = self.rng.choices(valid, weights=weights)[0]
        result = Result("outfit", items=list(outfit.items), outfit=outfit)
        has_outer = any(category_info(i)[1] == Slot.OUTER for i in outfit.items)
        if self.band.need_outer and not has_outer and (outers := self._pool(Slot.OUTER, result.notes)):
            result.items.append(self._pick(outers))
            result.notes.append("天气偏冷，加了一件外套")
        return result

    def _generate(self) -> Result:
        result = Result("generated")
        notes = result.notes
        tops = self._pool(Slot.TOP, notes)
        bottoms = self._pool(Slot.BOTTOM, notes)
        onepieces = self._pool(Slot.ONEPIECE, notes)

        options: list[tuple[str, float]] = []
        if tops and bottoms:
            options.append(("separates", len(tops)))
        if onepieces:
            options.append(("onepiece", len(onepieces)))
        if options:
            kind = self.rng.choices([k for k, _ in options], weights=[w for _, w in options])[0]
            if kind == "separates":
                result.items += [self._pick(tops), self._pick(bottoms)]
            else:
                result.items.append(self._pick(onepieces))
        else:
            missing = "上装" if not tops else "下装"
            notes.append(f"衣柜里缺少可搭配的{missing}")

        if shoes := self._pool(Slot.SHOES, notes):
            result.items.append(self._pick(shoes))
        else:
            notes.append("没有符合场合的鞋" if self.by_slot.get(Slot.SHOES) else "衣柜里还没有鞋")

        if self.band.need_outer:
            if outers := self._pool(Slot.OUTER, notes):
                result.items.append(self._pick(outers))
            else:
                notes.append("天气偏冷，但衣柜里没有合适的外套")

        if not result.items:
            result.source = "empty"
        return result
