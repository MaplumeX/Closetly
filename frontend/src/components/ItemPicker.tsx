import { useState } from 'react'
import { imageUrl, itemTitle, toBrief, type ItemBrief } from '@/api'
import { labelOf, SLOTS, type Slot } from '@/constants'
import { useItems } from '@/hooks/items'
import { coveredSlots, missingSlots } from '@/lib/outfit'
import { useDebounced } from '@/lib/useDebounced'
import s from './ItemPicker.module.css'

/** 部位格子的顺序：从上到下，连体紧跟在上装、下装后面 */
const BOARD: readonly Slot[] = ['outer', 'top', 'bottom', 'onepiece', 'shoes', 'accessory']
const SHORT_LABEL: Partial<Record<Slot, string>> = { onepiece: '连体' }
const slotLabel = (slot: Slot) => SHORT_LABEL[slot] ?? labelOf(SLOTS, slot)

/**
 * 按部位挑选单品。上方是部位格子：显示每个部位已选的单品，点格子切换下方衣柜的部位；
 * 下方是衣柜，可按关键词搜索。
 * 选满一个空着的部位后，自动跳到下一个还缺的部位（上装 → 下装 → 鞋）。
 * 部位只用来引导和提示，不限制每个部位选几件（例如叠穿两件上装）。
 */
export function ItemPicker({ selected, onChange }: { selected: ItemBrief[]; onChange: (v: ItemBrief[]) => void }) {
  const [slot, setSlot] = useState<Slot | null>(() => missingSlots(selected)[0] ?? null)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q.trim())

  const query = new URLSearchParams()
  if (slot !== null) query.set('slot', slot)
  if (debouncedQ) query.set('q', debouncedQ)
  const items = useItems(query.toString())

  const selectedIds = new Set(selected.map((i) => i.id))
  const covered = coveredSlots(selected)
  const missing = missingSlots(selected)

  function toggle(item: ItemBrief) {
    if (selectedIds.has(item.id)) {
      onChange(selected.filter((i) => i.id !== item.id))
      return
    }
    const next = [...selected, toBrief(item)]
    onChange(next)
    const filledEmptySlot = slot === item.slot && !selected.some((i) => i.slot === item.slot)
    if (filledEmptySlot) setSlot(missingSlots(next)[0] ?? slot)
  }

  return (
    <div className={s.picker}>
      <div className={s.board}>
        <div className={s.boardHead} aria-live="polite">
          <span className={s.boardLabel}>已选 {selected.length} 件</span>
          {selected.length > 0 && missing.length > 0 && (
            <span className={s.hint}>还没选：{missing.map(slotLabel).join('、')}</span>
          )}
          {selected.length > 0 && missing.length === 0 && <span className={s.hint}>可以出门了 ✓</span>}
          <button type="button" className={s.all} aria-pressed={slot === null} onClick={() => setSlot(null)}>
            浏览全部
          </button>
        </div>
        <ul className={s.slots}>
          {BOARD.map((b) => {
            const picked = selected.filter((i) => i.slot === b)
            return (
              <li key={b} className={s.slot} data-active={slot === b || undefined}>
                <button type="button" className={s.slotHead} aria-pressed={slot === b} onClick={() => setSlot(b)}>
                  <span>{slotLabel(b)}</span>
                  {picked.length > 1 && <span className={s.count}>{picked.length}</span>}
                </button>
                {picked.length === 0 ? (
                  <button type="button" className={s.placeholder} onClick={() => setSlot(b)} tabIndex={-1}>
                    {covered.has(b) ? '可不选' : '＋'}
                  </button>
                ) : (
                  <ul className={s.picked}>
                    {picked.map((it) => (
                      <li key={it.id}>
                        <button type="button" className={s.pickedItem} onClick={() => toggle(it)} aria-label={`移除 ${itemTitle(it)}`}>
                          <img src={imageUrl(it.image_key, 'thumb')} alt="" />
                          <span className={s.remove} aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className={s.browser}>
        <div className={s.browserHead}>
          <h3>{slot === null ? '全部衣物' : `选${slotLabel(slot)}`}</h3>
          <input type="search" placeholder="搜索衣物" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索衣物" />
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
