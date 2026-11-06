import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { customColorValue, errorText, type ItemInput } from '@/api'
import { KIND_EXAMPLES, OCCASIONS, SEASONS, SLOTS, STATUSES, WARMTH_LABELS, type ItemStatus } from '@/constants'
import { toInput, type Draft } from '@/lib/itemDraft'
import { useAddColor, usePalette } from '@/hooks/colors'
import { useKinds, useTags } from '@/hooks/items'
import { ChipGroup, ChipSelect, ColorSwatches } from './Chips'
import { DateInput } from './DateInput'
import { KindInput } from './KindInput'
import { PhotoPicker } from './PhotoPicker'
import { Select } from './Select'
import { TagInput } from './TagInput'
import s from './ItemForm.module.css'

const PRICE_RE = /^\d{1,7}(\.\d{1,2})?$/

function validate(d: Draft): string[] {
  const p: string[] = []
  if (!d.image_key) p.push('请添加照片')
  if (!d.slot) p.push('请选择部位')
  if (!d.seasons.length) p.push('请至少选择一个季节')
  if (d.price.trim() && !PRICE_RE.test(d.price.trim())) p.push('价格格式不正确')
  return p
}
const WARMTH_OPTIONS = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: `${v} ${WARMTH_LABELS[v]}` }))

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
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }))

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
    if (problems.length) return
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    onSubmit(toInput(d), d, submitter?.value ?? '')
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <div className={s.photo}>
        <PhotoPicker value={d.image_key} onChange={(k) => set('image_key', k)} />
      </div>

      <div className={s.fields}>
        <section className={s.section}>
          <h2>基本信息</h2>
          <Field label="部位" required as="div">
            <ChipSelect label="部位" options={SLOTS} value={d.slot} allowEmpty={false}
              onChange={(v) => v && set('slot', v)} />
          </Field>
          <Field label="类型" hint="自己定义，可不填" as="div">
            <KindInput aria-label="类型" value={d.kind} onChange={(v) => set('kind', v)} suggestions={kinds}
              disabled={!d.slot} placeholder={d.slot ? `例如：${KIND_EXAMPLES[d.slot]}` : '先选择部位'} />
          </Field>
          <Field label="季节" required as="div">
            <ChipGroup label="季节" options={SEASONS} value={d.seasons} onChange={(v) => set('seasons', v)} />
          </Field>
          <Field label="名称">
            <input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={128} placeholder="不填则显示类型或部位" />
          </Field>
          <Field label="主色" as="div">
            <ColorSwatches label="主色" single options={palette} value={d.color ? [d.color] : []}
              onChange={(v) => set('color', v[0] ?? null)} onAdd={onAddColor} />
            {colorError && <p className="msg-error" role="alert">{colorError}</p>}
          </Field>
          <Field label="场合" as="div">
            <ChipGroup label="场合" options={OCCASIONS} value={d.occasions} onChange={(v) => set('occasions', v)} />
          </Field>
          <Field label="保暖度" hint="用于根据气温推荐" as="div">
            <ChipSelect label="保暖度" options={WARMTH_OPTIONS} value={d.warmth} onChange={(v) => set('warmth', v)} />
          </Field>
          <Field label="标签" as="div">
            <TagInput value={d.tags} onChange={(v) => set('tags', v)} suggestions={tags?.map((t) => t.name)} />
          </Field>
        </section>

        <section className={s.section}>
          <h2>更多信息</h2>
          <div className={s.grid2}>
            <Field label="品牌">
              <input value={d.brand} onChange={(e) => set('brand', e.target.value)} maxLength={128} />
            </Field>
            <Field label="价格（元）">
              <input value={d.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" placeholder="0.00" />
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
        </section>

        {((tried && problems.length > 0) || error) && (
          <div className={s.problems} role="alert">
            {tried && problems.map((p) => <p key={p} className="msg-error">{p}</p>)}
            {error && <p className="msg-error">{error}</p>}
          </div>
        )}
        <div className={s.actions} aria-busy={submitting}>{actions}</div>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  hint,
  as = 'label',
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  as?: 'label' | 'div'
  children: ReactNode
}) {
  const Tag = as
  return (
    <Tag className="field">
      <span>
        {label}
        {required && <em className={s.req}> *</em>}
        {hint && <small className={s.hint}>{hint}</small>}
      </span>
      {children}
    </Tag>
  )
}
