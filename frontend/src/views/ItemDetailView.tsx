import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { errorText, imageUrl, itemCategory, itemTitle, outfitTitle, type Item } from '@/api'
import { ColorDot } from '@/components/Chips'
import { Group, Groups, OccasionChips, SeasonBar, StatsCard, WarmthRange, type Stat } from '@/components/DetailParts'
import { ItemThumb } from '@/components/ItemThumb'
import { confirmDialog } from '@/components/dialogs'
import { Menu } from '@/components/Menu'
import { OutfitCollage } from '@/components/OutfitCollage'
import { CUTS, FITS, labelOf, STATUSES } from '@/constants'
import { usePalette } from '@/hooks/colors'
import { useDeleteItem, useItem, useUpdateItem } from '@/hooks/items'
import { useOutfits, useSaveWearLog } from '@/hooks/outfits'
import { daysSince, formatDay, formatLong, todayISO } from '@/lib/date'
import { canPasteOrDrop, usePhotoUpload } from '@/lib/usePhotoUpload'
import s from './ItemDetailView.module.css'

export default function ItemDetailView() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: item, isPending, error } = useItem(id)
  const update = useUpdateItem(id)
  const del = useDeleteItem()
  const wear = useSaveWearLog(null)
  const outfits = useOutfits(id)
  const palette = usePalette()

  if (isPending) return null
  if (error || !item) return <p className="msg-error">{errorText(error)}</p>

  async function onDelete() {
    const ok = await confirmDialog({
      title: `删除「${itemTitle(item!)}」？`,
      message: '它也会从所有搭配和穿着记录中移除，无法恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    del.mutate(id, { onSuccess: () => navigate('/wardrobe', { replace: true }) })
  }

  const color = palette.find((c) => c.value === item.color)
  const wornToday = item.last_worn_on === todayISO()
  const purchase = [item.brand, item.price != null && `¥${item.price.toFixed(2)}`, item.purchase_date && formatLong(item.purchase_date)]
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <header className={s.head}>
        <div className={s.titleBlock}>
          <Link to="/wardrobe" className={`${s.back} hide-mobile`}>← 衣柜</Link>
          <h1>{itemTitle(item)}</h1>
          <div className={s.subtitle}>
            <Menu
              aria-label={`状态：${labelOf(STATUSES, item.status)}，点击修改`}
              triggerClassName={s.status}
              disabled={update.isPending}
              trigger={
                <>
                  <span className={s.statusDot} data-status={item.status} aria-hidden="true" />
                  {labelOf(STATUSES, item.status)}
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </>
              }
              items={STATUSES.map((o) => ({
                key: o.value,
                label: o.label,
                selected: o.value === item.status,
                onSelect: () => o.value !== item.status && update.mutate({ status: o.value }),
              }))}
            />
            <span>{itemCategory(item)}</span>
            {color && (
              <span className={s.color}>
                <ColorDot swatch={color.swatch} />
                {color.label}
              </span>
            )}
          </div>
        </div>

        <div className={s.headActions}>
          <Link to={`/outfits/new?with=${id}`} className="btn btn-primary">用它搭配</Link>
          <Link to={`/wardrobe/${id}/edit`} className="btn">编辑</Link>
          <Menu
            aria-label="更多操作"
            align="right"
            triggerClassName={`btn ${s.more}`}
            trigger={<span aria-hidden="true">⋯</span>}
            items={[
              { key: 'copy', label: '复制为新衣物', onSelect: () => navigate(`/wardrobe/new?from=${id}`) },
              { key: 'delete', label: '删除', danger: true, onSelect: onDelete },
            ]}
          />
        </div>
      </header>

      {(update.isError || del.isError || wear.isError) && (
        <p className={`msg-error ${s.error}`}>{errorText(update.error ?? del.error ?? wear.error)}</p>
      )}

      <div className={s.layout}>
        {item.image_key ? (
          <a href={imageUrl(item.image_key)} target="_blank" rel="noreferrer" className={s.photo}>
            <ItemThumb item={item} size="full" alt={itemTitle(item)} />
          </a>
        ) : (
          <AddPhoto onUploaded={(key) => update.mutateAsync({ image_key: key })}>
            <ItemThumb item={item} alt={itemTitle(item)} />
          </AddPhoto>
        )}

        <div className={s.info}>
          <StatsCard label="穿着情况" {...wearStats(item)}>
            <button className="btn btn-sm" disabled={wear.isPending || wornToday}
              onClick={() => wear.mutate({ worn_on: todayISO(), item_ids: [id], notes: null })}>
              {wornToday ? '今天已穿 ✓' : '今天穿了它'}
            </button>
            <Link to={`/calendar/new?item=${id}`} className="btn btn-sm">记录到其他日期</Link>
          </StatsCard>

          <Groups>
            <Group label="适合">
              {item.seasons.length > 0 && <SeasonBar seasons={item.seasons} />}
              {item.occasions.length > 0 && <OccasionChips occasions={item.occasions} />}
              {item.warmth && <WarmthRange min={item.warmth} max={item.warmth} />}
            </Group>
            <Group label="版型">
              {[labelOf(FITS, item.fit), labelOf(CUTS, item.cut)].filter(Boolean).join(' · ')}
            </Group>
            <Group label="购买">{purchase}</Group>
            <Group label="收纳">{item.location}</Group>
            <Group label="标签">
              {item.tags.length > 0 && (
                <div className={s.tags}>
                  {item.tags.map((t) => (
                    <Link key={t} to={`/wardrobe?tag=${encodeURIComponent(t)}`} className={s.tag}>#{t}</Link>
                  ))}
                </div>
              )}
            </Group>
            <Group label="备注">{item.notes && <p className={s.notes}>{item.notes}</p>}</Group>
          </Groups>
        </div>
      </div>

      <section className={s.outfits}>
        <h2>{outfits.data?.length ? `出现在 ${outfits.data.length} 套搭配中` : '搭配'}</h2>
        {outfits.data && outfits.data.length > 0 ? (
          <ul>
            {outfits.data.map((o) => (
              <li key={o.id}>
                <Link to={`/outfits/${o.id}`}>
                  <OutfitCollage items={o.items} />
                  <span>{outfitTitle(o)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          outfits.data && (
            <div className={s.empty}>
              <p>还没有搭配用到这件衣物。</p>
              <Link to={`/outfits/new?with=${id}`} className="btn btn-sm">用它搭配一套</Link>
            </div>
          )
        )}
      </section>
    </div>
  )
}

function wearStats(item: Item): { stats: Stat[]; hint: string | null } {
  const stats: Stat[] = [
    { label: '穿过', value: `${item.wear_count} 次` },
    { label: '上次穿', value: item.last_worn_on ? formatDay(item.last_worn_on) : '—' },
  ]
  if (item.price != null) {
    const per = item.wear_count ? item.price / item.wear_count : null
    stats.push({ label: '每次成本', value: per === null ? '—' : `¥${per.toFixed(per >= 100 ? 0 : 1)}` })
  }

  let hint: string | null = null
  if (!item.wear_count && item.purchase_date && daysSince(item.purchase_date) > 0) {
    hint = `买了 ${daysSince(item.purchase_date)} 天，还没穿过`
  } else if (item.last_worn_on && daysSince(item.last_worn_on) >= 90) {
    hint = `已经 ${daysSince(item.last_worn_on)} 天没穿了`
  }
  return { stats, hint }
}

/** 没有照片的衣物：在详情页直接补上照片（选择、粘贴或拖到剪影上） */
function AddPhoto({ onUploaded, children }: { onUploaded: (key: string) => Promise<unknown>; children: ReactNode }) {
  const { busy, error, dragging, pick, inputProps, dropProps } = usePhotoUpload(onUploaded)

  return (
    <div className={`${s.photo} ${s.noPhoto} ${dragging ? s.dragging : ''}`} {...dropProps}>
      {children}
      <div className={s.addPhoto}>
        <button type="button" className="btn btn-sm" onClick={pick} disabled={busy}>
          {busy ? '上传中…' : '补拍照片'}
        </button>
        {canPasteOrDrop && !busy && !error && <p className={s.hint}>也可以直接粘贴或拖入图片</p>}
        {error && <p className="msg-error" role="alert">{error}</p>}
        <input {...inputProps} />
      </div>
    </div>
  )
}
