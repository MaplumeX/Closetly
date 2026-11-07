import type { ItemBrief, Outfit } from '@/api'
import { labelOf, OCCASIONS, SEASONS, STATUSES, type Occasion, type Season, type Slot } from '@/constants'

/** 展示一套搭配时的部位顺序：从外到内、从上到下（与后端 item_queries.SLOT_ORDER 一致） */
export const SLOT_ORDER: readonly Slot[] = ['outer', 'onepiece', 'top', 'bottom', 'shoes', 'accessory']

export const sortBySlot = <T extends Pick<ItemBrief, 'id' | 'slot'>>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.id - b.id)

/** 主体部位：搭配封面里占大格 */
export const isMainSlot = (slot: Slot) => slot === 'top' || slot === 'bottom' || slot === 'onepiece'

/**
 * 一套能穿出门的衣服还缺哪些部位：上装＋下装（或连体），加上鞋。
 * 外套看天气、配饰可有可无，不算缺。只用来提示，不阻止保存。
 */
export function missingSlots(items: readonly Pick<ItemBrief, 'slot'>[]): Slot[] {
  const has = new Set(items.map((i) => i.slot))
  const missing: Slot[] = []
  if (!has.has('onepiece')) {
    if (!has.has('top')) missing.push('top')
    if (!has.has('bottom')) missing.push('bottom')
  }
  if (!has.has('shoes')) missing.push('shoes')
  return missing
}

/** 「主体」已经由另一种方式满足：选了连体就不必选上装、下装，反之亦然 */
export function coveredSlots(items: readonly Pick<ItemBrief, 'slot'>[]): Set<Slot> {
  const has = new Set(items.map((i) => i.slot))
  const covered = new Set<Slot>()
  if (has.has('onepiece')) {
    if (!has.has('top')) covered.add('top')
    if (!has.has('bottom')) covered.add('bottom')
  }
  if (has.has('top') && has.has('bottom') && !has.has('onepiece')) covered.add('onepiece')
  return covered
}

export type OutfitProfile = Pick<Outfit, 'seasons' | 'occasions' | 'warmth_min' | 'warmth_max'>

/**
 * 由单品推导搭配属性。规则与后端 outfit_profile.py 相同：
 * 季节取交集；填写了场合的单品取交集，都没填为 null（不限）；保暖度取填写了的范围。
 * 后端返回的搭配已经带有这些属性，这里用于挑选过程中实时计算。
 */
export function profileOf(items: readonly Pick<ItemBrief, 'seasons' | 'occasions' | 'warmth'>[]): OutfitProfile {
  const intersect = <T extends string>(order: readonly { value: T }[], sets: readonly (readonly T[])[]) =>
    order.map((x) => x.value).filter((v) => sets.every((s) => s.includes(v)))
  const withOccasions = items.map((i) => i.occasions).filter((o) => o.length > 0)
  const warmths = items.map((i) => i.warmth).filter((w): w is number => w !== null)
  return {
    seasons: items.length ? intersect<Season>(SEASONS, items.map((i) => i.seasons)) : [],
    occasions: withOccasions.length ? intersect<Occasion>(OCCASIONS, withOccasions) : null,
    warmth_min: warmths.length ? Math.min(...warmths) : null,
    warmth_max: warmths.length ? Math.max(...warmths) : null,
  }
}

/**
 * 候选单品与已选单品是否合得来；合适时返回 null，否则返回简短原因。
 * - 不在衣柜里（送洗、闲置等）——checkStatus 为 false 时不检查，例如补记过去的穿着
 * - 和已选单品没有共同的季节
 * - 和已选单品没有共同的场合（任何一方没填场合都算不限）
 * 已选单品之间本身就没有共同季节或场合时，不再拿这一项去要求候选单品。
 */
export function mismatchReason(
  candidate: Pick<ItemBrief, 'status' | 'seasons' | 'occasions'>,
  profile: OutfitProfile,
  checkStatus = true,
): string | null {
  if (checkStatus && candidate.status !== 'active') return labelOf(STATUSES, candidate.status)
  if (profile.seasons.length && !candidate.seasons.some((v) => profile.seasons.includes(v))) return '季节不同'
  if (profile.occasions?.length && candidate.occasions.length && !candidate.occasions.some((v) => profile.occasions!.includes(v))) {
    return '场合不同'
  }
  return null
}

const seasonText = (o: Pick<Outfit, 'seasons'>) =>
  o.seasons.length === SEASONS.length ? '四季' : o.seasons.map((v) => labelOf(SEASONS, v)).join('')

/** 搭配属性的简短说明，例如「春秋 · 通勤 · 保暖 2–4」 */
export function profileText(o: OutfitProfile & Pick<Outfit, 'items'>): string {
  if (!o.items.length) return ''
  const parts = [seasonText(o) || '没有共同的季节']
  if (o.occasions?.length) parts.push(o.occasions.map((v) => labelOf(OCCASIONS, v)).join('、'))
  if (o.warmth_min !== null) {
    parts.push(o.warmth_min === o.warmth_max ? `保暖 ${o.warmth_min}` : `保暖 ${o.warmth_min}–${o.warmth_max}`)
  }
  return parts.join(' · ')
}

/** 搭配里的单品是否都在衣柜里（状态为在用） */
export const isWearable = (o: Pick<Outfit, 'items'>) => o.items.length > 0 && o.items.every((i) => i.status === 'active')
