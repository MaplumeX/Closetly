import { useId, useState, type KeyboardEvent } from 'react'
import s from './TagInput.module.css'

/** 自由标签输入：回车或逗号添加，退格删除最后一个 */
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
  const listId = useId()

  function commit(raw: string) {
    const names = raw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    const next = [...value]
    for (const n of names) if (!next.includes(n) && n.length <= 32) next.push(n)
    if (next.length !== value.length) onChange(next.slice(0, 20))
    setDraft('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return // 中文输入法选词时不处理
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
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
        list={listId}
        placeholder={value.length ? '' : '输入后按回车添加'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && commit(draft)}
        aria-label="标签"
      />
      <datalist id={listId}>
        {suggestions.filter((t) => !value.includes(t)).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  )
}
