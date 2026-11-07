import type { ItemBrief, Outfit } from '@/api'
import { labelOf, OCCASIONS, SEASONS, type Slot } from '@/constants'

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

const seasonText = (o: Pick<Outfit, 'seasons'>) =>
  o.seasons.length === SEASONS.length ? '四季' : o.seasons.map((v) => labelOf(SEASONS, v)).join('')

/** 搭配属性的简短说明，例如「春秋 · 通勤 · 保暖 2–4」 */
export function profileText(o: Pick<Outfit, 'seasons' | 'occasions' | 'warmth_min' | 'warmth_max' | 'items'>): string {
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
