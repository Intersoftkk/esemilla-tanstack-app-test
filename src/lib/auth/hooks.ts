import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { Tenant, User } from '#/lib/api/types'
import {
  changePasswordFn,
  confirmDeleteAccountFn,
  confirmPasswordFn,
  deleteAccountFn,
  forgotPasswordFn,
  loginFn,
  logoutAllFn,
  logoutFn,
  patchProfileFn,
  registerFn,
  resetPasswordFn,
  revokeOtherSessionsFn,
  revokeSessionFn,
  type SessionState,
  socialTokenLoginFn,
  updateNotificationPreferencesFn,
  updateProfileFn,
} from './functions'
import {
  authKeys,
  notificationPreferencesQueryOptions,
  sessionQueryOptions,
  sessionsQueryOptions,
} from './queries'

// ---------------------------------------------------------------------------
// Reading state
// ---------------------------------------------------------------------------

export function useSession() {
  return useSuspenseQuery(sessionQueryOptions()).data
}

export function useAuth() {
  const session = useSession()
  const user = session.user
  return {
    user,
    isAuthenticated: !!user,
    tenant: session.tenant.status === 'found' ? session.tenant.tenant : null,
  }
}

/** Current tenant (only use below routes where the tenant is guaranteed). */
export function useTenant(): Tenant {
  const session = useSession()
  if (session.tenant.status !== 'found') {
    throw new Error('useTenant() used outside a resolved tenant.')
  }
  return session.tenant.tenant
}

/** Current user (only use inside `_authed` routes). */
export function useUser(): User {
  const { user } = useSession()
  if (!user) throw new Error('useUser() used outside an authenticated route.')
  return user
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

export function setSessionUser(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData<SessionState>(authKeys.session(), (old) =>
    old ? { ...old, user } : old,
  )
}

/**
 * After login/logout: update the user in cache, drop every other cached query
 * (they belong to the previous user) and re-run route guards/loaders.
 */
function useAfterAuthChange() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async (user: User | null) => {
    queryClient.removeQueries({
      predicate: (q) => q.queryKey[0] !== authKeys.all[0] || q.queryKey[1] !== 'session',
    })
    if (user) setSessionUser(queryClient, user)
    else await queryClient.invalidateQueries({ queryKey: authKeys.session() })
    await router.invalidate()
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useLogin() {
  const fn = useServerFn(loginFn)
  const after = useAfterAuthChange()
  return useMutation({
    mutationFn: (data: Parameters<typeof loginFn>[0]['data']) => fn({ data }),
    onSuccess: (res) => after(res.user),
  })
}

export function useRegister() {
  const fn = useServerFn(registerFn)
  const after = useAfterAuthChange()
  return useMutation({
    mutationFn: (data: Parameters<typeof registerFn>[0]['data']) => fn({ data }),
    onSuccess: (res) => (res.user ? after(res.user) : undefined),
  })
}

export function useSocialTokenLogin() {
  const fn = useServerFn(socialTokenLoginFn)
  const after = useAfterAuthChange()
  return useMutation({
    mutationFn: (data: Parameters<typeof socialTokenLoginFn>[0]['data']) =>
      fn({ data }),
    onSuccess: (res) => after(res.user),
  })
}

export function useLogout() {
  const fn = useServerFn(logoutFn)
  const after = useAfterAuthChange()
  const router = useRouter()
  return useMutation({
    mutationFn: () => fn(),
    onSettled: async () => {
      await after(null)
      await router.navigate({ to: '/login' })
    },
  })
}

export function useLogoutAll() {
  const fn = useServerFn(logoutAllFn)
  const after = useAfterAuthChange()
  const router = useRouter()
  return useMutation({
    mutationFn: () => fn(),
    onSettled: async () => {
      await after(null)
      await router.navigate({ to: '/login' })
    },
  })
}

export function useForgotPassword() {
  const fn = useServerFn(forgotPasswordFn)
  return useMutation({
    mutationFn: (data: Parameters<typeof forgotPasswordFn>[0]['data']) =>
      fn({ data }),
  })
}

export function useResetPassword() {
  const fn = useServerFn(resetPasswordFn)
  return useMutation({
    mutationFn: (data: Parameters<typeof resetPasswordFn>[0]['data']) =>
      fn({ data }),
  })
}

export function useChangePassword() {
  const fn = useServerFn(changePasswordFn)
  return useMutation({
    mutationFn: (data: Parameters<typeof changePasswordFn>[0]['data']) =>
      fn({ data }),
  })
}

export function useConfirmPassword() {
  const fn = useServerFn(confirmPasswordFn)
  return useMutation({
    mutationFn: (data: Parameters<typeof confirmPasswordFn>[0]['data']) =>
      fn({ data }),
  })
}

export function useUpdateProfile({ partial = true }: { partial?: boolean } = {}) {
  const put = useServerFn(updateProfileFn)
  const patch = useServerFn(patchProfileFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      partial ? patch({ data }) : put({ data }),
    onSuccess: async (res) => {
      if (res.user) setSessionUser(queryClient, res.user)
      else await queryClient.invalidateQueries({ queryKey: authKeys.session() })
    },
  })
}

export function useDeleteAccount() {
  const fn = useServerFn(deleteAccountFn)
  const after = useAfterAuthChange()
  return useMutation({
    mutationFn: (data: Parameters<typeof deleteAccountFn>[0]['data']) =>
      fn({ data }),
    onSuccess: (res) => (res.deleted ? after(null) : undefined),
  })
}

export function useConfirmDeleteAccount() {
  const fn = useServerFn(confirmDeleteAccountFn)
  const after = useAfterAuthChange()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => fn({ data }),
    onSuccess: () => after(null),
  })
}

export function useSessions() {
  return useQuery(sessionsQueryOptions())
}

export function useRevokeSession() {
  const fn = useServerFn(revokeSessionFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string | number) => fn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.sessions() }),
  })
}

export function useRevokeOtherSessions() {
  const fn = useServerFn(revokeOtherSessionsFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.sessions() }),
  })
}

export function useNotificationPreferences() {
  return useQuery(notificationPreferencesQueryOptions())
}

export function useUpdateNotificationPreferences() {
  const fn = useServerFn(updateNotificationPreferencesFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => fn({ data }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: authKeys.notificationPreferences() }),
  })
}
