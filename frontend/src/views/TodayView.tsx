import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorText, imageUrl, itemTitle, outfitTitle } from '@/api'
import { ChipSelect } from '@/components/Chips'
import { OCCASIONS, type Occasion } from '@/constants'
import { useSaveWearLog, useWearLogs } from '@/hooks/outfits'
import { useCoords, useRecommendation, useWeather } from '@/hooks/today'
import { formatFull, todayISO } from '@/lib/date'
import { describeWeather, LocateError, MANUAL_BANDS } from '@/lib/weather'
import s from './TodayView.module.css'

const MANUAL_KEY = 'closetly.manualTemp'

function readManual(): number | null {
  try {
    const v = localStorage.getItem(MANUAL_KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}
function writeManual(v: number | null) {
  try {
    if (v === null) localStorage.removeItem(MANUAL_KEY)
    else localStorage.setItem(MANUAL_KEY, String(v))
  } catch {
    /* 忽略 */
  }
}

export default function TodayView() {
  const navigate = useNavigate()
  const today = todayISO()

  // ---- 天气：定位成功用实时体感温度；失败或用户手动选择时用档位温度 ----
  const [locateAttempt, setLocateAttempt] = useState(0)
  const coords = useCoords(locateAttempt)
  const weather = useWeather(coords.data)
  const [manual, setManual] = useState<number | null>(readManual)
  const weatherFailed = coords.isError || weather.isError
  const temperature = manual ?? weather.data?.feels ?? (weatherFailed ? MANUAL_BANDS[1].value : null)
  const usingManual = manual !== null || (weatherFailed && !weather.data)

  function chooseManual(v: number | null) {
    setManual(v)
    writeManual(v)
    setSeed(0)
  }

  // ---- 推荐 ----
  const [occasion, setOccasion] = useState<Occasion | null>(null)
  const [seed, setSeed] = useState(0)
  const rec = useRecommendation({ temperature, date: today, occasion, seed, resetKey: `${temperature}|${occasion}` })
  const r = rec.data

  // ---- 今天是否已经记录过 ----
  const todayLogs = useWearLogs({ start: today, end: today })
  const wear = useSaveWearLog(null)

  function wearIt() {
    if (!r) return
    wear.mutate({ worn_on: today, outfit_id: r.outfit_id, item_ids: r.items.map((i) => i.id), notes: null })
  }

  const loggedCount = todayLogs.data?.length ?? 0

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>今日推荐</h1>
          <p>{formatFull(today)}</p>
        </div>
      </div>

      <section className={`card ${s.weather}`} aria-label="天气">
        <WeatherSummary
          loading={coords.isPending || (coords.isSuccess && weather.isPending)}
          weather={weather.data}
          error={coords.error ?? weather.error}
          usingManual={usingManual}
          temperature={temperature}
          bandLabel={r?.band.label}
          warmth={r ? `${r.band.min_warmth}–${r.band.max_warmth}` : null}
        />
        <div className={s.manual}>
          <span className={s.manualLabel}>{weather.data ? '按体感调整' : '选择今天的气温'}</span>
          <div className={s.manualRow}>
            {MANUAL_BANDS.map((b) => (
              <button key={b.value} type="button" className={s.bandBtn}
                aria-pressed={usingManual && temperature === b.value} onClick={() => chooseManual(b.value)}>
                {b.label}
                <small>{b.hint}</small>
              </button>
            ))}
          </div>
          <div className={s.weatherActions}>
            {manual !== null && weather.data && (
              <button className="btn btn-sm" onClick={() => chooseManual(null)}>使用实时天气</button>
            )}
            {coords.isError && (coords.error as LocateError).kind !== 'unsupported' && (
              <button className="btn btn-sm" onClick={() => setLocateAttempt((n) => n + 1)}>重新定位</button>
            )}
          </div>
        </div>
      </section>

      <div className={s.occasion}>
        <span className="muted">场合</span>
        <ChipSelect label="场合" options={OCCASIONS} value={occasion} onChange={(v) => { setOccasion(v); setSeed(0) }} />
      </div>

      {loggedCount > 0 && (
        <p className={s.logged}>
          今天已经记录了 {loggedCount} 条穿着。<Link to="/calendar">查看</Link>
        </p>
      )}

      <section className={`card ${s.rec}`} aria-live="polite" aria-busy={rec.isFetching}>
        {rec.isError && <p className="msg-error">{errorText(rec.error)}</p>}
        {!r && !rec.isError && <p className="muted">{temperature === null ? '正在获取天气…' : '正在挑选…'}</p>}
        {r && r.source === 'empty' && (
          <div className={s.empty}>
            <p>暂时凑不出一套。</p>
            <ul>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            <Link to="/wardrobe/new" className="btn btn-primary">去添加衣物</Link>
          </div>
        )}
        {r && r.source !== 'empty' && (
          <>
            <div className={s.recHead}>
              <h2>
                {r.source === 'outfit' && r.outfit_id ? (
                  <>来自搭配 <Link to={`/outfits/${r.outfit_id}`}>「{outfitTitle({ name: r.outfit_name })}」</Link></>
                ) : (
                  '为你组合了一套'
                )}
              </h2>
            </div>
            <ul className={s.items}>
              {r.items.map((it) => (
                <li key={it.id}>
                  <Link to={`/wardrobe/${it.id}`}>
                    <img src={imageUrl(it.image_key, 'thumb')} alt="" />
                    <span>{itemTitle(it)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {r.notes.length > 0 && (
              <ul className={s.notes}>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            )}
            {wear.isSuccess && (
              <p className="msg-ok">已记录：今天穿这套。<Link to="/calendar">查看穿着记录</Link></p>
            )}
            {wear.isError && <p className="msg-error">{errorText(wear.error)}</p>}
            <div className={s.actions}>
              <button className="btn btn-primary" onClick={wearIt} disabled={wear.isPending || wear.isSuccess}>
                {wear.isSuccess ? '已记录 ✓' : '今天就穿这套'}
              </button>
              <button className="btn" onClick={() => { wear.reset(); setSeed((n) => n + 1) }} disabled={rec.isFetching}>
                换一套
              </button>
              {r.source === 'generated' && (
                <button className="btn" onClick={() => navigate('/outfits/new', { state: { preset: r.items } })}>
                  存为搭配
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function WeatherSummary({
  loading,
  weather,
  error,
  usingManual,
  temperature,
  bandLabel,
  warmth,
}: {
  loading: boolean
  weather?: { current: number; feelsMax: number; feelsMin: number; feels: number; rainChance: number | null; code: number }
  error: Error | null
  usingManual: boolean
  temperature: number | null
  bandLabel?: string
  warmth: string | null
}) {
  if (loading && !usingManual) return <p className="muted">正在定位并获取天气…</p>
  const w = weather && describeWeather(weather.code)
  return (
    <div className={s.summary}>
      {weather && w ? (
        <div className={s.now}>
          <span className={s.icon} aria-hidden="true">{w.icon}</span>
          <div>
            <div className={s.temp}>{Math.round(weather.current)}℃ <span>{w.text}</span></div>
            <div className="muted">
              体感 {Math.round(weather.feelsMin)}～{Math.round(weather.feelsMax)}℃
              {weather.rainChance !== null && weather.rainChance >= 30 && ` · 降水概率 ${weather.rainChance}%`}
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">{error ? `${error.message}，请手动选择今天的气温。` : ''}</p>
      )}
      {temperature !== null && bandLabel && (
        <p className={s.advice}>
          按{usingManual ? '所选档位' : `体感 ${temperature}℃`}推荐：{bandLabel}，保暖度 {warmth}
          {weather && weather.feelsMax - weather.feelsMin >= 10 && '；早晚温差大，带件外套'}
          {weather && weather.rainChance !== null && weather.rainChance >= 50 && '；可能下雨，记得带伞'}
        </p>
      )}
    </div>
  )
}
