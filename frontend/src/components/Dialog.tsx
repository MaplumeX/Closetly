import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { currentRequest, settle, subscribe, type Request } from './dialogs'
import s from './Dialog.module.css'

/** 放在应用根部一次 */
export function DialogHost() {
  const current = useSyncExternalStore(subscribe, currentRequest)
  // key 保证每个请求都是全新的组件状态
  return current ? <DialogView key={current.id} req={current} /> : null
}

function DialogView({ req }: { req: Request }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current!
    el.showModal()
    return () => el.close()
  }, [])

  function finish(ok: boolean) {
    if (done.current) return
    done.current = true
    if (req.kind === 'confirm') req.resolve(ok)
    else req.resolve(ok ? text : null)
    settle()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (req.kind === 'prompt') {
      const problem = req.validate?.(text) ?? null
      setError(problem)
      if (problem) return
    }
    finish(true)
  }

  const titleId = 'dialog-title'
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={titleId}
      // Esc 关闭
      onCancel={(e) => {
        e.preventDefault()
        finish(false)
      }}
      // 点遮罩关闭（点击目标是 dialog 本身而不是内容）
      onClick={(e) => e.target === e.currentTarget && finish(false)}
    >
      <form className={s.body} onSubmit={submit} noValidate>
        <h2 id={titleId}>{req.title}</h2>
        {req.message && <p className={s.message}>{req.message}</p>}
        {req.kind === 'prompt' && (
          <label className="field">
            <span>{req.label}</span>
            <input
              type={req.type ?? 'text'}
              autoComplete={req.autoComplete}
              value={text}
              autoFocus
              aria-invalid={!!error}
              onChange={(e) => {
                setText(e.target.value)
                if (error) setError(null)
              }}
            />
          </label>
        )}
        {error && <p className="msg-error" role="alert">{error}</p>}
        <div className={s.actions}>
          <button type="button" className="btn" onClick={() => finish(false)} autoFocus={req.kind === 'confirm'}>
            取消
          </button>
          <button className={`btn ${req.kind === 'confirm' && req.danger ? s.danger : 'btn-primary'}`}>
            {req.confirmText ?? '确定'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
