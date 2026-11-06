import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, errorText, type User } from '@/api'
import { useMe } from '@/auth'
import { Checkbox } from '@/components/Checkbox'
import { confirmDialog, promptDialog } from '@/components/dialogs'
import s from './AdminUsersView.module.css'

const USERS_KEY = ['admin', 'users'] as const
const emptyForm = { username: '', password: '', is_admin: false }

export default function AdminUsersView() {
  const qc = useQueryClient()
  const { data: me } = useMe()
  const users = useQuery({ queryKey: USERS_KEY, queryFn: () => api<User[]>('/api/admin/users') })
  const [form, setForm] = useState(emptyForm)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  // 所有操作共用：成功后刷新列表并显示提示
  const action = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; ok: string }) => run(),
    onSuccess: (_d, { ok }) => {
      setNotice({ ok: true, text: ok })
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
    onError: (e) => setNotice({ ok: false, text: errorText(e) }),
  })

  function create(e: FormEvent) {
    e.preventDefault()
    action.mutate(
      { run: () => api('/api/admin/users', { method: 'POST', body: form }), ok: `已创建用户 ${form.username}` },
      { onSuccess: () => setForm(emptyForm) },
    )
  }

  async function toggleActive(u: User) {
    if (u.is_active) {
      const ok = await confirmDialog({
        title: `停用 ${u.username}？`,
        message: '停用后该用户无法登录，数据会保留，随时可以重新启用。',
        confirmText: '停用',
        danger: true,
      })
      if (!ok) return
    }
    action.mutate({
      run: () => api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { is_active: !u.is_active } }),
      ok: u.is_active ? `已停用 ${u.username}` : `已启用 ${u.username}`,
    })
  }

  async function resetPassword(u: User) {
    const pw = await promptDialog({
      title: `重置 ${u.username} 的密码`,
      label: '新密码（至少 8 位）',
      type: 'password',
      autoComplete: 'new-password',
      confirmText: '重置',
      validate: (v) => (v.length < 8 ? '密码至少 8 位' : null),
    })
    if (!pw) return
    action.mutate({
      run: () => api(`/api/admin/users/${u.id}/password`, { method: 'POST', body: { password: pw } }),
      ok: `已重置 ${u.username} 的密码`,
    })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>用户管理</h1>
          <p>不开放注册，新用户只能在这里创建。</p>
        </div>
      </div>

      {notice && (
        <p className={`${notice.ok ? 'msg-ok' : 'msg-error'} ${s.banner}`} role={notice.ok ? undefined : 'alert'}>
          {notice.text}
        </p>
      )}

      <div className={s.layout}>
        <div className={`card ${s.list}`}>
          {users.isError && <p className="msg-error">{errorText(users.error)}</p>}
          {users.data?.map((u) => (
            <div key={u.id} className={s.row}>
              <div className={s.who}>
                <strong>{u.username}</strong>
                {u.is_admin && <span className={s.badge}>管理员</span>}
                {!u.is_active && <span className={`${s.badge} ${s.badgeOff}`}>已停用</span>}
              </div>
              <div className={s.actions}>
                <button className="btn btn-sm" onClick={() => resetPassword(u)}>重置密码</button>
                {u.id !== me?.id && (
                  <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : ''}`} onClick={() => toggleActive(u)}>
                    {u.is_active ? '停用' : '启用'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form className={`card ${s.create}`} onSubmit={create}>
          <h2>新建用户</h2>
          <label className="field">
            <span>用户名</span>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="off" autoCapitalize="off" required />
          </label>
          <label className="field">
            <span>初始密码（至少 8 位）</span>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password" minLength={8} required />
          </label>
          <Checkbox checked={form.is_admin} onChange={(v) => setForm({ ...form, is_admin: v })}>设为管理员</Checkbox>
          <div>
            <button className="btn btn-primary" disabled={action.isPending}>创建</button>
          </div>
        </form>
      </div>
    </div>
  )
}
