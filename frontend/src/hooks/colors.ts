import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api, customColorValue, type CustomColor } from '@/api'
import { colorDialog } from '@/components/dialogs'
import { COLORS, type Color } from '@/constants'

const colorsKey = ['colors'] as const

/** 色板里的一格：预设色或自定义颜色 */
export interface PaletteColor {
  value: Color
  label: string
  /** CSS background，可以是渐变（「多色」） */
  swatch: string
}

export function useCustomColors() {
  return useQuery({ queryKey: colorsKey, queryFn: () => api<CustomColor[]>('/api/colors') })
}

/** 完整色板：预设色在前，自定义颜色按添加顺序接在后面 */
export function usePalette(): PaletteColor[] {
  const { data } = useCustomColors()
  return useMemo(
    () => [
      ...COLORS.map((c) => ({ value: c.value, label: c.label, swatch: c.hex })),
      ...(data ?? []).map((c) => ({ value: customColorValue(c.id), label: c.name, swatch: c.hex })),
    ],
    [data],
  )
}

/** 新名称有问题时返回错误文案；exceptId 是正在编辑的颜色自己 */
export function colorNameProblem(name: string, customs: CustomColor[] | undefined, exceptId?: number): string | null {
  const n = name.trim()
  if (!n) return '名称不能为空'
  if (n.length > 16) return '最多 16 个字'
  const taken = COLORS.some((c) => c.label === n) || customs?.some((c) => c.name === n && c.id !== exceptId)
  return taken ? `已经有叫「${n}」的颜色了` : null
}

/** 颜色的增删改会影响色板，删除还会清掉衣物上的主色 */
function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    for (const queryKey of [colorsKey, ['items']]) qc.invalidateQueries({ queryKey })
  }
}

export function useCreateColor() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { name: string; hex: string }) => api<CustomColor>('/api/colors', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateColor() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; hex?: string }) =>
      api<CustomColor>(`/api/colors/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteColor() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api(`/api/colors/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

/** 弹出对话框添加一个颜色；取消返回 null，保存失败会抛出异常 */
export function useAddColor() {
  const { data: customs } = useCustomColors()
  const create = useCreateColor()
  return async (): Promise<CustomColor | null> => {
    const r = await colorDialog({
      title: '添加颜色',
      message: '预设色板里没有的颜色，可以自己加。之后录入和筛选都能用。',
      confirmText: '添加',
      validate: (n) => colorNameProblem(n, customs),
    })
    return r && create.mutateAsync(r)
  }
}
