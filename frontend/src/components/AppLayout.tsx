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
  const title = (matches.at(-1)?.handle as RouteHandle | undefined)?.title

  useEffect(() => {
    document.title = title ? `${title} · Closetly` : 'Closetly'
  }, [title])

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
            <NavLink key={n.to} to={n.to} end className={sideCls}>
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
          <NavLink key={n.to} to={n.to} end className={tabCls}>
            <NavIcon name={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
