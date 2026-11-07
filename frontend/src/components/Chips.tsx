import type { Color } from '@/constants'
import type { PaletteColor } from '@/hooks/colors'
import s from './Chips.module.css'

interface Option<T extends string> {
  value: T
  label: string
}

/** 多选标签组；给了 all 时末尾多一个「全选」快捷项（例如「四季」），全部选中时它也是选中状态，再点一次清空 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  all,
}: {
  options: readonly Option<T>[]
  value: readonly T[]
  onChange: (v: T[]) => void
  label: string
  all?: string
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const allSelected = options.every((o) => value.includes(o.value))
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={s.chip} aria-pressed={value.includes(o.value)}
          onClick={() => toggle(o.value)}>
          {o.label}
        </button>
      ))}
      {all && (
        <>
          <span className={s.sep} aria-hidden="true" />
          <button type="button" className={s.chip} aria-pressed={allSelected}
            onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}>
            {all}
          </button>
        </>
      )}
    </div>
  )
}

/** 单选标签组；allowEmpty 时再点一次已选项可以取消 */
export function ChipSelect<T extends string | number>({
  options,
  value,
  onChange,
  label,
  allowEmpty = true,
}: {
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
  label: string
  allowEmpty?: boolean
}) {
  return (
    <div className={s.chips} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" className={s.chip} aria-checked={value === o.value}
          onClick={() => onChange(value === o.value && allowEmpty ? null : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 圆形色点；swatch 是 CSS background，可以是渐变 */
export function ColorDot({ swatch, size = 14 }: { swatch: string; size?: number }) {
  return <span className={s.dot} style={{ background: swatch, width: size, height: size }} aria-hidden="true" />
}

/** 颜色色板：single 时单选（再点取消），否则多选；给了 onAdd 时末尾多一个「添加」格 */
export function ColorSwatches({
  options,
  value,
  onChange,
  label,
  single = false,
  onAdd,
}: {
  options: readonly PaletteColor[]
  value: readonly string[]
  onChange: (v: Color[]) => void
  label: string
  single?: boolean
  onAdd?: () => void
}) {
  const selected = options.filter((c) => value.includes(c.value)).map((c) => c.value)
  const toggle = (c: Color) => {
    if (selected.includes(c)) onChange(selected.filter((x) => x !== c))
    else onChange(single ? [c] : [...selected, c])
  }
  return (
    <div className={s.swatches} role="group" aria-label={label}>
      {options.map((c) => (
        <button key={c.value} type="button" className={s.swatch} aria-pressed={selected.includes(c.value)}
          title={c.label} onClick={() => toggle(c.value)}>
          <ColorDot swatch={c.swatch} size={22} />
          <span className={s.swatchLabel}>{c.label}</span>
        </button>
      ))}
      {onAdd && (
        <button type="button" className={s.swatch} title="添加颜色" onClick={onAdd}>
          <span className={s.addDot} aria-hidden="true">＋</span>
          <span className={s.swatchLabel}>添加</span>
        </button>
      )}
    </div>
  )
}
