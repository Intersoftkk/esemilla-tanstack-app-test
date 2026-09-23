/**
 * EXAMPLE feature showing both ways to call your Laravel API after login.
 * Replace `v1/user/me` with your real endpoints (e.g. `v1/orders`).
 */
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '#/lib/api/client'
import { authedServerFn } from '#/lib/api/server-fn'
import { extractUser, type User } from '#/lib/api/types'

// ---------------------------------------------------------------------------
// 1) SERVER-SIDE call — runs on the TanStack Start server.
//    Use for SSR data, secrets, aggregation of several Laravel calls, etc.
// ---------------------------------------------------------------------------
export const getDashboardFn = authedServerFn({ method: 'GET' })
  .validator(z.object({ include: z.string().optional() }).optional())
  .handler(async ({ context }) => {
    // context.api automatically sends: Bearer token + X-Tenant headers.
    const me = extractUser(await context.api.get('v1/user/me'))
    return {
      tenant: context.tenant.name,
      user: me,
      renderedAt: new Date().toISOString(),
    }
  })

export const dashboardQueryOptions = () =>
  queryOptions({
    queryKey: ['example', 'dashboard'],
    queryFn: () => getDashboardFn(),
  })

// ---------------------------------------------------------------------------
// 2) CLIENT-SIDE call — browser -> /api/* proxy -> Laravel.
//    Use for interactive UI: search-as-you-type, infinite lists, polling…
// ---------------------------------------------------------------------------
export const profileClientQueryOptions = () =>
  queryOptions({
    queryKey: ['example', 'profile-client'],
    queryFn: async () => extractUser(await api.get('v1/user/me')) as User,
  })
