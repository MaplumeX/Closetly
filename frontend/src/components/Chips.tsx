import { COLORS } from '@/constants'
import s from './Chips.module.css'

interface Option<T extends string> {
  value: T
  label: string
}

/** 多选标签组 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[]
  value: readonly T[]
  onChange: (v: T[]) => void
  label: string
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={s.chip} aria-pressed={value.includes(o.value)}
          onClick={() => toggle(o.value)}>
          {o.label}
        </button>
      ))}
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

export function ColorDot({ color, size = 14 }: { color: string; size?: number }) {
  const hex = COLORS.find((c) => c.value === color)?.hex
  if (!hex) return null
  return <span className={s.dot} style={{ background: hex, width: size, height: size }} aria-hidden="true" />
}

/** 颜色色板：single 时单选（再点取消），否则多选 */
export function ColorSwatches({
  value,
  onChange,
  label,
  single = false,
}: {
  value: readonly string[]
  onChange: (v: string[]) => void
  label: string
  single?: boolean
}) {
  const toggle = (c: string) => {
    if (value.includes(c)) onChange(value.filter((x) => x !== c))
    else onChange(single ? [c] : [...value, c])
  }
  return (
    <div className={s.swatches} role="group" aria-label={label}>
      {COLORS.map((c) => (
        <button key={c.value} type="button" className={s.swatch} aria-pressed={value.includes(c.value)}
          title={c.label} onClick={() => toggle(c.value)}>
          <ColorDot color={c.value} size={22} />
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  )
}
