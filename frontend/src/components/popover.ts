import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'

/** 下方空间不足这么多时向上展开 */
const NEEDED_SPACE = 340
/** 移动端底部悬浮导航条大约占的高度 */
const BOTTOM_RESERVED = 96

/**
 * 下拉弹层的公共行为：点外面或焦点移出时关闭，按空间决定向下还是向上展开。
 * rootRef 挂在包住触发器和弹层的容器上，onBlur 也挂在这个容器上。
 */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'down' | 'up'>('down')
  const rootRef = useRef<HTMLDivElement>(null)

  const show = useCallback(() => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r) {
      const below = window.innerHeight - r.bottom - BOTTOM_RESERVED
      setPlacement(below < NEEDED_SPACE && r.top > below ? 'up' : 'down')
    }
    setOpen(true)
  }, [])
  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onBlur = useCallback((e: FocusEvent) => {
    const next = e.relatedTarget as Node | null
    if (next && !rootRef.current?.contains(next)) setOpen(false)
  }, [])

  return { open, show, hide, placement, rootRef, onBlur }
}
