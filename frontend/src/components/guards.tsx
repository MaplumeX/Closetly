import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { useMe } from '@/auth'

/** 未登录时跳转登录页，并记住原来要去的地址 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  if (isPending) return null
  if (!user) {
    const next = location.pathname + location.search
    const search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`
    return <Navigate to={`/login${search}`} replace />
  }
  return children
}

/** 布局路由：非管理员访问子路由时回首页 */
export function RequireAdmin() {
  const { data: user } = useMe()
  return user?.is_admin ? <Outlet /> : <Navigate to="/" replace />
}

/** 已登录时离开登录页：回到 ?next 指定的地址，否则回首页。
 *  登录成功后也是由这里完成跳转。 */
export function PublicOnly() {
  const { data: user, isPending } = useMe()
  const [params] = useSearchParams()
  if (isPending) return null
  if (!user) return <Outlet />
  const next = params.get('next')
  // 只允许站内路径，防止被利用做开放重定向
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return <Navigate to={safe} replace />
}
