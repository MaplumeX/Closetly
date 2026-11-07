import { Link, useSearchParams } from 'react-router'
import { errorText, outfitTitle, type Outfit } from '@/api'
import { ChipSelect } from '@/components/Chips'
import { OutfitCollage } from '@/components/OutfitCollage'
import { OCCASIONS, SEASONS, type Occasion, type Season } from '@/constants'
import { useOutfits } from '@/hooks/outfits'
import { formatDay } from '@/lib/date'
import { isWearable, profileText } from '@/lib/outfit'
import s from './OutfitsView.module.css'

const AVAILABILITY = [{ value: 'wearable', label: '单品都在衣柜里' }] as const

interface Filters {
  season: Season | null
  occasion: Occasion | null
  wearable: boolean
}

/** 与推荐的规则一致：场合不限（null）的搭配适合任何场合 */
function matches(o: Outfit, f: Filters) {
  if (f.season && !o.seasons.includes(f.season)) return false
  if (f.occasion && o.occasions !== null && !o.occasions.includes(f.occasion)) return false
  if (f.wearable && !isWearable(o)) return false
  return true
}

const pick = <T extends string>(list: readonly { value: T }[], v: string | null) =>
  list.find((x) => x.value === v)?.value ?? null

export default function OutfitsView() {
  const outfits = useOutfits()
  const [params, setParams] = useSearchParams()
  const filters: Filters = {
    season: pick(SEASONS, params.get('season')),
    occasion: pick(OCCASIONS, params.get('occasion')),
    wearable: params.get('wearable') === '1',
  }
  const set = (k: string) => (v: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === null) next.delete(k)
        else next.set(k, v)
        return next
      },
      { replace: true },
    )

  const all = outfits.data ?? []
  const shown = all.filter((o) => matches(o, filters))
  const filtered = shown.length !== all.length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>搭配</h1>
          <p>{outfits.data ? (filtered ? `${shown.length} / ${all.length} 套` : `${all.length} 套`) : ' '}</p>
        </div>
        <Link to="/outfits/new" className="btn btn-primary">＋ 新建搭配</Link>
      </div>

      {outfits.isError && <p className="msg-error">{errorText(outfits.error)}</p>}
      {outfits.data?.length === 0 && (
        <div className={`card ${s.empty}`}>
          <p>还没有搭配。把常一起穿的几件衣服存成一套，之后记录穿着、推荐穿搭都会用到。</p>
          <Link to="/outfits/new" className="btn btn-primary">新建第一套搭配</Link>
        </div>
      )}

      {all.length > 0 && (
        <div className={s.filters}>
          <ChipSelect label="季节" options={SEASONS} value={filters.season} onChange={set('season')} />
          <ChipSelect label="场合" options={OCCASIONS} value={filters.occasion} onChange={set('occasion')} />
          <ChipSelect label="状态" options={AVAILABILITY} value={filters.wearable ? 'wearable' : null}
            onChange={(v) => set('wearable')(v ? '1' : null)} />
        </div>
      )}
      {all.length > 0 && shown.length === 0 && <p className="muted">没有符合条件的搭配</p>}

      <ul className={s.grid}>
        {shown.map((o) => (
          <li key={o.id}>
            <Link to={`/outfits/${o.id}`} className={s.card}>
              <OutfitCollage items={o.items} />
              <span className={s.title}>{outfitTitle(o)}</span>
              <span className={s.sub}>{profileText(o)}</span>
              <span className={s.sub}>
                {o.items.length} 件 · {o.wear_count ? `穿过 ${o.wear_count} 次，上次${formatDay(o.last_worn_on!)}` : '还没穿过'}
              </span>
              {!isWearable(o) && o.items.length > 0 && <span className={s.warn}>有单品不在衣柜里</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
