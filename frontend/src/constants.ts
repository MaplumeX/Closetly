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

export type Season = (typeof SEASONS)[number]['value']
export type Occasion = (typeof OCCASIONS)[number]['value']
export type Color = (typeof COLORS)[number]['value']
export type ItemStatus = (typeof STATUSES)[number]['value']

export const labelOf = <T extends { value: string; label: string }>(list: readonly T[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? ''
