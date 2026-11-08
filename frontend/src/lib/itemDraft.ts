import type { Item, ItemInput } from '@/api'
import { FIT_SLOTS, type Color, type Cut, type Fit, type ItemStatus, type Occasion, type Season, type Slot } from '@/constants'
import { cutOptions } from './silhouette'

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
  fit: Fit | null
  cut: Cut | null
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
  fit: null,
  cut: null,
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
    fit: item.fit,
    cut: item.cut,
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
  // 草稿里保留切换部位、类型前选的值，改回来时还在；提交时只留当前适用的
  const slot = d.slot!
  return {
    image_key: d.image_key,
    slot,
    kind: orNull(d.kind),
    seasons: d.seasons,
    name: orNull(d.name),
    color: d.color,
    occasions: d.occasions,
    warmth: d.warmth,
    fit: FIT_SLOTS.includes(slot) ? d.fit : null,
    cut: cutOptions(slot, d.kind, d.name).some((c) => c.value === d.cut) ? d.cut : null,
    brand: orNull(d.brand),
    price: orNull(d.price),
    purchase_date: d.purchase_date || null,
    location: orNull(d.location),
    notes: orNull(d.notes),
    status: d.status,
    tags: d.tags,
  }
}
