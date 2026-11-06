import { useEffect, useState, type FormEvent } from 'react'
import { errorText } from '@/api'
import { useLogin } from '@/auth'
import s from './LoginView.module.css'

export default function LoginView() {
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    document.title = '登录 · Closetly'
  }, [])

  // 登录成功后由 PublicOnly 负责跳转
  function submit(e: FormEvent) {
    e.preventDefault()
    login.mutate({ username, password })
  }

  return (
    <div className={s.login}>
      <form className={s.card} onSubmit={submit}>
        <h1>Closetly</h1>
        <p className={`muted ${s.tagline}`}>你的电子衣柜</p>
        <label className="field">
          <span>用户名</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" autoCapitalize="off" required autoFocus />
        </label>
        <label className="field">
          <span>密码</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </label>
        {login.isError && <p className="msg-error" role="alert">{errorText(login.error)}</p>}
        <button className={`btn btn-primary ${s.submit}`} disabled={login.isPending}>
          {login.isPending ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}
