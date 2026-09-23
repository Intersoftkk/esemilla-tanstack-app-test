/**
 * SERVER-SIDE call example — runs on the TanStack Start server.
 * `context.api` sends the Bearer token (from the encrypted HttpOnly cookie)
 * plus the X-Tenant headers. Use for SSR, secrets, aggregating Laravel calls.
 */
import { authedServerFn } from '#/features/auth/utils/auth.functions'
import { extractUser, toJson, unwrapData } from '#/lib/api/types'

export const getDashboardFn = authedServerFn({ method: 'GET' }).handler(async ({ context }) => {
  const [me, status] = await Promise.all([
    context.api.get('v1/user/me'),
    context.api.get('v1/user/password/status').catch(() => null),
  ])
  return {
    tenant: context.tenant.name,
    user: extractUser(me),
    passwordStatus: status ? toJson(unwrapData(status)) : null,
    renderedAt: new Date().toISOString(),
  }
})
