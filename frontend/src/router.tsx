import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { PublicOnly, RequireAdmin, RequireAuth } from './components/guards'

export interface RouteHandle {
  title?: string
  /** 移动端顶栏显示返回按钮；值是没有浏览历史时的默认返回地址 */
  back?: string
}

/** 按页面拆包：路由第一次访问时才加载对应的页面代码 */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [{ path: '/login', lazy: page(() => import('./views/LoginView')) }],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, lazy: page(() => import('./views/TodayView')), handle: { title: '今日' } },
      { path: 'wardrobe', lazy: page(() => import('./views/WardrobeView')), handle: { title: '衣柜' } },
      {
        path: 'wardrobe/new',
        lazy: page(() => import('./views/ItemEditView')),
        handle: { title: '添加衣物', back: '/wardrobe' },
      },
      {
        path: 'wardrobe/:id',
        lazy: page(() => import('./views/ItemDetailView')),
        handle: { title: '衣物详情', back: '/wardrobe' },
      },
      {
        path: 'wardrobe/:id/edit',
        lazy: page(() => import('./views/ItemEditView')),
        handle: { title: '编辑衣物', back: '/wardrobe' },
      },
      { path: 'outfits', lazy: page(() => import('./views/OutfitsView')), handle: { title: '搭配' } },
      {
        path: 'outfits/new',
        lazy: page(() => import('./views/OutfitEditView')),
        handle: { title: '新建搭配', back: '/outfits' },
      },
      {
        path: 'outfits/:id',
        lazy: page(() => import('./views/OutfitDetailView')),
        handle: { title: '搭配详情', back: '/outfits' },
      },
      {
        path: 'outfits/:id/edit',
        lazy: page(() => import('./views/OutfitEditView')),
        handle: { title: '编辑搭配', back: '/outfits' },
      },
      { path: 'calendar', lazy: page(() => import('./views/CalendarView')), handle: { title: '穿着记录' } },
      {
        path: 'calendar/new',
        lazy: page(() => import('./views/WearLogEditView')),
        handle: { title: '记录穿着', back: '/calendar' },
      },
      {
        path: 'calendar/:id/edit',
        lazy: page(() => import('./views/WearLogEditView')),
        handle: { title: '编辑记录', back: '/calendar' },
      },
      { path: 'settings', lazy: page(() => import('./views/SettingsView')), handle: { title: '设置' } },
      {
        element: <RequireAdmin />,
        children: [
          {
            path: 'admin/users',
            lazy: page(() => import('./views/AdminUsersView')),
            handle: { title: '用户管理' },
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
