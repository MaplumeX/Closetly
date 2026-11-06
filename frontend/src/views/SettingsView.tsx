import { useMutation } from '@tanstack/react-query'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { api, errorText } from '@/api'
import { useMe } from '@/auth'
import { ColorManager } from '@/components/ColorManager'
import { KindManager } from '@/components/KindManager'
import s from './SettingsView.module.css'

const empty = { current: '', next: '', confirm: '' }

export default function SettingsView() {
  const { data: user } = useMe()
  const [form, setForm] = useState(empty)
  const [mismatch, setMismatch] = useState(false)

  const change = useMutation({
    mutationFn: () =>
      api('/api/auth/password', {
        method: 'POST',
        body: { current_password: form.current, new_password: form.next },
      }),
    onSuccess: () => setForm(empty),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    change.reset()
    setMismatch(form.next !== form.confirm)
    if (form.next === form.confirm) change.mutate()
  }

  const bind = (key: keyof typeof empty) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>设置</h1>
          <p>当前账号：{user?.username}</p>
        </div>
      </div>

      <div className={s.stack}>
        <form className={`card ${s.form}`} onSubmit={submit}>
          <h2>修改密码</h2>
          <p className={`muted ${s.hint}`}>修改后，其他设备上的登录会全部失效。</p>
          <label className="field">
            <span>当前密码</span>
            <input type="password" autoComplete="current-password" required {...bind('current')} />
          </label>
          <label className="field">
            <span>新密码（至少 8 位）</span>
            <input type="password" autoComplete="new-password" minLength={8} required {...bind('next')} />
          </label>
          <label className="field">
            <span>确认新密码</span>
            <input type="password" autoComplete="new-password" minLength={8} required {...bind('confirm')} />
          </label>
          {mismatch && <p className="msg-error" role="alert">两次输入的新密码不一致</p>}
          {change.isError && <p className="msg-error" role="alert">{errorText(change.error)}</p>}
          {change.isSuccess && <p className="msg-ok">密码已更新</p>}
          <div>
            <button className="btn btn-primary" disabled={change.isPending}>保存</button>
          </div>
        </form>

        <KindManager />
        <ColorManager />
      </div>
    </div>
  )
}
