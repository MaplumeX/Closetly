import type { ReactNode } from 'react'
import s from './Checkbox.module.css'

/** 自定义外观的复选框；底层仍是 input[type=checkbox]，表单与读屏行为不变 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <label className={s.root} data-disabled={disabled || undefined}>
      <input type="checkbox" className={s.input} checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className={s.box} aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  )
}
