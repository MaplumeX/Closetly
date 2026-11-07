import { useRef, useState, type KeyboardEvent } from 'react'
import { WARMTH_LABELS } from '@/constants'
import s from './WarmthMeter.module.css'

const LEVELS = [1, 2, 3, 4, 5] as const

/**
 * 保暖度 1–5：一排由低到高的格子，像信号格一样点亮到所选档位，右边显示档位名称。
 * 再点一次已选的档位可以清空（保暖度选填）。键盘：方向键切换，Home/End 跳到两端。
 */
export function WarmthMeter({
  value,
  onChange,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  label: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // 悬停时预览将要选中的档位
  const shown = hover ?? value

  function onKeyDown(e: KeyboardEvent) {
    const cur = value ?? 0
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(5, cur + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, cur - 1)
      : e.key === 'Home' ? 1
      : e.key === 'End' ? 5
      : null
    if (next === null) return
    e.preventDefault()
    onChange(next)
    refs.current[next - 1]?.focus()
  }

  return (
    <div className={s.wrap}>
      <div className={s.meter} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}>
        {LEVELS.map((v) => (
          <button key={v} ref={(el) => { refs.current[v - 1] = el }} type="button" role="radio"
            className={s.level} aria-checked={value === v} aria-label={`${v} ${WARMTH_LABELS[v]}`}
            // 单选组只有一个 Tab 停留点：已选的档位，没选时是第一档
            tabIndex={(value ?? 1) === v ? 0 : -1}
            data-on={shown !== null && v <= shown ? '' : undefined}
            data-preview={hover !== null ? '' : undefined}
            // 只有鼠标才预览：触屏点一下不会触发离开，预览会一直留着
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(v)}
            onClick={() => onChange(value === v ? null : v)}>
            <span className={s.bar} style={{ height: `${10 + v * 5}px` }} />
          </button>
        ))}
      </div>
      <span className={s.text} aria-hidden="true">
        {shown !== null ? (
          <><b>{shown}</b> {WARMTH_LABELS[shown]}</>
        ) : (
          <span className={s.empty}>未填写</span>
        )}
      </span>
    </div>
  )
}
