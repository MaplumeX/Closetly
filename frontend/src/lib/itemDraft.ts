import type { Item, ItemInput } from '@/api'
import type { Color, ItemStatus, Occasion, Season, Slot } from '@/constants'

/** 表单内部状态：文本字段用空字符串表示未填写 */
export interface Draft {
  image_key: string | null
  slot: Slot | null
  kind: string
  seasons: Season[]
  name: string
  color: Color | null
  occasions: Occasion[]
  warmth: number | null
  brand: string
  price: string
  purchase_date: string
  location: string
  notes: string
  status: ItemStatus
  tags: string[]
}

export const emptyDraft: Draft = {
  image_key: null,
  slot: null,
  kind: '',
  seasons: [],
  name: '',
  color: null,
  occasions: [],
  warmth: null,
  brand: '',
  price: '',
  purchase_date: '',
  location: '',
  notes: '',
  status: 'active',
  tags: [],
}

export function itemToDraft(item: Item, withImage = true): Draft {
  return {
    image_key: withImage ? item.image_key : null,
    slot: item.slot,
    kind: item.kind ?? '',
    seasons: item.seasons,
    name: item.name ?? '',
    color: item.color,
    occasions: item.occasions,
    warmth: item.warmth,
    brand: item.brand ?? '',
    price: item.price != null ? String(item.price) : '',
    purchase_date: item.purchase_date ?? '',
    location: item.location ?? '',
    notes: item.notes ?? '',
    status: item.status,
    tags: item.tags,
  }
}

export function toInput(d: Draft): ItemInput {
  const orNull = (v: string) => v.trim() || null
  return {
    image_key: d.image_key!,
    slot: d.slot!,
    kind: orNull(d.kind),
    seasons: d.seasons,
    name: orNull(d.name),
    color: d.color,
    occasions: d.occasions,
    warmth: d.warmth,
    brand: orNull(d.brand),
    price: orNull(d.price),
    purchase_date: d.purchase_date || null,
    location: orNull(d.location),
    notes: orNull(d.notes),
    status: d.status,
    tags: d.tags,
  }
}
