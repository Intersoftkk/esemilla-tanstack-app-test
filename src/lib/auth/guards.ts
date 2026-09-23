/**
 * Route guards used in `beforeLoad`.
 *
 * The session (tenant + user) is loaded once by the root route and cached in
 * React Query, so these guards are free on client-side navigation.
 */
import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import type { User } from '#/lib/api/types'
import type { SessionState } from './functions'
import { sessionQueryOptions } from './queries'

export async function loadSession(queryClient: QueryClient): Promise<SessionState> {
  return queryClient.ensureQueryData(sessionQueryOptions())
}

/** Redirect to /login?redirect=<current> when not logged in. */
export async function requireUser(
  queryClient: QueryClient,
  location: { href: string },
): Promise<User> {
  const session = await loadSession(queryClient)
  if (!session.user) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
  return session.user
}

/** Redirect logged-in users away from guest pages (login, register…). */
export async function requireGuest(queryClient: QueryClient, to = '/dashboard') {
  const session = await loadSession(queryClient)
  if (session.user) throw redirect({ to })
}
