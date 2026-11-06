import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { addDays, addMonths, formatLong, monthGrid, monthOf, parseISO, todayISO } from '@/lib/date'
import { usePopover } from './popover'
import p from './Popover.module.css'
import s from './DateInput.module.css'

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日']

/** 日期选择，替代原生 <input type="date">。value 为 YYYY-MM-DD 或空字符串 */
export function DateInput({
  value,
  onChange,
  placeholder = '选择日期',
  clearable = false,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  clearable?: boolean
  'aria-label': string
}) {
  const { open, show, hide, placement, rootRef, onBlur } = usePopover()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const today = todayISO()
  // 键盘焦点所在的日期；它所在的月份就是当前显示的月份
  const [cursor, setCursor] = useState(value || today)
  // 只有键盘移动时才把焦点移到日期格子上，点翻月按钮时焦点留在按钮上
  const focusCursor = useRef(false)

  const month = monthOf(cursor)
  const [y, m] = month.split('-').map(Number)

  function openPicker() {
    setCursor(value || today)
    focusCursor.current = true
    show()
  }
  function close() {
    hide()
    triggerRef.current?.focus()
  }
  function pick(d: string) {
    onChange(d)
    close()
  }
  function moveTo(d: string, focus: boolean) {
    focusCursor.current = focus
    setCursor(d)
  }

  useEffect(() => {
    if (!open || !focusCursor.current) return
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus()
  }, [open, cursor, rootRef])

  function onGridKey(e: KeyboardEvent) {
    const weekday = (parseISO(cursor).getDay() + 6) % 7 // 周一为 0
    const keys: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -weekday),
      End: () => addDays(cursor, 6 - weekday),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    }
    if (keys[e.key]) {
      e.preventDefault()
      moveTo(keys[e.key](), true)
    }
  }

  function onPanelKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  return (
    <div className={p.root} ref={rootRef} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className={p.trigger}
        aria-label={value ? `${ariaLabel}：${formatLong(value)}` : ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => (open ? hide() : openPicker())}
        onKeyDown={(e) => {
          if (!open && e.key === 'ArrowDown') {
            e.preventDefault()
            openPicker()
          }
        }}
      >
        <CalendarIcon />
        <span className={`${p.value} ${value ? '' : p.placeholder}`}>{value ? formatLong(value) : placeholder}</span>
      </button>

      {open && (
        <div id={dialogId} className={`${p.panel} ${s.panel}`} data-placement={placement}
          role="dialog" aria-label={`选择${ariaLabel}`} onKeyDown={onPanelKey}>
          <div className={s.head}>
            <button type="button" className={s.nav} onClick={() => moveTo(addMonths(cursor, -12), false)} aria-label="上一年">«</button>
            <button type="button" className={s.nav} onClick={() => moveTo(addMonths(cursor, -1), false)} aria-label="上个月">‹</button>
            <strong aria-live="polite">{y}年{m}月</strong>
            <button type="button" className={s.nav} onClick={() => moveTo(addMonths(cursor, 1), false)} aria-label="下个月">›</button>
            <button type="button" className={s.nav} onClick={() => moveTo(addMonths(cursor, 12), false)} aria-label="下一年">»</button>
          </div>

          <div className={s.grid} role="grid" aria-label={`${y}年${m}月`} onKeyDown={onGridKey}>
            {WEEK_HEAD.map((w) => <span key={w} className={s.week} role="columnheader">{w}</span>)}
            {monthGrid(month).flat().map((d) => (
              <button
                key={d}
                type="button"
                role="gridcell"
                data-day={d}
                className={s.day}
                tabIndex={d === cursor ? 0 : -1}
                aria-selected={d === value}
                aria-label={formatLong(d)}
                data-outside={monthOf(d) !== month || undefined}
                data-today={d === today || undefined}
                onClick={() => pick(d)}
              >
                {Number(d.slice(8))}
              </button>
            ))}
          </div>

          <div className={s.foot}>
            {clearable && value ? (
              <button type="button" className="btn btn-sm" onClick={() => pick('')}>清除</button>
            ) : <span />}
            <button type="button" className="btn btn-sm" onClick={() => pick(today)}>今天</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg className={p.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  )
}
