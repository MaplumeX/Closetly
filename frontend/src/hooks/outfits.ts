import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Outfit, type WearLog } from '@/api'

export interface OutfitInput {
  name: string | null
  notes: string | null
  item_ids: number[]
}

export interface WearLogInput {
  worn_on: string
  outfit_id?: number | null
  item_ids: number[]
  notes: string | null
}

const okeys = {
  all: ['outfits'] as const,
  list: (itemId?: number) => ['outfits', 'list', itemId ?? null] as const,
  one: (id: number) => ['outfits', 'detail', id] as const,
}
const wkeys = {
  all: ['wear-logs'] as const,
  list: (query: string) => ['wear-logs', query] as const,
}

/** 搭配、穿着记录、衣物上的穿着统计互相关联，任何一处变化都一起刷新 */
function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    for (const queryKey of [okeys.all, wkeys.all, ['items']]) qc.invalidateQueries({ queryKey })
  }
}

export function useOutfits(itemId?: number) {
  return useQuery({
    queryKey: okeys.list(itemId),
    queryFn: () => api<Outfit[]>(`/api/outfits${itemId ? `?item_id=${itemId}` : ''}`),
  })
}

export function useOutfit(id: number | null) {
  return useQuery({
    queryKey: okeys.one(id ?? 0),
    queryFn: () => api<Outfit>(`/api/outfits/${id}`),
    enabled: id !== null,
  })
}

export function useSaveOutfit(id: number | null) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: OutfitInput) =>
      id ? api<Outfit>(`/api/outfits/${id}`, { method: 'PATCH', body: { ...body } }) : api<Outfit>('/api/outfits', { method: 'POST', body: { ...body } }),
    onSuccess: invalidate,
  })
}

export function useDeleteOutfit() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api(`/api/outfits/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

/** params 会转成查询串：start、end、outfit_id、item_id */
export function useWearLogs(params: Record<string, string | number | undefined>, enabled = true) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  ).toString()
  return useQuery({
    queryKey: wkeys.list(query),
    queryFn: () => api<WearLog[]>(`/api/wear-logs?${query}`),
    placeholderData: (prev) => prev,
    enabled,
  })
}

export function useWearLog(id: number | null) {
  return useQuery({
    queryKey: ['wear-logs', 'detail', id ?? 0],
    queryFn: () => api<WearLog>(`/api/wear-logs/${id}`),
    enabled: id !== null,
  })
}

export function useSaveWearLog(id: number | null) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: WearLogInput) =>
      id
        ? api<WearLog>(`/api/wear-logs/${id}`, {
            method: 'PATCH',
            body: { worn_on: body.worn_on, item_ids: body.item_ids, notes: body.notes },
          })
        : api<WearLog>('/api/wear-logs', { method: 'POST', body: { ...body } }),
    onSuccess: invalidate,
  })
}

export function useDeleteWearLog() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api(`/api/wear-logs/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
