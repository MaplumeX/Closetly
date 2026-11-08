import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { customColorValue, errorText, type ItemInput } from '@/api'
import { FIT_SLOTS, FITS, KIND_EXAMPLES, OCCASIONS, SEASONS, SLOTS, STATUSES, labelOf, type ItemStatus } from '@/constants'
import { formatDay } from '@/lib/date'
import { toInput, type Draft } from '@/lib/itemDraft'
import { cutOptions } from '@/lib/silhouette'
import { useAddColor, usePalette } from '@/hooks/colors'
import { useKinds, useTags } from '@/hooks/items'
import { ChipGroup, ChipSelect, ColorSwatches } from './Chips'
import { DateInput } from './DateInput'
import { ItemThumb } from './ItemThumb'
import { KindInput } from './KindInput'
import { PhotoPicker } from './PhotoPicker'
import { Select } from './Select'
import { TagInput } from './TagInput'
import { WarmthMeter } from './WarmthMeter'
import s from './ItemForm.module.css'

const PRICE_RE = /^\d{1,7}(\.\d{1,2})?$/

type Problems = Partial<Record<'slot' | 'seasons' | 'price', string>>

function validate(d: Draft): Problems {
  const p: Problems = {}
  if (!d.slot) p.slot = '请选择部位'
  if (!d.seasons.length) p.seasons = '请至少选择一个季节'
  if (d.price.trim() && !PRICE_RE.test(d.price.trim())) p.price = '价格格式不正确，例如 199 或 199.90'
  return p
}

/** 「更多信息」里是否填了东西：编辑时有内容就默认展开 */
const hasMore = (d: Draft) =>
  !!(d.brand.trim() || d.price.trim() || d.purchase_date || d.location.trim() || d.notes.trim() || d.status !== 'active')

/** 「更多信息」折叠时，在标题旁列出已填的内容 */
function moreSummary(d: Draft): string {
  const parts = [
    d.brand.trim(),
    d.price.trim() && `¥${d.price.trim()}`,
    d.purchase_date && `${formatDay(d.purchase_date)}购入`,
    d.status !== 'active' && labelOf(STATUSES, d.status),
    d.location.trim(),
    d.notes.trim() && '有备注',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '品牌、价格、购买日期、状态、收纳位置、备注'
}

export function ItemForm({
  initial,
  onSubmit,
  submitting,
  error,
  actions,
}: {
  initial: Draft
  onSubmit: (input: ItemInput, draft: Draft, submitter: string) => void
  submitting: boolean
  error?: string
  /** 提交按钮，按钮的 value 会作为 submitter 传给 onSubmit */
  actions: ReactNode
}) {
  const { data: tags } = useTags()
  const [d, setD] = useState(initial)
  const { data: kinds } = useKinds(d.slot)
  // 第一次点保存之后才显示校验结果，之后随输入实时更新
  const [tried, setTried] = useState(false)
  const problems = useMemo(() => validate(d), [d])
  const shown: Problems = tried ? problems : {}
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }))

  const [moreOpen, setMoreOpen] = useState(() => hasMore(initial))
  const cuts = d.slot ? cutOptions(d.slot, d.kind, d.name) : []

  // 校验没通过时滚动到第一个出错的字段。要等错误提示渲染出来，所以放在 effect 里
  const form = useRef<HTMLFormElement>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!attempt) return
    const first = form.current?.querySelector<HTMLElement>('[data-invalid]')
    if (!first) return
    first.scrollIntoView({ behavior: 'smooth', block: 'center' })
    first.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true })
  }, [attempt])

  const palette = usePalette()
  const addColor = useAddColor()
  const [colorError, setColorError] = useState<string | null>(null)
  /** 色板里没有合适的颜色：当场添加一个并选中 */
  async function onAddColor() {
    setColorError(null)
    try {
      const c = await addColor()
      if (c) set('color', customColorValue(c.id))
    } catch (e) {
      setColorError(errorText(e))
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTried(true)
    if (Object.keys(problems).length) {
      if (problems.price) setMoreOpen(true)
      setAttempt((n) => n + 1)
      return
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    onSubmit(toInput(d), d, submitter?.value ?? '')
  }

  return (
    <form ref={form} className={s.form} onSubmit={submit} noValidate>
      <div className={s.photo}>
        <PhotoPicker value={d.image_key} onChange={(k) => set('image_key', k)}
          fallback={d.slot && (
            <ItemThumb item={{ image_key: null, slot: d.slot, kind: d.kind, name: d.name, color: d.color }} />
          )} />
      </div>

      <div className={s.fields}>
        <section className={s.section} aria-labelledby="item-form-look">
          <h2 id="item-form-look">外观</h2>
          <Field label="部位" required as="div" error={shown.slot}>
            <ChipSelect label="部位" options={SLOTS} value={d.slot} allowEmpty={false}
              onChange={(v) => v && set('slot', v)} />
          </Field>
          <div className={s.grid2}>
            <Field label="类型" hint="可不填" as="div">
              <KindInput aria-label="类型" value={d.kind} onChange={(v) => set('kind', v)} suggestions={kinds}
                disabled={!d.slot} placeholder={d.slot ? `例如：${KIND_EXAMPLES[d.slot]}` : '先选择部位'} />
            </Field>
            <Field label="名称" hint="可不填">
              <input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={128} placeholder="默认显示类型或部位" />
            </Field>
          </div>
          {d.slot && FIT_SLOTS.includes(d.slot) && (
            <Field label="版型" as="div">
              <ChipSelect label="版型" options={FITS} value={d.fit} onChange={(v) => set('fit', v)} />
            </Field>
          )}
          {cuts.length > 0 && (
            <Field label="廓形" as="div">
              <ChipSelect label="廓形" options={cuts} value={d.cut} onChange={(v) => set('cut', v)} />
            </Field>
          )}
          <Field label="主色" as="div">
            <ColorSwatches label="主色" single options={palette} value={d.color ? [d.color] : []}
              onChange={(v) => set('color', v[0] ?? null)} onAdd={onAddColor} />
            {colorError && <p className="msg-error" role="alert">{colorError}</p>}
          </Field>
        </section>

        <section className={s.section} aria-labelledby="item-form-wear">
          <h2 id="item-form-wear">穿着</h2>
          <Field label="季节" required as="div" error={shown.seasons}>
            <ChipGroup label="季节" options={SEASONS} value={d.seasons} onChange={(v) => set('seasons', v)} all="四季" />
          </Field>
          <Field label="场合" as="div">
            <ChipGroup label="场合" options={OCCASIONS} value={d.occasions} onChange={(v) => set('occasions', v)} />
          </Field>
          <Field label="保暖度" hint="用于根据气温推荐" as="div">
            <WarmthMeter label="保暖度" value={d.warmth} onChange={(v) => set('warmth', v)} />
          </Field>
          <Field label="标签" as="div">
            <TagInput value={d.tags} onChange={(v) => set('tags', v)} suggestions={tags?.map((t) => t.name)} />
          </Field>
        </section>

        <details className={`${s.section} ${s.more}`} open={moreOpen}
          onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
          <summary>
            <h2>更多信息</h2>
            {!moreOpen && <span className={s.summary}>{moreSummary(d)}</span>}
          </summary>
          <div className={s.moreBody}>
            <div className={s.grid2}>
              <Field label="品牌">
                <input value={d.brand} onChange={(e) => set('brand', e.target.value)} maxLength={128} />
              </Field>
              <Field label="价格（元）" error={shown.price}>
                <input value={d.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" placeholder="0.00"
                  aria-invalid={!!shown.price || undefined} />
              </Field>
              <Field label="购买日期" as="div">
                <DateInput aria-label="购买日期" clearable value={d.purchase_date} onChange={(v) => set('purchase_date', v)} />
              </Field>
              <Field label="状态" as="div">
                <Select<ItemStatus> aria-label="状态" value={d.status} options={STATUSES} onChange={(v) => set('status', v)} />
              </Field>
            </div>
            <Field label="收纳位置">
              <input value={d.location} onChange={(e) => set('location', e.target.value)} maxLength={128} placeholder="例如：主卧衣柜左侧" />
            </Field>
            <Field label="备注">
              <textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} rows={3} />
            </Field>
          </div>
        </details>

        <div className={s.actions} aria-busy={submitting}>
          {error && <p className={`msg-error ${s.submitError}`} role="alert">{error}</p>}
          {actions}
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  hint,
  error,
  as = 'label',
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  /** 校验错误，显示在字段下方 */
  error?: string
  as?: 'label' | 'div'
  children: ReactNode
}) {
  const Tag = as
  return (
    <Tag className="field" data-invalid={error ? '' : undefined}>
      <span>
        {label}
        {required && <em className={s.req}> *</em>}
        {hint && <small className={s.hint}>{hint}</small>}
      </span>
      {children}
      {/* span 而不是 p：Field 可能是 <label>，里面只能放行内内容 */}
      {error && <span className={s.error} role="alert">{error}</span>}
    </Tag>
  )
}
