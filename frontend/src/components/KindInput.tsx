import { useId, useState, type KeyboardEvent } from 'react'
import { usePopover } from './popover'
import p from './Popover.module.css'

const MAX_SUGGESTIONS = 8

/** 单个自由文本输入，聚焦时下方列出用过的值供选择；输入新词即新建 */
export function KindInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  suggestions?: { name: string; count: number }[]
  placeholder?: string
  disabled?: boolean
  'aria-label': string
}) {
  const [active, setActive] = useState(-1)
  const { open, show, hide, placement, rootRef, onBlur } = usePopover()
  const listId = useId()

  const q = value.trim().toLowerCase()
  const matches = suggestions
    .filter((k) => k.name.toLowerCase().includes(q) && k.name.toLowerCase() !== q)
    .slice(0, MAX_SUGGESTIONS)
  const showList = open && !disabled && matches.length > 0

  function pick(name: string) {
    onChange(name)
    setActive(-1)
    hide()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return // 中文输入法选词时不处理
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!matches.length) return
      e.preventDefault()
      if (!open) show()
      const n = matches.length
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a <= 0 ? n : a) - 1))
    } else if (e.key === 'Enter' && showList && active >= 0 && matches[active]) {
      e.preventDefault()
      pick(matches[active].name)
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      e.stopPropagation()
      hide()
    }
  }

  return (
    <div className={p.root} ref={rootRef} onBlur={onBlur}>
      <input
        value={value}
        maxLength={32}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={show}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(-1)
          show()
        }}
        onKeyDown={onKeyDown}
        onBlur={hide}
      />
      {showList && (
        <div className={p.panel} data-placement={placement}>
          <ul className={p.list} id={listId} role="listbox" aria-label="用过的类型">
            {matches.map((k, i) => (
              <li
                key={k.name}
                id={`${listId}-${i}`}
                role="option"
                className={p.option}
                aria-selected={i === active}
                data-active={i === active || undefined}
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => pick(k.name)}
              >
                {k.name}
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{k.count} 件</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
