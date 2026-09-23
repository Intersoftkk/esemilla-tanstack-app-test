import { queryOptions } from '@tanstack/react-query'
import {
  getNotificationPreferencesFn,
  getSessionFn,
  listSessionsFn,
  passwordStatusFn,
} from './functions'

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  sessions: () => [...authKeys.all, 'sessions'] as const,
  passwordStatus: () => [...authKeys.all, 'password-status'] as const,
  notificationPreferences: () => [...authKeys.all, 'notification-preferences'] as const,
}

/** Tenant + current user. Loaded once during SSR, then hydrated. */
export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.session(),
    queryFn: () => getSessionFn(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  })

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.sessions(),
    queryFn: () => listSessionsFn(),
  })

export const passwordStatusQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.passwordStatus(),
    queryFn: () => passwordStatusFn(),
  })

export const notificationPreferencesQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.notificationPreferences(),
    queryFn: () => getNotificationPreferencesFn(),
  })
