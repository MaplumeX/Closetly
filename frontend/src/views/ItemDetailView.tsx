import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { errorText, imageUrl, itemTitle } from '@/api'
import { ColorDot } from '@/components/Chips'
import { COLORS, labelOf, OCCASIONS, SEASONS, STATUSES, WARMTH_LABELS, type ItemStatus } from '@/constants'
import { useDeleteItem, useItem, useUpdateItem } from '@/hooks/items'
import s from './ItemDetailView.module.css'

export default function ItemDetailView() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: item, isPending, error } = useItem(id)
  const update = useUpdateItem(id)
  const del = useDeleteItem()

  if (isPending) return null
  if (error || !item) return <p className="msg-error">{errorText(error)}</p>

  function onDelete() {
    if (!window.confirm(`确定删除「${itemTitle(item!)}」吗？它也会从所有搭配和穿着记录中移除，无法恢复。`)) return
    del.mutate(id, { onSuccess: () => navigate('/wardrobe', { replace: true }) })
  }

  const colorNode = item.color && (
    <span className={s.color}>
      <ColorDot color={item.color} />
      {labelOf(COLORS, item.color)}
    </span>
  )
  const rows: { label: string; value: ReactNode }[] = [
    { label: '分类', value: item.category_path },
    { label: '季节', value: item.seasons.map((v) => labelOf(SEASONS, v)).join(' · ') },
    { label: '主色', value: colorNode },
    { label: '场合', value: item.occasions.map((v) => labelOf(OCCASIONS, v)).join(' · ') },
    { label: '保暖度', value: item.warmth && `${item.warmth} · ${WARMTH_LABELS[item.warmth]}` },
    { label: '品牌', value: item.brand },
    { label: '价格', value: item.price != null && `¥${item.price.toFixed(2)}` },
    { label: '购买日期', value: item.purchase_date },
    { label: '收纳位置', value: item.location },
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/wardrobe" className={s.back}>← 衣柜</Link>
          <h1>{itemTitle(item)}</h1>
        </div>
      </div>

      <div className={s.layout}>
        <a href={imageUrl(item.image_key)} target="_blank" rel="noreferrer" className={s.photo}>
          <img src={imageUrl(item.image_key)} alt={itemTitle(item)} />
        </a>

        <div className={s.info}>
          <label className={`field ${s.status}`}>
            <span>状态</span>
            <select value={item.status} disabled={update.isPending}
              onChange={(e) => update.mutate({ status: e.target.value as ItemStatus })}>
              {STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <dl className={s.attrs}>
            {rows.filter((r) => r.value).map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>

          {item.tags.length > 0 && (
            <div className={s.tags}>
              {item.tags.map((t) => (
                <Link key={t} to={`/wardrobe?tag=${encodeURIComponent(t)}`} className={s.tag}>#{t}</Link>
              ))}
            </div>
          )}
          {item.notes && <p className={s.notes}>{item.notes}</p>}

          {(update.isError || del.isError) && <p className="msg-error">{errorText(update.error ?? del.error)}</p>}

          <div className={s.actions}>
            <Link to={`/wardrobe/${id}/edit`} className="btn btn-primary">编辑</Link>
            <Link to={`/wardrobe/new?from=${id}`} className="btn">复制为新衣物</Link>
            <button className="btn btn-danger" onClick={onDelete} disabled={del.isPending}>删除</button>
          </div>
        </div>
      </div>
    </div>
  )
}
