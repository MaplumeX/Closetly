import { useState } from 'react'
import { itemTitle, toBrief, type Item, type ItemBrief } from '@/api'
import { labelOf, SLOTS, type Slot } from '@/constants'
import { useItems } from '@/hooks/items'
import { coveredSlots, mismatchReason, missingSlots, profileOf, profileText } from '@/lib/outfit'
import { useDebounced } from '@/lib/useDebounced'
import { ItemThumb } from './ItemThumb'
import s from './ItemPicker.module.css'

/**
 * 部位格子像人体一样排：竖着从上到下（上身 → 下身 → 脚），横着从里到外
 * （贴身的上装、下装 → 套在外面的连体 → 外套）。位置由 CSS grid-template-areas 决定，
 * 这里的顺序是键盘 Tab 的顺序。
 */
const BOARD: readonly Slot[] = ['top', 'bottom', 'onepiece', 'outer', 'shoes', 'accessory']
const SHORT_LABEL: Partial<Record<Slot, string>> = { onepiece: '连体' }
const slotLabel = (slot: Slot) => SHORT_LABEL[slot] ?? labelOf(SLOTS, slot)

/**
 * 按部位挑选单品。宽屏时左边是部位格子（人体示意），右边是衣柜；窄屏时上下排列。
 * 部位格子显示每个部位已选的单品，点格子切换衣柜显示的部位；衣柜可按关键词搜索。
 * 选满一个空着的部位后，自动跳到下一个还缺的部位（上装 → 下装 → 鞋）。
 * 部位只用来引导和提示，不限制每个部位选几件（例如叠穿两件上装）；同一格有多件时缩略图两列并排。
 *
 * 已经选了单品时，衣柜分成两组：和已选单品合得来的排在前面，其余的（季节、场合对不上，
 * 或者不在衣柜里）排在后面并标出原因，仍然可以选。规则见 lib/outfit.ts 的 mismatchReason。
 * checkStatus：是否把送洗、闲置等状态算作不合适；补记过去的穿着时应关掉。
 */
export function ItemPicker({
  selected,
  onChange,
  checkStatus = true,
}: {
  selected: ItemBrief[]
  onChange: (v: ItemBrief[]) => void
  checkStatus?: boolean
}) {
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
  const profile = profileOf(selected)

  const suggested: Item[] = []
  const others: { item: Item; reason: string }[] = []
  for (const it of items.data ?? []) {
    const reason = selected.length && !selectedIds.has(it.id) ? mismatchReason(it, profile, checkStatus) : null
    if (reason) others.push({ item: it, reason })
    else suggested.push(it)
  }

  const option = (it: Item, reason?: string) => (
    <li key={it.id}>
      <button type="button" className={s.option} aria-pressed={selectedIds.has(it.id)} onClick={() => toggle(it)}
        data-mismatch={reason ? true : undefined}>
        <ItemThumb item={it} />
        <span className={s.name}>{itemTitle(it)}</span>
        {reason && <span className={s.reason}>{reason}</span>}
        <span className={s.check} aria-hidden="true">✓</span>
      </button>
    </li>
  )

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
          {selected.length > 0 && <span className={s.hint}>{profileText({ ...profile, items: selected })}</span>}
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
              <li key={b} className={s.slot} data-slot={b} data-active={slot === b || undefined}>
                <button type="button" className={s.slotHead} aria-pressed={slot === b} onClick={() => setSlot(b)}>
                  <span>{slotLabel(b)}</span>
                  {picked.length > 1 && <span className={s.count}>{picked.length} 件</span>}
                </button>
                {picked.length === 0 ? (
                  <button type="button" className={s.placeholder} onClick={() => setSlot(b)} tabIndex={-1}>
                    {covered.has(b) ? '可不选' : '＋'}
                  </button>
                ) : (
                  <ul className={s.picked} data-many={picked.length > 1 || undefined}>
                    {picked.map((it) => (
                      <li key={it.id}>
                        <button type="button" className={s.pickedItem} onClick={() => toggle(it)} aria-label={`移除 ${itemTitle(it)}`}>
                          <ItemThumb item={it} detail={false} />
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
        {items.data && items.data.length > 0 && suggested.length === 0 && (
          <p className="muted">没有和已选单品合得来的{slot === null ? '衣物' : slotLabel(slot)}，下面的仅供参考</p>
        )}
        <ul className={s.grid}>{suggested.map((it) => option(it))}</ul>
        {suggested.length > 0 && others.length > 0 && (
          <p className={s.divider}>不太合适：和已选单品季节、场合对不上，或者不在衣柜里</p>
        )}
        {others.length > 0 && <ul className={s.grid}>{others.map(({ item, reason }) => option(item, reason))}</ul>}
      </div>
    </div>
  )
}
