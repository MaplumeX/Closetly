import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { errorText } from '@/api'
import { useAuthConfig, useRegister } from '@/auth'
import s from './LoginView.module.css'

export default function RegisterView() {
  const register = useRegister()
  const config = useAuthConfig()
  const { search } = useLocation()
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [mismatch, setMismatch] = useState(false)

  useEffect(() => {
    document.title = '注册 · Closetly'
  }, [])

  // 注册成功后已处于登录状态，由 PublicOnly 负责跳转
  function submit(e: FormEvent) {
    e.preventDefault()
    register.reset()
    setMismatch(form.password !== form.confirm)
    if (form.password === form.confirm) register.mutate({ username: form.username, password: form.password })
  }

  const loginLink = <Link to={`/login${search}`}>登录</Link>

  return (
    <div className={s.login}>
      <form className={s.card} onSubmit={submit}>
        <h1>Closetly</h1>
        <p className={`muted ${s.tagline}`}>创建你的电子衣柜</p>
        {config.data && !config.data.registration_open ? (
          <>
            <p className="msg-error" role="alert">当前未开放注册，请联系管理员创建账号。</p>
            <p className={`muted ${s.switch}`}>已有账号？{loginLink}</p>
          </>
        ) : (
          <>
            <label className="field">
              <span>用户名（字母、数字、下划线、点或短横线）</span>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username" autoCapitalize="off" minLength={2} maxLength={64}
                pattern="[\w.\-]+" required autoFocus />
            </label>
            <label className="field">
              <span>密码（至少 8 位）</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            <label className="field">
              <span>确认密码</span>
              <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                autoComplete="new-password" minLength={8} maxLength={128} required />
            </label>
            {mismatch && <p className="msg-error" role="alert">两次输入的密码不一致</p>}
            {register.isError && <p className="msg-error" role="alert">{errorText(register.error)}</p>}
            <button className={`btn btn-primary ${s.submit}`} disabled={register.isPending || config.isPending}>
              {register.isPending ? '注册中…' : '注册'}
            </button>
            <p className={`muted ${s.switch}`}>已有账号？{loginLink}</p>
          </>
        )}
      </form>
    </div>
  )
}
