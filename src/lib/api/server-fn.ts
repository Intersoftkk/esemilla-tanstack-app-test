/**
 * Server-function factories for SERVER-SIDE API calls from your own features.
 *
 * Example (src/features/orders/api.ts):
 *
 *   export const getOrdersFn = authedServerFn({ method: 'GET' })
 *     .validator(z.object({ page: z.number().default(1) }))
 *     .handler(({ context, data }) =>
 *       context.api.get<Paginated<Order>>('v1/orders', { page: data.page }),
 *     )
 *
 *   // in a route
 *   loader: () => getOrdersFn({ data: { page: 1 } })
 *
 *   // or with React Query (works during SSR *and* in the browser)
 *   queryOptions({ queryKey: ['orders', page], queryFn: () => getOrdersFn({ data: { page } }) })
 *
 * NOTE: these must stay module-level constants (not wrapper functions) so the
 * TanStack Start compiler can see the middleware chain.
 */
import { createServerFn } from '@tanstack/react-start'
import { apiMiddleware, authMiddleware, userMiddleware } from '#/lib/auth/middleware'

/** `context.api` (guest or authenticated) + `context.tenant`. */
export const tenantServerFn = createServerFn().middleware([apiMiddleware])

/** Requires login; `context.api` sends the Bearer token + tenant headers. */
export const authedServerFn = createServerFn().middleware([authMiddleware])

/** Like authedServerFn, plus `context.user` (GET v1/user/me). */
export const userServerFn = createServerFn().middleware([userMiddleware])
