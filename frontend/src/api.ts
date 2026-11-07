import { labelOf, SLOTS, type Color, type ItemStatus, type Occasion, type Season, type Slot } from './constants'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Json = Record<string, unknown> | unknown[]

/** 401 时的全局回调，由 router 注册，用于跳转登录页 */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: Json | FormData; skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, skipAuthRedirect = false } = options
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, init)
  if (res.status === 401 && !skipAuthRedirect) onUnauthorized?.()
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    // FastAPI 校验错误：取第一条
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return translateValidation(data.detail[0])
  } catch {
    /* 非 JSON 响应 */
  }
  return `请求失败（${res.status}）`
}

function translateValidation(err: { type?: string; loc?: string[]; ctx?: { min_length?: number } }) {
  const field = err.loc?.at(-1) ?? ''
  if (err.type === 'string_too_short') return `${field} 长度至少为 ${err.ctx?.min_length}`
  if (err.type === 'string_pattern_mismatch') return `${field} 只能包含字母、数字、下划线、点和短横线`
  return `${field} 格式不正确`
}

export interface User {
  id: number
  username: string
  is_admin: boolean
  is_active: boolean
  created_at: string
}

/** 把任意异常转成可以展示给用户的文字 */
export function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : '网络错误，请稍后再试'
}

// ---------- 衣物 ----------

export interface Item {
  id: number
  slot: Slot
  /** 类型（二级分类），用户自由填写，可为空 */
  kind: string | null
  image_key: string
  name: string | null
  seasons: Season[]
  color: Color | null
  occasions: Occasion[]
  warmth: number | null
  brand: string | null
  price: number | null
  purchase_date: string | null
  location: string | null
  notes: string | null
  status: ItemStatus
  tags: string[]
  wear_count: number
  last_worn_on: string | null
  created_at: string
  updated_at: string
}

/** 创建/更新衣物时提交的字段 */
export type ItemInput = Omit<
  Item,
  'id' | 'created_at' | 'updated_at' | 'price' | 'wear_count' | 'last_worn_on'
> & {
  price: string | null
}

export interface TagCount {
  name: string
  count: number
}

export interface KindCount {
  slot: Slot
  name: string
  count: number
}

/** 用户自己添加的颜色 */
export interface CustomColor {
  id: number
  name: string
  /** #rrggbb */
  hex: string
  /** 使用这个颜色的衣物数量（含已淘汰） */
  count: number
}

export const customColorValue = (id: number): Color => `custom:${id}`

export const imageUrl = (key: string, size: 'full' | 'thumb' = 'full') =>
  `/api/images/${key}${size === 'thumb' ? '?size=thumb' : ''}`

// ---------- 搭配与穿着记录 ----------

/** 搭配、穿着记录里的精简单品信息 */
export type ItemBrief = Pick<
  Item,
  'id' | 'image_key' | 'name' | 'slot' | 'kind' | 'status' | 'seasons' | 'occasions' | 'warmth'
>

export const toBrief = ({ id, image_key, name, slot, kind, status, seasons, occasions, warmth }: ItemBrief): ItemBrief => ({
  id,
  image_key,
  name,
  slot,
  kind,
  status,
  seasons,
  occasions,
  warmth,
})

export interface Outfit {
  id: number
  name: string | null
  notes: string | null
  items: ItemBrief[]
  /** 以下由单品推导：每件单品都适合的季节 */
  seasons: Season[]
  /** 填写了场合的单品的共同场合；null 表示不限（没有单品填写场合） */
  occasions: Occasion[] | null
  /** 填写了保暖度的单品的范围；都没填时为 null */
  warmth_min: number | null
  warmth_max: number | null
  wear_count: number
  last_worn_on: string | null
  created_at: string
  updated_at: string
}

export interface WearLog {
  id: number
  worn_on: string
  outfit_id: number | null
  outfit_name: string | null
  notes: string | null
  items: ItemBrief[]
  created_at: string
}

export const outfitTitle = (o: Pick<Outfit, 'name'>) => o.name || '未命名搭配'

/** 分类的简短说法：有类型显示类型，否则显示部位 */
export const itemKind = (item: Pick<Item, 'slot' | 'kind'>) => item.kind || labelOf(SLOTS, item.slot)

/** 「部位 / 类型」，例如「下装 / 牛仔裤」 */
export const itemCategory = (item: Pick<Item, 'slot' | 'kind'>) =>
  [labelOf(SLOTS, item.slot), item.kind].filter(Boolean).join(' / ')

export const itemTitle = (item: Pick<Item, 'name' | 'slot' | 'kind'>) => item.name || itemKind(item)
