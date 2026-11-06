import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { errorText, imageUrl, itemTitle, type Item } from '@/api'
import { ChipGroup, ColorDot, ColorSwatches } from '@/components/Chips'
import { labelOf, OCCASIONS, SEASONS, STATUSES, type Occasion, type Season, type ItemStatus } from '@/constants'
import { useCategories, useItems, useTags } from '@/hooks/items'
import s from './WardrobeView.module.css'

/** 面板里的多选筛选项；URL 参数名与后端接口一致 */
const LIST_PARAMS = ['season', 'color', 'occasion', 'status', 'tag'] as const

export default function WardrobeView() {
  const [params, setParams] = useSearchParams()
  const { data: categories } = useCategories()
  const { data: tags } = useTags()
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
  const setCategory = (id: number | null) =>
    update((p) => (id === null ? p.delete('category_id') : p.set('category_id', String(id))))

  // ---- 搜索框：输入停顿 300ms 后再写入 URL ----
  const [q, setQ] = useState(params.get('q') ?? '')
  const urlQ = params.get('q') ?? ''
  useEffect(() => {
    if (urlQ === q.trim()) return
    const t = setTimeout(() => update((p) => (q.trim() ? p.set('q', q.trim()) : p.delete('q'))), 300)
    return () => clearTimeout(t)
  }, [q, urlQ, update])

  // ---- 分类：一级标签页 + 二级标签 ----
  const categoryId = params.get('category_id') ? Number(params.get('category_id')) : null
  const activeTop = useMemo(
    () => categories?.find((t) => t.id === categoryId || t.children.some((c) => c.id === categoryId)) ?? null,
    [categories, categoryId],
  )

  const panelCount = LIST_PARAMS.reduce((n, k) => n + list(k).length, 0)
  const anyFilter = panelCount > 0 || categoryId !== null || !!params.get('q')

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

      <nav className={s.tabs} aria-label="分类">
        <button className={s.tab} aria-pressed={categoryId === null} onClick={() => setCategory(null)}>全部</button>
        {categories?.map((t) => (
          <button key={t.id} className={s.tab} aria-pressed={activeTop?.id === t.id} onClick={() => setCategory(t.id)}>
            {t.name}
          </button>
        ))}
      </nav>
      {activeTop && (
        <div className={s.subTabs}>
          <ChipGroup
            label="二级分类"
            options={activeTop.children.map((c) => ({ value: String(c.id), label: c.name }))}
            value={categoryId !== activeTop.id && categoryId !== null ? [String(categoryId)] : []}
            onChange={(v) => setCategory(v.length ? Number(v.at(-1)) : activeTop.id)}
          />
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
          <Filter label="主色">
            <ColorSwatches label="主色" value={list('color')} onChange={setList('color')} />
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
          {items.data.map((item) => <ItemCard key={item.id} item={item} />)}
        </ul>
      )}
    </div>
  )
}

function ItemCard({ item }: { item: Item }) {
  return (
    <li>
      <Link to={`/wardrobe/${item.id}`} className={s.card}>
        <div className={s.thumb}>
          <img src={imageUrl(item.image_key, 'thumb')} alt="" loading="lazy" />
          {item.status !== 'active' && <span className={s.badge}>{labelOf(STATUSES, item.status)}</span>}
        </div>
        <div className={s.meta}>
          <span className={s.title}>{itemTitle(item)}</span>
          <span className={s.sub}>
            {item.color && <ColorDot color={item.color} size={10} />}
            {item.name ? item.category_path.split(' / ').at(-1) : item.seasons.map((v) => labelOf(SEASONS, v)).join('')}
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
