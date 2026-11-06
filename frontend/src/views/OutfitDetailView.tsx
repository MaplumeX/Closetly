import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { errorText, itemTitle, outfitTitle } from '@/api'
import { confirmDialog } from '@/components/dialogs'
import { labelOf, STATUSES } from '@/constants'
import { useDeleteOutfit, useOutfit, useSaveWearLog } from '@/hooks/outfits'
import { formatDay, todayISO } from '@/lib/date'
import { ItemThumb } from '@/components/ItemThumb'
import s from './OutfitDetailView.module.css'

export default function OutfitDetailView() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: outfit, isPending, error } = useOutfit(id)
  const del = useDeleteOutfit()
  const wear = useSaveWearLog(null)
  const [wornToday, setWornToday] = useState(false)

  if (isPending) return null
  if (error || !outfit) return <p className="msg-error">{errorText(error)}</p>

  const unavailable = outfit.items.filter((i) => i.status !== 'active')
  const doneToday = wornToday || outfit.last_worn_on === todayISO()

  async function onDelete() {
    const ok = await confirmDialog({
      title: `删除「${outfitTitle(outfit!)}」？`,
      message: '衣物和穿着记录不受影响。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    del.mutate(id, { onSuccess: () => navigate('/outfits', { replace: true }) })
  }

  function wearToday() {
    wear.mutate(
      { worn_on: todayISO(), outfit_id: id, item_ids: [], notes: null },
      { onSuccess: () => setWornToday(true) },
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/outfits" className={`${s.back} hide-mobile`}>← 搭配</Link>
          <h1>{outfitTitle(outfit)}</h1>
          <p>
            {outfit.items.length} 件 ·{' '}
            {outfit.wear_count ? `穿过 ${outfit.wear_count} 次，上次${formatDay(outfit.last_worn_on!)}` : '还没穿过'}
          </p>
        </div>
      </div>

      {unavailable.length > 0 && (
        <p className={s.warn}>
          {unavailable.map((i) => `${itemTitle(i)}（${labelOf(STATUSES, i.status)}）`).join('、')} 目前不在衣柜里
        </p>
      )}

      <ul className={s.items}>
        {outfit.items.map((it) => (
          <li key={it.id}>
            <Link to={`/wardrobe/${it.id}`} className={s.item}>
              <ItemThumb item={it} />
              <span>{itemTitle(it)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {outfit.notes && <p className={s.notes}>{outfit.notes}</p>}

      {wornToday && <p className="msg-ok">已记录：今天穿了这套。<Link to="/calendar">查看穿着记录</Link></p>}
      {(wear.isError || del.isError) && <p className="msg-error">{errorText(wear.error ?? del.error)}</p>}

      <div className={s.actions}>
        <button className="btn btn-primary" onClick={wearToday} disabled={wear.isPending || doneToday || !outfit.items.length}>
          {doneToday ? '今天已穿 ✓' : '今天穿这套'}
        </button>
        <Link to={`/calendar/new?outfit=${id}`} className="btn">记录到其他日期</Link>
        <Link to={`/outfits/${id}/edit`} className="btn">编辑</Link>
        <button className="btn btn-danger" onClick={onDelete} disabled={del.isPending}>删除</button>
      </div>
    </div>
  )
}
