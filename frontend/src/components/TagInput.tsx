import { useId, useState, type KeyboardEvent } from 'react'
import { usePopover } from './popover'
import p from './Popover.module.css'
import s from './TagInput.module.css'

const MAX_SUGGESTIONS = 8

/** 自由标签输入：回车或逗号添加，退格删除最后一个；聚焦时下方列出已有标签供选择 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
}) {
  const [draft, setDraft] = useState('')
  const [active, setActive] = useState(-1)
  const { open, show, hide, placement, rootRef, onBlur } = usePopover()
  const listId = useId()

  const q = draft.trim().toLowerCase()
  const matches = suggestions
    .filter((t) => !value.includes(t) && t.toLowerCase().includes(q) && t.toLowerCase() !== q)
    .slice(0, MAX_SUGGESTIONS)
  const showList = open && matches.length > 0

  function commit(raw: string) {
    const names = raw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    const next = [...value]
    for (const n of names) if (!next.includes(n) && n.length <= 32) next.push(n)
    if (next.length !== value.length) onChange(next.slice(0, 20))
    setDraft('')
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return // 中文输入法选词时不处理
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!matches.length) return
      e.preventDefault()
      if (!open) show()
      const n = matches.length
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a <= 0 ? n : a) - 1))
    } else if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault()
      commit(showList && active >= 0 && matches[active] ? matches[active] : draft)
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      e.stopPropagation()
      hide()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={p.root} ref={rootRef} onBlur={onBlur}>
      <div className={s.box}>
        {value.map((t) => (
          <span key={t} className={s.tag}>
            {t}
            <button type="button" aria-label={`删除标签 ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          className={s.input}
          value={draft}
          placeholder={value.length ? '' : '输入后按回车添加'}
          role="combobox"
          aria-label="标签"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onFocus={show}
          onChange={(e) => {
            setDraft(e.target.value)
            setActive(-1)
            show()
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft) commit(draft)
            hide()
          }}
        />
      </div>
      {showList && (
        <div className={p.panel} data-placement={placement}>
          <ul className={p.list} id={listId} role="listbox" aria-label="已有标签">
            {matches.map((t, i) => (
              <li
                key={t}
                id={`${listId}-${i}`}
                role="option"
                className={p.option}
                aria-selected={i === active}
                data-active={i === active || undefined}
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => commit(t)}
              >
                #{t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
