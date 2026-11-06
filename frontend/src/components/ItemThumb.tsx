import { imageUrl, type Item } from '@/api'
import { useSilhouetteFill } from '@/hooks/colors'
import { resolveShape } from '@/lib/silhouette'
import { Silhouette } from './Silhouette'

type ThumbItem = Pick<Item, 'image_key' | 'slot' | 'kind' | 'name' | 'color'>

interface Props {
  item: ThumbItem
  /** 照片尺寸：列表里用缩略图，详情页用原图 */
  size?: 'thumb' | 'full'
  alt?: string
  /** 没有照片时，右下角显示相机标记提示还没拍照 */
  hint?: boolean
  /** 没有照片时画领口、缝线等细节；拼图、日历这类很小的图关掉更干净 */
  detail?: boolean
  className?: string
}

/**
 * 衣物的图：有照片显示照片，没有照片显示按部位、类型和主色生成的剪影。
 * 两种情况都带 data-thumb，各页面的样式统一用 `[data-thumb]` 选择。
 */
export function ItemThumb({ item, size = 'thumb', alt = '', hint, detail = true, className }: Props) {
  const fill = useSilhouetteFill(item.color)
  if (item.image_key) {
    return <img data-thumb src={imageUrl(item.image_key, size)} alt={alt} loading="lazy" className={className} />
  }
  return (
    <Silhouette shape={resolveShape(item.slot, item.kind, item.name)} fill={fill} hint={hint} detail={detail}
      className={className} label={alt} />
  )
}
