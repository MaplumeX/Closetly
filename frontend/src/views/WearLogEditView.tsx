import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { errorText, outfitTitle, toBrief, type ItemBrief, type Outfit } from '@/api'
import { DateInput } from '@/components/DateInput'
import { ItemPicker } from '@/components/ItemPicker'
import { OutfitCollage } from '@/components/OutfitCollage'
import { useItem } from '@/hooks/items'
import { useOutfit, useOutfits, useSaveWearLog, useWearLog } from '@/hooks/outfits'
import { monthOf, todayISO } from '@/lib/date'
import s from './WearLogEditView.module.css'

interface Initial {
  worn_on: string
  outfit: Outfit | null
  items: ItemBrief[]
  notes: string
}

/**
 * /calendar/new?date=YYYY-MM-DD&outfit=:id   新建（可预选日期和搭配）
 * /calendar/new?item=:id                     新建并预选一件衣物
 * /calendar/:id/edit                         编辑
 */
export default function WearLogEditView() {
  const raw = useParams().id
  const id = raw ? Number(raw) : null
  const [search] = useSearchParams()
  const outfitParam = search.get('outfit') ? Number(search.get('outfit')) : null
  const log = useWearLog(id)
  const preset = useOutfit(id === null ? outfitParam : null)
  const itemParam = search.get('item') ? Number(search.get('item')) : null
  const presetItem = useItem(id === null && outfitParam === null ? itemParam : null)

  if ((id !== null && log.isPending) || (id === null && outfitParam !== null && preset.isPending)) return null
  if (id === null && outfitParam === null && itemParam !== null && presetItem.isPending) return null
  if (log.isError) return <p className="msg-error">{errorText(log.error)}</p>

  const initial: Initial = log.data
    ? { worn_on: log.data.worn_on, outfit: null, items: log.data.items, notes: log.data.notes ?? '' }
    : {
        worn_on: search.get('date') ?? todayISO(),
        outfit: preset.data ?? null,
        items: preset.data?.items ?? (presetItem.data ? [toBrief(presetItem.data)] : []),
        notes: '',
      }
  return <WearLogForm id={id} initial={initial} />
}

function WearLogForm({ id, initial }: { id: number | null; initial: Initial }) {
  const navigate = useNavigate()
  const outfits = useOutfits()
  const save = useSaveWearLog(id)
  const [wornOn, setWornOn] = useState(initial.worn_on)
  const [outfit, setOutfit] = useState<Outfit | null>(initial.outfit)
  const [items, setItems] = useState(initial.items)
  const [notes, setNotes] = useState(initial.notes)
  const [tried, setTried] = useState(false)

  function pickOutfit(o: Outfit | null) {
    setOutfit(o)
    if (o) setItems(o.items)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!items.length || !wornOn) return
    save.mutate(
      { worn_on: wornOn, outfit_id: outfit?.id ?? null, item_ids: items.map((i) => i.id), notes: notes.trim() || null },
      { onSuccess: (log) => navigate(`/calendar?month=${monthOf(log.worn_on)}&day=${log.worn_on}`, { replace: true }) },
    )
  }

  const back = `/calendar?month=${monthOf(initial.worn_on)}&day=${initial.worn_on}`
  const saveButton = (
    <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? '保存中…' : '保存'}</button>
  )

  return (
    <form onSubmit={submit} noValidate>
      <div className="page-head">
        <div>
          <h1>{id ? '编辑穿着记录' : '记录穿着'}</h1>
        </div>
        <Link to={back} className="btn hide-mobile">取消</Link>
      </div>

      <div className={s.form}>
        <div className={s.row}>
          <div className="field">
            <span>日期</span>
            <DateInput aria-label="日期" value={wornOn} onChange={setWornOn} />
          </div>
          <label className="field">
            <span>备注</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="例如：面试、下雨" />
          </label>
        </div>

        {/* 编辑时不能改来源搭配（记录保存的是单品快照） */}
        {!id && outfits.data && outfits.data.length > 0 && (
          <div className="field">
            <span>从搭配开始（可选，选好后还能增减单品）</span>
            <ul className={s.outfits}>
              {outfits.data.map((o) => (
                <li key={o.id}>
                  <button type="button" className={s.outfit} aria-pressed={outfit?.id === o.id}
                    onClick={() => pickOutfit(outfit?.id === o.id ? null : o)}>
                    <OutfitCollage items={o.items} />
                    <span>{outfitTitle(o)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="field">
          <span>穿了哪些衣物</span>
          {/* 补记的可能是以前穿的，衣物现在送洗或闲置不代表当时不能穿 */}
          <ItemPicker selected={items} onChange={setItems} checkStatus={false} />
        </div>

        {tried && !items.length && <p className="msg-error" role="alert">请至少选择一件衣物</p>}
        {tried && !wornOn && <p className="msg-error" role="alert">请选择日期</p>}
        {save.isError && <p className="msg-error" role="alert">{errorText(save.error)}</p>}
        <div className={s.actions}>{saveButton}</div>
      </div>
    </form>
  )
}
