import { imageUrl, type ItemBrief } from '@/api'
import s from './OutfitCollage.module.css'

/** 搭配封面：最多显示 4 张单品缩略图，多出的显示 +N */
export function OutfitCollage({ items }: { items: ItemBrief[] }) {
  const shown = items.slice(0, 4)
  const extra = items.length - shown.length
  return (
    <div className={s.collage} data-count={Math.min(items.length, 4)}>
      {shown.map((it, i) => (
        <div key={it.id} className={s.cell}>
          <img src={imageUrl(it.image_key, 'thumb')} alt="" loading="lazy" />
          {extra > 0 && i === shown.length - 1 && <span className={s.more}>+{extra}</span>}
        </div>
      ))}
      {items.length === 0 && <span className={s.empty}>没有单品</span>}
    </div>
  )
}
