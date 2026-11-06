import { Link } from 'react-router'
import { errorText, outfitTitle } from '@/api'
import { OutfitCollage } from '@/components/OutfitCollage'
import { useOutfits } from '@/hooks/outfits'
import { formatDay } from '@/lib/date'
import s from './OutfitsView.module.css'

export default function OutfitsView() {
  const outfits = useOutfits()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>搭配</h1>
          <p>{outfits.data ? `${outfits.data.length} 套` : ' '}</p>
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
      <ul className={s.grid}>
        {outfits.data?.map((o) => (
          <li key={o.id}>
            <Link to={`/outfits/${o.id}`} className={s.card}>
              <OutfitCollage items={o.items} />
              <span className={s.title}>{outfitTitle(o)}</span>
              <span className={s.sub}>
                {o.items.length} 件 · {o.wear_count ? `穿过 ${o.wear_count} 次，上次${formatDay(o.last_worn_on!)}` : '还没穿过'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
