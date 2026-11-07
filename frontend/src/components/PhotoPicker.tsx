import type { ReactNode } from 'react'
import { imageUrl } from '@/api'
import { canPasteOrDrop, usePhotoUpload } from '@/lib/usePhotoUpload'
import s from './PhotoPicker.module.css'

const CTA = canPasteOrDrop ? '选择、粘贴或拖入照片' : '拍照或选择照片'

/**
 * 选择、粘贴或拖入照片后立即上传，成功后回调 key。手机上会提供「拍照」选项。
 * 照片选填：没有照片时显示 fallback（按当前填写的部位、类型和主色画的剪影），也可以移除已有照片。
 */
export function PhotoPicker({
  value,
  onChange,
  fallback,
}: {
  value: string | null
  onChange: (key: string | null) => void
  fallback?: ReactNode
}) {
  const { busy, preview, error, dragging, pick, inputProps, dropProps } = usePhotoUpload(onChange)

  const src = preview ?? (value ? imageUrl(value) : null)

  return (
    <div className={s.wrap}>
      <button type="button" className={`${s.frame} ${dragging ? s.dragging : ''}`} onClick={pick} disabled={busy}
        {...dropProps}
        aria-label={value ? '更换照片' : '添加照片'}>
        {src ? (
          <img src={src} alt="" className={busy ? s.dim : undefined} />
        ) : fallback ? (
          <>
            {fallback}
            <span className={s.cta}>{CTA}</span>
          </>
        ) : (
          <span className={s.placeholder}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8a2 2 0 0 1 2-2h1.5l1.5-2h6l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
              <circle cx="12" cy="12.5" r="3.5" />
            </svg>
            <span className={s.placeholderText}>{CTA}</span>
          </span>
        )}
        {busy && <span className={s.status}>上传中…</span>}
        {value && !busy && <span className={s.change}>更换</span>}
      </button>
      {/* 宽屏时在照片下方居中；单栏时在小图右侧，并显示单独的按钮（小图里放不下提示文字） */}
      <div className={s.side}>
        <p className={s.note}>
          {value ? '照片会作为这件衣物的封面' : '照片可以以后再补，没有照片时显示剪影'}
        </p>
        <div className={s.sideActions}>
          <button type="button" className={`btn btn-sm ${s.pick}`} onClick={pick} disabled={busy}>
            {value ? '更换照片' : CTA}
          </button>
          {value && (
            <button type="button" className={s.remove} onClick={() => onChange(null)} disabled={busy}>移除照片</button>
          )}
        </div>
        {error && <p className="msg-error" role="alert">{error}</p>}
      </div>
      <input {...inputProps} />
    </div>
  )
}
