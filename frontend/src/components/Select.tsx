import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { usePopover } from './popover'
import s from './Popover.module.css'

export interface SelectOption<T> {
  value: T
  label: string
}
export interface SelectGroup<T> {
  label: string
  options: readonly SelectOption<T>[]
}

type Row<T> = { kind: 'group'; label: string } | { kind: 'option'; option: SelectOption<T>; grouped: boolean; index: number }

/**
 * 单选下拉框，替代原生 <select>。options 可以是选项，也可以是分组（相当于 optgroup）。
 * 不要放在 <label> 里（点击选项会再次触发 label 激活按钮），用 aria-label 命名。
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled,
  'aria-label': ariaLabel,
}: {
  value: T | null
  onChange: (v: T) => void
  options: readonly (SelectOption<T> | SelectGroup<T>)[]
  placeholder?: string
  disabled?: boolean
  'aria-label': string
}) {
  const { open, show, hide, placement, rootRef, onBlur } = usePopover()
  const listId = useId()

  const rows: Row<T>[] = []
  const flat: SelectOption<T>[] = []
  for (const o of options) {
    if ('options' in o) {
      rows.push({ kind: 'group', label: o.label })
      for (const c of o.options) rows.push({ kind: 'option', option: c, grouped: true, index: flat.push(c) - 1 })
    } else {
      rows.push({ kind: 'option', option: o, grouped: false, index: flat.push(o) - 1 })
    }
  }
  const selectedIndex = flat.findIndex((o) => o.value === value)
  const [active, setActive] = useState(-1)

  const openList = () => {
    setActive(Math.max(selectedIndex, 0))
    show()
  }
  const pick = (i: number) => {
    const o = flat[i]
    if (o && o.value !== value) onChange(o.value)
    hide()
  }

  // 键盘移动时让当前项保持在可视范围内
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    const last = flat.length - 1
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(active + 1, last),
      ArrowUp: () => Math.max(active - 1, 0),
      Home: () => 0,
      End: () => last,
      PageDown: () => Math.min(active + 8, last),
      PageUp: () => Math.max(active - 8, 0),
    }
    if (moves[e.key]) {
      e.preventDefault()
      setActive(moves[e.key]())
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      hide()
    } else if (e.key === 'Tab') {
      hide()
    }
  }

  const current = flat[selectedIndex]
  return (
    <div className={s.root} ref={rootRef} onBlur={onBlur}>
      <button
        type="button"
        role="combobox"
        className={s.trigger}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? hide() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`${s.value} ${current ? '' : s.placeholder}`}>{current?.label ?? placeholder}</span>
        <Chevron />
      </button>
      {open && (
        <div className={s.panel} data-placement={placement}>
          <ul className={s.list} id={listId} role="listbox" aria-label={ariaLabel}>
            {rows.map((r) =>
              r.kind === 'group' ? (
                <li key={`g-${r.label}`} className={s.groupLabel} role="presentation">{r.label}</li>
              ) : (
                <li
                  key={String(r.option.value)}
                  id={`${listId}-${r.index}`}
                  role="option"
                  className={s.option}
                  aria-selected={r.index === selectedIndex}
                  data-active={r.index === active || undefined}
                  data-grouped={r.grouped || undefined}
                  // 不让按下选项时触发器失焦
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerMove={() => r.index !== active && setActive(r.index)}
                  onClick={() => pick(r.index)}
                >
                  {r.option.label}
                  <CheckIcon />
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function Chevron() {
  return (
    <svg className={`${s.icon} ${s.chevron}`} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className={s.check} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}
