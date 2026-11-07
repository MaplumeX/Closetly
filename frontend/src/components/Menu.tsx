import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { usePopover } from './popover'
import p from './Popover.module.css'
import s from './Menu.module.css'

export interface MenuItem {
  key: string
  label: ReactNode
  onSelect: () => void
  /** 单选菜单里的当前项，显示对勾 */
  selected?: boolean
  danger?: boolean
}

/**
 * 按钮 + 弹出菜单。trigger 是按钮里的内容，triggerClassName 决定按钮外观。
 * 菜单项是普通按钮：上下键移动，Esc 关闭并回到触发按钮。
 */
export function Menu({
  trigger,
  triggerClassName,
  items,
  'aria-label': ariaLabel,
  align = 'left',
  disabled,
}: {
  trigger: ReactNode
  triggerClassName?: string
  items: readonly MenuItem[]
  'aria-label': string
  align?: 'left' | 'right'
  disabled?: boolean
}) {
  const { open, show, hide, placement, rootRef, onBlur } = usePopover()
  const menuId = useId()
  const buttons = () => [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]

  function openMenu(focus: 'first' | 'last' | null) {
    show()
    if (focus) requestAnimationFrame(() => (focus === 'first' ? buttons()[0] : buttons().at(-1))?.focus())
  }
  function close() {
    hide()
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus()
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu(e.key === 'ArrowDown' ? 'first' : 'last')
    }
  }
  function onMenuKey(e: KeyboardEvent) {
    const list = buttons()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    const next: Record<string, number> = {
      ArrowDown: (i + 1) % list.length,
      ArrowUp: (i - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    }
    if (e.key in next) {
      e.preventDefault()
      list[next[e.key]]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      hide()
    }
  }

  return (
    <div className={`${p.root} ${s.root}`} ref={rootRef} onBlur={onBlur}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? hide() : openMenu(null))}
        onKeyDown={onTriggerKey}
      >
        {trigger}
      </button>
      {open && (
        <div className={`${p.panel} ${s.panel}`} data-placement={placement} data-align={align}>
          <div className={s.list} id={menuId} role="menu" aria-label={ariaLabel} onKeyDown={onMenuKey}>
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className={`${p.option} ${s.item}`}
                aria-current={it.selected || undefined}
                data-danger={it.danger || undefined}
                onClick={() => {
                  close()
                  it.onSelect()
                }}
              >
                {it.label}
                {it.selected && (
                  <svg className={s.check} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
