import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiError, setUnauthorizedHandler, type User } from './api'
import { queryClient } from './queryClient'

export const ME_KEY = ['auth', 'me'] as const

async function fetchMe(): Promise<User | null> {
  try {
    return await api<User>('/api/auth/me', { skipAuthRedirect: true })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

/** 当前登录用户；未登录时为 null */
export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: Infinity })
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      api<User>('/api/auth/login', { method: 'POST', body, skipAuthRedirect: true }),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST', skipAuthRedirect: true }),
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(ME_KEY, null)
    },
  })
}

// 任何接口返回 401（会话过期、被管理员停用）时，清空登录状态，
// RequireAuth 会据此跳转到登录页
setUnauthorizedHandler(() => queryClient.setQueryData(ME_KEY, null))
