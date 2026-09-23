import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '#/features/dashboard/dashboard'
import { dashboardQueryOptions } from '#/features/dashboard/queries/dashboard.queries'

export const Route = createFileRoute('/_authed/dashboard')({
  // SERVER-SIDE: prefetched during SSR (or via server fn on client navigation).
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions()),
  head: () => ({ meta: [{ title: 'Dashboard' }] }),
  component: Dashboard,
})
