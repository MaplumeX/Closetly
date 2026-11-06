import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorText, itemKind, itemTitle, type Item } from '@/api'
import { ChipGroup, ChipSelect, ColorDot, ColorSwatches } from '@/components/Chips'
import { labelOf, OCCASIONS, SEASONS, SLOTS, STATUSES, type ItemStatus, type Occasion, type Season, type Slot } from '@/constants'
import { usePalette, type PaletteColor } from '@/hooks/colors'
import { useItems, useKinds, useTags } from '@/hooks/items'
import { ItemThumb } from '@/components/ItemThumb'
import s from './WardrobeView.module.css'

/** 面板里的多选筛选项；URL 参数名与后端接口一致 */
const LIST_PARAMS = ['season', 'color', 'occasion', 'status', 'tag'] as const

/** 照片是单选：photo=false 只看还没拍照的，方便集中补拍 */
const PHOTO_OPTIONS = [
  { value: 'false', label: '还没有照片' },
  { value: 'true', label: '有照片' },
] as const
type PhotoFilter = (typeof PHOTO_OPTIONS)[number]['value']

export default function WardrobeView() {
  const [params, setParams] = useSearchParams()
  const { data: tags } = useTags()
  const palette = usePalette()
  const items = useItems(params.toString())
  const [panelOpen, setPanelOpen] = useState(false)

  // ---- URL 参数读写 ----
  const list = (k: string) => params.getAll(k)
  // 基于最新参数修改（函数式更新），避免延迟写入时覆盖刚改过的条件
  const update = useCallback(
    (fn: (p: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          fn(next)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const setList = (k: string) => (values: string[]) =>
    update((p) => {
      p.delete(k)
      values.forEach((v) => p.append(k, v))
    })
  /** 切换部位时清掉类型，因为类型是挂在部位下面的 */
  const setSlot = (v: Slot | null) =>
    update((p) => {
      p.delete('kind')
      if (v === null) p.delete('slot')
      else p.set('slot', v)
    })
  const setKind = (v: string | null) => update((p) => (v === null ? p.delete('kind') : p.set('kind', v)))

  // ---- 搜索框：输入停顿 300ms 后再写入 URL ----
  const [q, setQ] = useState(params.get('q') ?? '')
  const urlQ = params.get('q') ?? ''
  useEffect(() => {
    if (urlQ === q.trim()) return
    const t = setTimeout(() => update((p) => (q.trim() ? p.set('q', q.trim()) : p.delete('q'))), 300)
    return () => clearTimeout(t)
  }, [q, urlQ, update])

  // ---- 分类：部位标签页 + 该部位下用过的类型 ----
  const slot = (SLOTS.find((x) => x.value === params.get('slot'))?.value ?? null) as Slot | null
  const kind = params.get('kind')
  const { data: kinds } = useKinds(slot)
  const kindOptions = useMemo(() => (kinds ?? []).map((k) => ({ value: k.name, label: `${k.name} ${k.count}` })), [kinds])

  const photo = (PHOTO_OPTIONS.find((o) => o.value === params.get('photo'))?.value ?? null) as PhotoFilter | null
  const setPhoto = (v: PhotoFilter | null) => update((p) => (v === null ? p.delete('photo') : p.set('photo', v)))

  const panelCount = LIST_PARAMS.reduce((n, k) => n + list(k).length, 0) + (photo ? 1 : 0)
  const anyFilter = panelCount > 0 || slot !== null || !!params.get('q')

  function clearAll() {
    setQ('')
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>衣柜</h1>
          <p>{items.data ? `${items.data.length} 件${anyFilter ? '符合条件' : ''}` : ' '}</p>
        </div>
        <Link to="/wardrobe/new" className="btn btn-primary">＋ 添加衣物</Link>
      </div>

      <div className={s.toolbar}>
        <input type="search" className={s.search} placeholder="搜索名称、品牌、备注、收纳位置" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="搜索" />
        <button className="btn" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>
          筛选{panelCount > 0 && <span className={s.count}>{panelCount}</span>}
        </button>
      </div>

      <nav className={s.tabs} aria-label="部位">
        <button className={s.tab} aria-pressed={slot === null} onClick={() => setSlot(null)}>全部</button>
        {SLOTS.map((t) => (
          <button key={t.value} className={s.tab} aria-pressed={slot === t.value} onClick={() => setSlot(t.value)}>
            {t.label}
          </button>
        ))}
      </nav>
      {slot && kindOptions.length > 0 && (
        <div className={s.subTabs}>
          <ChipSelect label="类型" options={kindOptions} value={kind} onChange={setKind} />
        </div>
      )}

      {panelOpen && (
        <div className={`card ${s.panel}`}>
          <Filter label="季节">
            <ChipGroup label="季节" options={SEASONS} value={list('season') as Season[]} onChange={setList('season')} />
          </Filter>
          <Filter label="场合">
            <ChipGroup label="场合" options={OCCASIONS} value={list('occasion') as Occasion[]} onChange={setList('occasion')} />
          </Filter>
          <Filter label="状态" hint="不选时显示除「已淘汰」以外的全部">
            <ChipGroup label="状态" options={STATUSES} value={list('status') as ItemStatus[]} onChange={setList('status')} />
          </Filter>
          <Filter label="照片">
            <ChipSelect label="照片" options={PHOTO_OPTIONS} value={photo} onChange={setPhoto} />
          </Filter>
          <Filter label="主色">
            <ColorSwatches label="主色" options={palette} value={list('color')} onChange={setList('color')} />
          </Filter>
          {tags && tags.length > 0 && (
            <Filter label="标签">
              <ChipGroup label="标签" options={tags.map((t) => ({ value: t.name, label: `${t.name} ${t.count}` }))}
                value={list('tag')} onChange={setList('tag')} />
            </Filter>
          )}
          <div>
            <button className="btn btn-sm" onClick={clearAll} disabled={!anyFilter}>清除全部条件</button>
          </div>
        </div>
      )}

      {items.isError && <p className="msg-error">{errorText(items.error)}</p>}
      {items.data && items.data.length === 0 && (
        <div className={`card ${s.empty}`}>
          {anyFilter ? (
            <>
              <p>没有符合条件的衣物</p>
              <button className="btn" onClick={clearAll}>清除筛选条件</button>
            </>
          ) : (
            <>
              <p>衣柜还是空的，先录入几件常穿的衣服吧。</p>
              <Link to="/wardrobe/new" className="btn btn-primary">添加第一件衣物</Link>
            </>
          )}
        </div>
      )}
      {items.data && items.data.length > 0 && (
        <ul className={s.grid} aria-busy={items.isFetching}>
          {items.data.map((item) => (
            <ItemCard key={item.id} item={item} color={palette.find((c) => c.value === item.color)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemCard({ item, color }: { item: Item; color?: PaletteColor }) {
  return (
    <li>
      <Link to={`/wardrobe/${item.id}`} className={s.card}>
        <div className={s.thumb}>
          <ItemThumb item={item} hint />
          {item.status !== 'active' && <span className={s.badge}>{labelOf(STATUSES, item.status)}</span>}
        </div>
        <div className={s.meta}>
          <span className={s.title}>{itemTitle(item)}</span>
          <span className={s.sub}>
            {color && <ColorDot swatch={color.swatch} size={10} />}
            {item.name ? itemKind(item) : item.seasons.map((v) => labelOf(SEASONS, v)).join('')}
          </span>
        </div>
      </Link>
    </li>
  )
}

function Filter({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={s.filter}>
      <span className={s.filterLabel}>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </div>
  )
}
