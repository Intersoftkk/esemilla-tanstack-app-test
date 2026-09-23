/**
 * Server-function middleware.
 *
 *   createServerFn().middleware([authMiddleware]).handler(({ context }) =>
 *     context.api.get('v1/orders'))
 *
 * `.server()` bodies are stripped from the client bundle by the Start
 * compiler, so importing `*.server.ts` here is safe.
 */
import { createMiddleware } from '@tanstack/react-start'
import { ApiError } from '#/lib/api/errors'
import {
  getApi,
  getCurrentUser,
  requireAuthApi,
  requireTenant,
} from '#/server/session.server'

/** Resolves the tenant for the current host (404/403 if invalid). */
export const tenantMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const tenant = await requireTenant()
    return next({ context: { tenant } })
  },
)

/** Tenant + guest-or-authenticated API client. */
export const apiMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const api = await getApi()
    return next({ context: { tenant: api.tenant, api } })
  },
)

/** Requires a valid Sanctum token; exposes an authenticated API client. */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const api = await requireAuthApi()
    return next({ context: { tenant: api.tenant, api } })
  },
)

/** Like authMiddleware but also loads the user (GET v1/user/me). */
export const userMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ next }) => {
    const user = await getCurrentUser()
    if (!user) throw new ApiError('Unauthenticated.', { status: 401 })
    return next({ context: { user } })
  })
