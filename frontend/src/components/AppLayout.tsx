import { useEffect } from 'react'
import { Link, NavLink, Outlet, useMatches, useNavigate } from 'react-router'
import { useLogout, useMe } from '@/auth'
import type { RouteHandle } from '@/router'
import { NavIcon, type IconName } from './NavIcon'
import s from './AppLayout.module.css'

const mainNav: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '今日', icon: 'today' },
  { to: '/wardrobe', label: '衣柜', icon: 'wardrobe' },
  { to: '/outfits', label: '搭配', icon: 'outfits' },
  { to: '/calendar', label: '记录', icon: 'calendar' },
]

const sideCls = ({ isActive }: { isActive: boolean }) => (isActive ? `${s.sideLink} ${s.active}` : s.sideLink)
const tabCls = ({ isActive }: { isActive: boolean }) => (isActive ? `${s.tab} ${s.active}` : s.tab)

export function AppLayout() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const matches = useMatches()
  const handle = matches.at(-1)?.handle as RouteHandle | undefined
  const title = handle?.title

  useEffect(() => {
    document.title = title ? `${title} · Closetly` : 'Closetly'
  }, [title])

  function goBack() {
    // 应用内有历史记录时返回上一页；直接打开的深链接则回到默认页面
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate(handle?.back ?? '/', { replace: true })
  }

  async function onLogout() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <Link to="/" className={s.brand}>Closetly</Link>
        <nav className={s.sideNav}>
          {mainNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={sideCls}>
              <NavIcon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <nav className={`${s.sideNav} ${s.sideBottom}`}>
          {user?.is_admin && (
            <NavLink to="/admin/users" className={sideCls}>
              <NavIcon name="users" />
              用户管理
            </NavLink>
          )}
          <NavLink to="/settings" className={sideCls}>
            <NavIcon name="settings" />
            设置
          </NavLink>
          <button className={s.sideLink} onClick={onLogout}>
            <NavIcon name="logout" />
            退出登录
          </button>
          <p className={s.whoami}>{user?.username}</p>
        </nav>
      </aside>

      <header className={s.topbar}>
        {handle?.back && (
          <button className={s.iconBtn} onClick={goBack} aria-label="返回">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        <span className={s.topbarTitle}>{title ?? 'Closetly'}</span>
        <Link to="/settings" className={s.iconBtn} aria-label="设置">
          <NavIcon name="settings" />
        </Link>
      </header>

      <main className={s.content}>
        <Outlet />
      </main>

      <nav className={s.tabbar} aria-label="主导航">
        {mainNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={tabCls}>
            <NavIcon name={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
