import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { extractUser, type User } from '#/lib/api/types'
import { getDashboardFn } from '../utils/dashboard.functions'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  server: () => [...dashboardKeys.all, 'server'] as const,
  client: () => [...dashboardKeys.all, 'client-me'] as const,
}

/** SERVER-SIDE: server function, prefetched in the route loader (SSR). */
export const dashboardQueryOptions = () =>
  queryOptions({ queryKey: dashboardKeys.server(), queryFn: () => getDashboardFn() })

/** CLIENT-SIDE: browser -> /api/* proxy -> Laravel (token attached by proxy). */
export const clientMeQueryOptions = () =>
  queryOptions({
    queryKey: dashboardKeys.client(),
    queryFn: async () => extractUser(await api.get('v1/user/me')) as User,
  })
