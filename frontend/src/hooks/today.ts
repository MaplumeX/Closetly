import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api, type ItemBrief } from '@/api'
import type { Occasion, Season } from '@/constants'
import { fetchWeather, locate, type Coords } from '@/lib/weather'

export interface Recommendation {
  source: 'outfit' | 'generated' | 'empty'
  outfit_id: number | null
  outfit_name: string | null
  items: ItemBrief[]
  band: { label: string; min_warmth: number; max_warmth: number; need_outer: boolean }
  season: Season
  notes: string[]
}

export function useCoords(attempt: number) {
  return useQuery({
    queryKey: ['coords', attempt],
    queryFn: () => locate(attempt > 0), // attempt > 0 表示用户点了「重新定位」
    retry: false,
    staleTime: Infinity,
  })
}

export function useWeather(coords: Coords | undefined) {
  return useQuery({
    queryKey: ['weather', coords?.lat, coords?.lon],
    queryFn: () => fetchWeather(coords!),
    enabled: !!coords,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })
}

/**
 * 「换一套」时 seed 递增，并把本轮已经展示过的单品传给后端降低权重。
 * 气温或场合变化时，调用方应同时重置 seed（resetKey 变化会清空已展示列表）。
 */
export function useRecommendation(opts: {
  temperature: number | null
  date: string
  occasion: Occasion | null
  seed: number
  resetKey: string
}) {
  const shown = useRef<number[]>([])
  const lastReset = useRef(opts.resetKey)

  const query = useQuery({
    queryKey: ['recommendation', opts.temperature, opts.date, opts.occasion, opts.seed],
    queryFn: () => {
      if (lastReset.current !== opts.resetKey) {
        shown.current = []
        lastReset.current = opts.resetKey
      }
      const params = new URLSearchParams({ temperature: String(opts.temperature), date: opts.date, seed: String(opts.seed) })
      if (opts.occasion) params.set('occasion', opts.occasion)
      for (const id of shown.current) params.append('skip', String(id))
      return api<Recommendation>(`/api/recommendation?${params}`)
    },
    enabled: opts.temperature !== null,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (query.data) shown.current = [...new Set([...shown.current, ...query.data.items.map((i) => i.id)])]
  }, [query.data])

  return query
}
