import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import type { SessionState, User } from '../types/auth.types'
import { DEFAULT_AUTHED_REDIRECT } from '../utils/auth'
import {
  getMeFn,
  getNotificationPreferencesFn,
  getPasswordStatusFn,
  getPendingResetFn,
  getSessionFn,
} from '../utils/auth.functions'
import { authKeys } from './auth.keys'

/** Tenant + current user. Loaded during SSR, then hydrated & cached. */
export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.session(),
    queryFn: () => getSessionFn(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  })

/** Fresh `GET v1/user/me` (the session query already contains the user). */
export const meQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: () => getMeFn(),
  })

export const pendingResetQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.pendingReset(),
    queryFn: () => getPendingResetFn(),
    staleTime: 0,
  })

export const passwordStatusQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.passwordStatus(),
    queryFn: () => getPasswordStatusFn(),
  })

export const notificationPreferencesQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.notificationPreferences(),
    queryFn: () => getNotificationPreferencesFn(),
  })

// ---------------------------------------------------------------------------
// Route guards (use in `beforeLoad`) — served from the cache after SSR
// ---------------------------------------------------------------------------

export async function loadSession(queryClient: QueryClient): Promise<SessionState> {
  return queryClient.ensureQueryData(sessionQueryOptions())
}

/** Redirect to /sign-in?redirect=<current> when signed out. */
export async function requireUser(
  queryClient: QueryClient,
  location: { href: string },
): Promise<User> {
  const session = await loadSession(queryClient)
  if (!session.user) {
    throw redirect({ to: '/sign-in', search: { redirect: location.href } })
  }
  return session.user
}

/** Redirect signed-in users away from guest pages. */
export async function requireGuest(queryClient: QueryClient, to = DEFAULT_AUTHED_REDIRECT) {
  const session = await loadSession(queryClient)
  if (session.user) throw redirect({ to })
}
