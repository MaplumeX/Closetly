import { useState } from 'react'
import { imageUrl, itemTitle, toBrief, type ItemBrief } from '@/api'
import { SLOTS, type Slot } from '@/constants'
import { useItems } from '@/hooks/items'
import { useDebounced } from '@/lib/useDebounced'
import s from './ItemPicker.module.css'

/** 从衣柜中挑选单品。上方是已选列表，下方是可按部位、关键词筛选的衣柜。 */
export function ItemPicker({ selected, onChange }: { selected: ItemBrief[]; onChange: (v: ItemBrief[]) => void }) {
  const [slot, setSlot] = useState<Slot | null>(null)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q.trim())

  const query = new URLSearchParams()
  if (slot !== null) query.set('slot', slot)
  if (debouncedQ) query.set('q', debouncedQ)
  const items = useItems(query.toString())

  const selectedIds = new Set(selected.map((i) => i.id))
  const toggle = (item: ItemBrief) =>
    onChange(selectedIds.has(item.id) ? selected.filter((i) => i.id !== item.id) : [...selected, toBrief(item)])

  return (
    <div className={s.picker}>
      <div className={s.tray} aria-live="polite">
        <span className={s.trayLabel}>已选 {selected.length} 件</span>
        {selected.length === 0 && <span className={s.hint}>在下方点选衣物</span>}
        <ul className={s.trayList}>
          {selected.map((it) => (
            <li key={it.id}>
              <button type="button" className={s.trayItem} onClick={() => toggle(it)} aria-label={`移除 ${itemTitle(it)}`}>
                <img src={imageUrl(it.image_key, 'thumb')} alt="" />
                <span className={s.remove} aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={s.browser}>
        <input type="search" placeholder="搜索衣物" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索衣物" />
        <div className={s.tabs} role="tablist" aria-label="部位">
          <button type="button" role="tab" aria-selected={slot === null} onClick={() => setSlot(null)}>全部</button>
          {SLOTS.map((c) => (
            <button key={c.value} type="button" role="tab" aria-selected={slot === c.value} onClick={() => setSlot(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        {items.data?.length === 0 && <p className="muted">没有找到衣物</p>}
        <ul className={s.grid}>
          {items.data?.map((it) => (
            <li key={it.id}>
              <button type="button" className={s.option} aria-pressed={selectedIds.has(it.id)} onClick={() => toggle(it)}>
                <img src={imageUrl(it.image_key, 'thumb')} alt="" loading="lazy" />
                <span className={s.name}>{itemTitle(it)}</span>
                <span className={s.check} aria-hidden="true">✓</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
