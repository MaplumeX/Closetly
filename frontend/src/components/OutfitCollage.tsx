import type { ItemBrief } from '@/api'
import { isMainSlot, sortBySlot } from '@/lib/outfit'
import { ItemThumb } from './ItemThumb'
import s from './OutfitCollage.module.css'

const MAX_MAIN = 2
const MAX_SIDE = 3
const MAX_GRID = 4

/**
 * 搭配封面，按部位排版：
 * - 同时有主体（上装、下装、连体）和其他单品时，左边大格放主体，右边一列放外套、鞋、配饰；
 * - 只有其中一类时，退回普通网格，最多 4 张。
 * 放不下的单品在最后一格显示 +N。
 */
export function OutfitCollage({ items }: { items: ItemBrief[] }) {
  const sorted = sortBySlot(items)
  const main = sorted.filter((i) => isMainSlot(i.slot))
  const side = sorted.filter((i) => !isMainSlot(i.slot))

  if (main.length && side.length) {
    const mainShown = main.slice(0, MAX_MAIN)
    const sideShown = side.slice(0, MAX_SIDE)
    const extra = items.length - mainShown.length - sideShown.length
    return (
      <div className={`${s.collage} ${s.split}`}>
        <div className={s.col}>
          {mainShown.map((it) => <Cell key={it.id} item={it} />)}
        </div>
        <div className={s.col}>
          {sideShown.map((it, i) => <Cell key={it.id} item={it} extra={i === sideShown.length - 1 ? extra : 0} />)}
        </div>
      </div>
    )
  }

  const shown = sorted.slice(0, MAX_GRID)
  const extra = items.length - shown.length
  return (
    <div className={s.collage} data-count={shown.length}>
      {shown.map((it, i) => <Cell key={it.id} item={it} extra={i === shown.length - 1 ? extra : 0} />)}
      {items.length === 0 && <span className={s.empty}>没有单品</span>}
    </div>
  )
}

function Cell({ item, extra = 0 }: { item: ItemBrief; extra?: number }) {
  return (
    <div className={s.cell}>
      <ItemThumb item={item} detail={false} />
      {extra > 0 && <span className={s.more}>+{extra}</span>}
    </div>
  )
}
