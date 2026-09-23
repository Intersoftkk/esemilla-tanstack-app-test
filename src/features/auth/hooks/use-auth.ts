import { useSuspenseQuery } from '@tanstack/react-query'
import { useSignOutMutation } from '../queries/auth.mutations'
import { sessionQueryOptions } from '../queries/auth.queries'
import type { Tenant, User } from '../types/auth.types'

/** Session (tenant + user), hydrated from SSR. */
export function useSession() {
  return useSuspenseQuery(sessionQueryOptions()).data
}

export function useAuth() {
  const session = useSession()
  const signOut = useSignOutMutation()
  const tenant = session.tenant.status === 'found' ? session.tenant.tenant : null
  return {
    user: session.user,
    tenant,
    isAuthenticated: !!session.user,
    signOut: () => signOut.mutate(),
    isSigningOut: signOut.isPending,
  }
}

/** Current tenant — only inside routes where the tenant is resolved. */
export function useTenant(): Tenant {
  const session = useSession()
  if (session.tenant.status !== 'found') {
    throw new Error('useTenant() used outside a resolved tenant.')
  }
  return session.tenant.tenant
}

/** Current user — only inside `_authed` routes. */
export function useUser(): User {
  const { user } = useSession()
  if (!user) throw new Error('useUser() used outside an authenticated route.')
  return user
}
