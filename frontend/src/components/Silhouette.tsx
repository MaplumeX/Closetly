import { useId } from 'react'
import type { Shape } from '@/lib/silhouette'
import { SHAPES } from './silhouettes'
import s from './Silhouette.module.css'

/** 「多色」用的条纹，配色和色板里的多色色块一致 */
const MULTI = ['#c8352e', '#f2cd3c', '#4f8a4a', '#4a86c8', '#7d55a8']

/**
 * 剪影的填充色：#rrggbb 色值、'multi'（多色）或 null（没填主色，只画虚线轮廓）
 */
export type SilhouetteFill = string | 'multi' | null

/** 相对亮度 0–1，用来决定细节线画深色还是浅色 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

interface Props {
  shape: Shape
  fill: SilhouetteFill
  /** 画领口、缝线等细节；缩略图很小时关掉更干净 */
  detail?: boolean
  /** 右下角显示「待补照片」的相机标记 */
  hint?: boolean
  className?: string
  /** 读屏文字；为空时整张图对读屏隐藏 */
  label?: string
}

/** 没有照片的衣物：中性底色上的一件主色剪影，看起来像平铺拍摄的商品图 */
export function Silhouette({ shape, fill, detail = true, hint = false, className, label }: Props) {
  const uid = useId().replace(/[^\w-]/g, '')
  const def = SHAPES[shape]
  const empty = fill === null
  const multi = fill === 'multi'

  const bodyFill = empty ? 'none' : multi ? `url(#${uid}-multi)` : fill
  // 描边往文字色方向混一点：浅色衣物在浅色模式、深色衣物在深色模式下都不会和底色融在一起
  // 很深的颜色（黑、藏青）混得多一些，否则深色模式下轮廓几乎看不见
  const lum = empty || multi ? 0.5 : luminance(fill)
  const edge = empty
    ? 'var(--ink-3)'
    : multi
      ? 'rgb(0 0 0 / 25%)'
      : `color-mix(in srgb, ${fill}, var(--ink) ${lum < 0.05 ? 45 : 25}%)`
  const line = empty
    ? 'var(--ink-3)'
    : lum > 0.35
      ? 'rgb(0 0 0 / 24%)'
      : 'rgb(255 255 255 / 30%)'

  return (
    <div data-thumb className={`${s.box} ${className ?? ''}`} role={label ? 'img' : undefined}
      aria-label={label || undefined}>
      <svg viewBox="0 0 120 160" className={s.svg} data-empty={empty || undefined} aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.14" />
          </linearGradient>
          {multi && (
            <pattern id={`${uid}-multi`} width="40" height="40" patternUnits="userSpaceOnUse"
              patternTransform="rotate(32)">
              {MULTI.map((c, i) => (
                <rect key={c} x={i * 8} width="8" height="40" fill={c} />
              ))}
            </pattern>
          )}
        </defs>
        <g className={s.figure} fillRule={def.evenodd ? 'evenodd' : 'nonzero'} strokeLinejoin="round" strokeLinecap="round">
          <path d={def.body} style={{ fill: bodyFill, stroke: edge }} strokeWidth="1.6"
            strokeDasharray={empty ? '4 3.5' : undefined} />
          {!empty && <path d={def.body} fill={`url(#${uid}-shade)`} />}
          {detail && def.detail && (
            <path d={def.detail} fill="none" style={{ stroke: line }} strokeWidth="1.3" opacity={empty ? 0.6 : 1} />
          )}
          {detail && def.dots?.map(([cx, cy]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="1.7" style={{ fill: line }} />)}
        </g>
      </svg>
      {hint && (
        <span className={s.hint} title="还没有照片">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.3l1.4-2h7.6l1.4 2h2.3A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          </svg>
        </span>
      )}
    </div>
  )
}
