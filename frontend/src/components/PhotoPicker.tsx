import { useRef, useState, type ReactNode } from 'react'
import { errorText, imageUrl } from '@/api'
import { uploadImage } from '@/hooks/items'
import s from './PhotoPicker.module.css'

/**
 * 选择照片后立即上传，成功后回调 key。手机上会提供「拍照」选项。
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
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    setBusy(true)
    const local = URL.createObjectURL(file)
    setPreview(local)
    try {
      onChange(await uploadImage(file))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
      setPreview(null)
      URL.revokeObjectURL(local)
      if (input.current) input.current.value = ''
    }
  }

  const src = preview ?? (value ? imageUrl(value) : null)

  return (
    <div className={s.wrap}>
      <button type="button" className={s.frame} onClick={() => input.current?.click()} disabled={busy}
        aria-label={value ? '更换照片' : '添加照片'}>
        {src ? (
          <img src={src} alt="" className={busy ? s.dim : undefined} />
        ) : fallback ? (
          <>
            {fallback}
            <span className={s.cta}>拍照或选择照片</span>
          </>
        ) : (
          <span className={s.placeholder}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8a2 2 0 0 1 2-2h1.5l1.5-2h6l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
              <circle cx="12" cy="12.5" r="3.5" />
            </svg>
            拍照或选择照片
          </span>
        )}
        {busy && <span className={s.status}>上传中…</span>}
        {value && !busy && <span className={s.change}>更换</span>}
      </button>
      <p className={s.note}>
        {value ? (
          <button type="button" className={s.remove} onClick={() => onChange(null)} disabled={busy}>移除照片</button>
        ) : (
          '照片可以以后再补，没有照片时显示上面的剪影'
        )}
      </p>
      {error && <p className="msg-error" role="alert">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  )
}
