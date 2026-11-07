import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { errorText, toBrief, type ItemBrief, type Outfit } from '@/api'
import { ItemPicker } from '@/components/ItemPicker'
import { useItem } from '@/hooks/items'
import { useOutfit, useSaveOutfit } from '@/hooks/outfits'
import s from './OutfitEditView.module.css'

/**
 * /outfits/new            新建
 * /outfits/new?with=:id   新建，并预选一件衣物（从衣物详情页「用它搭配」进入）
 * 路由 state.preset        新建，并预选多件衣物（从今日推荐「存为搭配」进入）
 * /outfits/:id/edit       编辑
 */
export default function OutfitEditView() {
  const raw = useParams().id
  const id = raw ? Number(raw) : null
  const withParam = useSearchParams()[0].get('with')
  const withId = id === null && withParam ? Number(withParam) : null
  const outfit = useOutfit(id)
  const preset = useItem(withId)
  const statePreset = (useLocation().state as { preset?: ItemBrief[] } | null)?.preset
  if ((id !== null && outfit.isPending) || (withId !== null && preset.isPending)) return null
  if (outfit.isError) return <p className="msg-error">{errorText(outfit.error)}</p>
  const presetItems = statePreset?.map(toBrief) ?? (preset.data ? [toBrief(preset.data)] : [])
  return <OutfitForm id={id} initial={outfit.data} preset={presetItems} />
}

function OutfitForm({ id, initial, preset }: { id: number | null; initial?: Outfit; preset: ItemBrief[] }) {
  const navigate = useNavigate()
  const save = useSaveOutfit(id)
  const [name, setName] = useState(initial?.name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [items, setItems] = useState<ItemBrief[]>(initial?.items ?? preset)
  const [tried, setTried] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!items.length) return
    save.mutate(
      { name: name.trim() || null, notes: notes.trim() || null, item_ids: items.map((i) => i.id) },
      { onSuccess: (o) => navigate(`/outfits/${o.id}`, { replace: true }) },
    )
  }

  const saveButton = (
    <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? '保存中…' : '保存'}</button>
  )

  return (
    <form onSubmit={submit} noValidate>
      <div className="page-head">
        <div>
          <h1>{id ? '编辑搭配' : '新建搭配'}</h1>
        </div>
        <div className={`${s.headActions} hide-mobile`}>
          <Link to={id ? `/outfits/${id}` : '/outfits'} className="btn">取消</Link>
          {saveButton}
        </div>
      </div>

      <div className={s.meta}>
        <label className="field">
          <span>名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} placeholder="例如：周一通勤" />
        </label>
        <label className="field">
          <span>备注</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={1} />
        </label>
      </div>
      {tried && !items.length && <p className="msg-error" role="alert">请至少选择一件衣物</p>}
      {save.isError && <p className="msg-error" role="alert">{errorText(save.error)}</p>}

      <ItemPicker selected={items} onChange={setItems} />
      {/* 手机上先选衣物，保存按钮放在最后 */}
      <div className={`${s.mobileSave} show-mobile`}>{saveButton}</div>
    </form>
  )
}
