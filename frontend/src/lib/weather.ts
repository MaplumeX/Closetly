/** 浏览器定位 + Open-Meteo 天气（免费、无需 API key、支持跨域，位置不经过我们的服务器） */

export interface Coords {
  lat: number
  lon: number
}

export interface Weather {
  current: number // 当前气温
  feelsMax: number // 今天体感最高
  feelsMin: number // 今天体感最低
  feels: number // 用于推荐的代表体感温度：最高与最低的平均
  rainChance: number | null
  code: number
}

const COORDS_KEY = 'closetly.coords'
const COORDS_TTL = 12 * 3600 * 1000

// localStorage 在隐私模式等情况下可能不可用，读写都要容错
function readCache(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY)
    if (!raw) return null
    const { lat, lon, t } = JSON.parse(raw)
    return Date.now() - t < COORDS_TTL ? { lat, lon } : null
  } catch {
    return null
  }
}

function writeCache(c: Coords) {
  try {
    localStorage.setItem(COORDS_KEY, JSON.stringify({ ...c, t: Date.now() }))
  } catch {
    /* 忽略 */
  }
}

export class LocateError extends Error {
  kind: 'unsupported' | 'denied' | 'failed'
  constructor(kind: LocateError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

export function canLocate(): boolean {
  return window.isSecureContext && 'geolocation' in navigator
}

/** 定位结果缓存 12 小时，避免每次打开都请求定位 */
export function locate(force = false): Promise<Coords> {
  const cached = !force && readCache()
  if (cached) return Promise.resolve(cached)
  if (!canLocate()) {
    return Promise.reject(new LocateError('unsupported', '浏览器定位需要 HTTPS 连接'))
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 精确到约 1 公里就够查天气了
        const c = { lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }
        writeCache(c)
        resolve(c)
      },
      (err) =>
        reject(
          err.code === err.PERMISSION_DENIED
            ? new LocateError('denied', '没有定位权限，可以在浏览器设置中允许')
            : new LocateError('failed', '定位失败'),
        ),
      { timeout: 10000, maximumAge: 30 * 60 * 1000 },
    )
  })
}

export async function fetchWeather({ lat, lon }: Coords): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    daily: 'apparent_temperature_max,apparent_temperature_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '1',
  }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error('天气服务暂时不可用')
  const data = await res.json()
  const feelsMax = data.daily.apparent_temperature_max[0]
  const feelsMin = data.daily.apparent_temperature_min[0]
  return {
    current: data.current.temperature_2m,
    feelsMax,
    feelsMin,
    feels: Math.round((feelsMax + feelsMin) / 2),
    rainChance: data.daily.precipitation_probability_max?.[0] ?? null,
    code: data.current.weather_code,
  }
}

/** WMO 天气代码 → 图标与描述 */
export function describeWeather(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: '☀️', text: '晴' }
  if (code <= 2) return { icon: '🌤️', text: '少云' }
  if (code === 3) return { icon: '☁️', text: '阴' }
  if (code <= 48) return { icon: '🌫️', text: '雾' }
  if (code <= 57) return { icon: '🌦️', text: '毛毛雨' }
  if (code <= 67) return { icon: '🌧️', text: '雨' }
  if (code <= 77) return { icon: '🌨️', text: '雪' }
  if (code <= 82) return { icon: '🌧️', text: '阵雨' }
  if (code <= 86) return { icon: '🌨️', text: '阵雪' }
  return { icon: '⛈️', text: '雷雨' }
}

/** 没有定位时手动选择的气温档位（取档位中间值） */
export const MANUAL_BANDS = [
  { value: 30, label: '炎热', hint: '≥26℃' },
  { value: 22, label: '温暖', hint: '18–25℃' },
  { value: 14, label: '凉爽', hint: '10–17℃' },
  { value: 5, label: '寒冷', hint: '<10℃' },
] as const
