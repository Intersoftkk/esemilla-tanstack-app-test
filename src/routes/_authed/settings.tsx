import { createFileRoute } from '@tanstack/react-router'
import {
  notificationPreferencesQueryOptions,
  passwordStatusQueryOptions,
} from '#/features/auth/queries/auth.queries'
import { Settings } from '#/features/settings/settings'

export const Route = createFileRoute('/_authed/settings')({
  // Prefetch in parallel; failures are shown inline by the components.
  loader: ({ context }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(passwordStatusQueryOptions()),
      context.queryClient.ensureQueryData(notificationPreferencesQueryOptions()),
    ]),
  head: () => ({ meta: [{ title: 'Settings' }] }),
  component: Settings,
})
