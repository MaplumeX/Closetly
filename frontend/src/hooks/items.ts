import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Category, type Item, type ItemInput, type TagCount } from '@/api'
import { prepareImage } from '@/lib/image'

export const keys = {
  categories: ['categories'] as const,
  items: ['items'] as const,
  itemList: (query: string) => ['items', 'list', query] as const,
  item: (id: number) => ['items', 'detail', id] as const,
  tags: ['tags'] as const,
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<Category[]>('/api/categories'),
    staleTime: Infinity,
  })
}

/** query 是 URL 查询串（不含 ?），参数名与后端一致 */
export function useItems(query: string) {
  return useQuery({
    queryKey: keys.itemList(query),
    queryFn: () => api<Item[]>(`/api/items${query ? `?${query}` : ''}`),
    placeholderData: (prev) => prev, // 切换筛选条件时保留旧结果，避免闪烁
  })
}

export function useItem(id: number | null) {
  return useQuery({
    queryKey: keys.item(id ?? 0),
    queryFn: () => api<Item>(`/api/items/${id}`),
    enabled: id !== null,
  })
}

export function useTags() {
  return useQuery({ queryKey: keys.tags, queryFn: () => api<TagCount[]>('/api/tags') })
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  const blob = await prepareImage(file)
  form.append('file', blob, file.name || 'photo.jpg')
  const { key } = await api<{ key: string }>('/api/images', { method: 'POST', body: form })
  return key
}

/** 衣物变化会影响列表、标签，以及搭配和穿着记录里展示的单品 */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const queryKey of [keys.items, keys.tags, ['outfits'], ['wear-logs']]) qc.invalidateQueries({ queryKey })
}

function useInvalidateItems() {
  const qc = useQueryClient()
  return (item?: Item) => {
    if (item) qc.setQueryData(keys.item(item.id), item)
    invalidateAll(qc)
  }
}

export function useCreateItem() {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: (body: ItemInput) => api<Item>('/api/items', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateItem(id: number) {
  const invalidate = useInvalidateItems()
  return useMutation({
    mutationFn: (body: Partial<ItemInput>) => api<Item>(`/api/items/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/items/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.item(id) })
      invalidateAll(qc)
    },
  })
}
