/** 部位：固定的一级分类，推荐搭配时按部位组合 */
export const SLOTS = [
  { value: 'top', label: '上装' },
  { value: 'bottom', label: '下装' },
  { value: 'onepiece', label: '连衣裙/连体' },
  { value: 'outer', label: '外套' },
  { value: 'shoes', label: '鞋' },
  { value: 'accessory', label: '配饰' },
] as const

/** 录入类型时的输入提示，只做示例，不预置到数据库 */
export const KIND_EXAMPLES: Record<Slot, string> = {
  top: 'T恤、衬衫、卫衣',
  bottom: '牛仔裤、半身裙',
  onepiece: '连衣裙、背带裤',
  outer: '夹克、羽绒服',
  shoes: '运动鞋、靴子',
  accessory: '包、帽子、围巾',
}

export const SEASONS = [
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
] as const

export const OCCASIONS = [
  { value: 'commute', label: '通勤' },
  { value: 'casual', label: '休闲' },
  { value: 'sport', label: '运动' },
  { value: 'formal', label: '正式' },
] as const

/** 预设色板；用户还可以在后面追加自己的颜色（见 hooks/colors.ts） */
export const COLORS = [
  { value: 'black', label: '黑', hex: '#1f1f1f' },
  { value: 'white', label: '白', hex: '#f7f7f5' },
  { value: 'gray', label: '灰', hex: '#9a9a9a' },
  { value: 'beige', label: '米', hex: '#e3d5b8' },
  { value: 'brown', label: '棕', hex: '#7a5232' },
  { value: 'red', label: '红', hex: '#c8352e' },
  { value: 'pink', label: '粉', hex: '#f0a6b8' },
  { value: 'orange', label: '橙', hex: '#ec8a2f' },
  { value: 'yellow', label: '黄', hex: '#f2cd3c' },
  { value: 'green', label: '绿', hex: '#4f8a4a' },
  { value: 'blue', label: '蓝', hex: '#4a86c8' },
  { value: 'navy', label: '藏青', hex: '#1f2f57' },
  { value: 'purple', label: '紫', hex: '#7d55a8' },
  { value: 'multi', label: '多色', hex: 'conic-gradient(#c8352e, #f2cd3c, #4f8a4a, #4a86c8, #7d55a8, #c8352e)' },
] as const

export const STATUSES = [
  { value: 'active', label: '在用' },
  { value: 'laundry', label: '送洗' },
  { value: 'idle', label: '闲置' },
  { value: 'retired', label: '已淘汰' },
] as const

export const WARMTH_LABELS = ['', '很薄', '薄', '适中', '厚', '很厚'] as const

export type Slot = (typeof SLOTS)[number]['value']
export type Season = (typeof SEASONS)[number]['value']
export type Occasion = (typeof OCCASIONS)[number]['value']
export type PresetColor = (typeof COLORS)[number]['value']
/** 衣物的主色：预设色，或 `custom:<id>` 表示自定义颜色 */
export type Color = PresetColor | `custom:${number}`
export type ItemStatus = (typeof STATUSES)[number]['value']

export const labelOf = <T extends { value: string; label: string }>(list: readonly T[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? ''
