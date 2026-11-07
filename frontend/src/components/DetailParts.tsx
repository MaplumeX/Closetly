import type { ReactNode } from 'react'
import { labelOf, OCCASIONS, SEASONS, WARMTH_LABELS, type Occasion, type Season } from '@/constants'
import s from './DetailParts.module.css'

/** 衣物、搭配详情页共用的展示件 */

/** 属性列表：一行一个「标签 — 内容」 */
export function Groups({ children }: { children: ReactNode }) {
  return <dl className={s.groups}>{children}</dl>
}

/** 属性分组：内容为空时整行不显示 */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === false || children === ''
    || (Array.isArray(children) && children.every((c) => !c))
  if (empty) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** 四季一排，适合的季节点亮 */
export function SeasonBar({ seasons }: { seasons: readonly Season[] }) {
  return (
    <div className={s.seasons} aria-label={`季节：${seasons.map((v) => labelOf(SEASONS, v)).join('、')}`}>
      {SEASONS.map((o) => (
        <span key={o.value} data-on={seasons.includes(o.value) || undefined} aria-hidden="true">
          {o.label}
        </span>
      ))}
    </div>
  )
}

export function OccasionChips({ occasions }: { occasions: readonly Occasion[] }) {
  return (
    <div className={s.chips}>
      {occasions.map((v) => <span key={v}>{labelOf(OCCASIONS, v)}</span>)}
    </div>
  )
}

/** 保暖度 1–5 的只读显示；搭配由多件单品组成，显示的是一个范围 */
export function WarmthRange({ min, max }: { min: number; max: number }) {
  const label = min === max ? WARMTH_LABELS[min] : `${WARMTH_LABELS[min]}–${WARMTH_LABELS[max]}`
  const level = min === max ? `${min}` : `${min}–${max}`
  return (
    <div className={s.warmth} aria-label={`保暖度 ${level}/5，${label}`}>
      <span aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <i key={n} data-on={(n >= min && n <= max) || undefined} />)}
      </span>
      <span aria-hidden="true">{label}</span>
    </div>
  )
}

export interface Stat {
  label: string
  value: string
}

/** 穿着统计卡片：一排数字，可选一行提醒，下面放操作按钮 */
export function StatsCard({ label, stats, hint, children }: {
  label: string
  stats: Stat[]
  hint?: string | null
  children?: ReactNode
}) {
  return (
    <section className={s.card} aria-label={label}>
      <div className={s.stats}>
        {stats.map((st) => (
          <div key={st.label}>
            <strong>{st.value}</strong>
            <span>{st.label}</span>
          </div>
        ))}
      </div>
      {hint && <p className={s.hint}>{hint}</p>}
      {children && <div className={s.actions}>{children}</div>}
    </section>
  )
}
