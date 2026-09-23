/**
 * Auth server functions — one per Laravel `v1/user/*` endpoint.
 *
 * They run on the TanStack Start server (never in the browser), so the
 * Sanctum token stays inside the encrypted HttpOnly cookie. Call them from
 * anywhere: loaders, beforeLoad, components, React Query.
 */
import { createServerFn } from '@tanstack/react-start'
import { ApiError, isApiError } from '#/lib/api/errors'
import {
  type AuthSessionEntry,
  extractMessage,
  extractUser,
  type Json,
  type JsonObject,
  type Tenant,
  toJson,
  unwrapData,
  type User,
} from '#/lib/api/types'
import { getDeviceName } from '#/server/request.server'
import {
  forgetToken,
  getApi,
  getCurrentUser,
  getTenantResolution,
  maybeRefreshToken,
  requireAuthApi,
  storeToken,
} from '#/server/session.server'
import { authMiddleware } from './middleware'
import {
  changePasswordSchema,
  confirmDeleteSchema,
  confirmPasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdSchema,
  socialTokenSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// Session bootstrap (used by the root route on every request)
// ---------------------------------------------------------------------------

export type TenantState =
  | { status: 'found'; tenant: Tenant }
  | { status: 'inactive'; tenant: Tenant | null }
  | { status: 'not_found'; host: string }
  | { status: 'error'; message: string }

export interface SessionState {
  tenant: TenantState
  user: User | null
}

/**
 * Resolves the tenant from the Host header (GET v1/tenants/check) and, if a
 * token cookie exists, the current user (GET v1/user/me).
 */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionState> => {
    const res = await getTenantResolution()

    if (res.status === 'not_found') {
      return { tenant: { status: 'not_found', host: res.host }, user: null }
    }
    if (res.status === 'inactive') {
      return {
        tenant: { status: 'inactive', tenant: res.tenant.id ? res.tenant : null },
        user: null,
      }
    }
    if (res.status === 'error') {
      return { tenant: { status: 'error', message: res.message }, user: null }
    }

    await maybeRefreshToken()
    let user: User | null = null
    try {
      user = await getCurrentUser()
    } catch (error) {
      // API hiccup: render as guest instead of crashing the whole page.
      console.error('[auth] failed to load current user', error)
    }
    return { tenant: { status: 'found', tenant: res.tenant }, user }
  },
)

// ---------------------------------------------------------------------------
// Guest endpoints
// ---------------------------------------------------------------------------

/** POST v1/user/login */
export const loginFn = createServerFn({ method: 'POST' })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const api = await getApi()
    const body = await api.post('v1/user/login', {
      email: data.email,
      password: data.password,
      remember: data.remember,
      device_name: getDeviceName(),
    })
    await storeToken(body, { remember: data.remember })
    return { user: extractUser(body) ?? (await getCurrentUser()) }
  })

/** POST v1/user/register */
export const registerFn = createServerFn({ method: 'POST' })
  .validator(registerSchema)
  .handler(async ({ data }) => {
    const api = await getApi()
    const { remember, ...payload } = data
    const body = await api.post('v1/user/register', {
      ...payload,
      device_name: getDeviceName(),
    })

    // Some APIs require email verification before issuing a token.
    try {
      await storeToken(body, { remember })
    } catch (error) {
      if (isApiError(error) && error.code === 'missing_token') {
        return {
          user: null,
          message: extractMessage(body, 'Registration successful. Please verify your email.'),
        }
      }
      throw error
    }
    return {
      user: extractUser(body) ?? (await getCurrentUser()),
      message: extractMessage(body, 'Welcome!'),
    }
  })

/** POST v1/user/forgot-password */
export const forgotPasswordFn = createServerFn({ method: 'POST' })
  .validator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    const api = await getApi()
    const body = await api.post('v1/user/forgot-password', data)
    return {
      message: extractMessage(body, 'We have emailed your password reset link.'),
    }
  })

/** POST v1/user/reset-password */
export const resetPasswordFn = createServerFn({ method: 'POST' })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    const api = await getApi()
    const body = await api.post('v1/user/reset-password', data)
    return { message: extractMessage(body, 'Your password has been reset.') }
  })

/**
 * POST v1/user/auth/{provider}/token
 * Exchange a provider token (Google One Tap credential, native SDK token…)
 * for a Sanctum token.
 */
export const socialTokenLoginFn = createServerFn({ method: 'POST' })
  .validator(socialTokenSchema)
  .handler(async ({ data }) => {
    const api = await getApi()
    const body = await api.post(
      `v1/user/auth/${encodeURIComponent(data.provider)}/token`,
      { token: data.token, access_token: data.token, device_name: getDeviceName() },
    )
    await storeToken(body, { remember: data.remember })
    return { user: extractUser(body) ?? (await getCurrentUser()) }
  })

// ---------------------------------------------------------------------------
// Authenticated endpoints
// ---------------------------------------------------------------------------

/** GET v1/user/me */
export const getMeFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = extractUser(await context.api.get('v1/user/me'))
    if (!user) throw new ApiError('Unauthenticated.', { status: 401 })
    return user
  })

/** PUT v1/user/me (full update) */
export const updateProfileFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(profileSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.put('v1/user/me', data)
    return {
      user: extractUser(body),
      message: extractMessage(body, 'Profile updated.'),
    }
  })

/** PATCH v1/user/me (partial update) */
export const patchProfileFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(profileSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.patch('v1/user/me', data)
    return {
      user: extractUser(body),
      message: extractMessage(body, 'Profile updated.'),
    }
  })

/** DELETE v1/user/me (request deletion — may send a confirmation email/code) */
export const deleteAccountFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(deleteAccountSchema)
  .handler(async ({ context, data }) => {
    const res = await context.api.request('v1/user/me', {
      method: 'DELETE',
      body: data,
    })
    const deleted =
      (res as { deleted?: boolean } | null)?.deleted === true ||
      (unwrapData<{ deleted?: boolean } | null>(res)?.deleted ?? false)
    if (deleted) forgetToken()
    return {
      deleted,
      message: extractMessage(res, 'Check your email to confirm account deletion.'),
    }
  })

/** POST v1/user/me/delete/confirm */
export const confirmDeleteAccountFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(confirmDeleteSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.post('v1/user/me/delete/confirm', data)
    forgetToken()
    return { message: extractMessage(body, 'Your account has been deleted.') }
  })

/** POST v1/user/logout — always clears the local cookie. */
export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    const api = await requireAuthApi()
    await api.post('v1/user/logout')
  } catch (error) {
    if (!(isApiError(error) && error.status === 401)) {
      console.error('[auth] logout request failed', error)
    }
  } finally {
    forgetToken()
  }
  return { ok: true }
})

/** POST v1/user/logout-all — revoke every token of the user. */
export const logoutAllFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      await context.api.post('v1/user/logout-all')
    } finally {
      forgetToken()
    }
    return { ok: true }
  })

/** POST v1/user/refresh-token — rotate the token manually. */
export const refreshTokenFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const body = await context.api.post('v1/user/refresh-token')
    await storeToken(body, { remember: true })
    return { ok: true }
  })

/** GET v1/user/sessions */
export const listSessionsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const body = unwrapData(await context.api.get('v1/user/sessions'))
    const list = Array.isArray(body)
      ? body
      : ((body as { sessions?: unknown })?.sessions ?? [])
    return toJson(list) as unknown as Array<AuthSessionEntry>
  })

/** DELETE v1/user/sessions/{id} */
export const revokeSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(sessionIdSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.delete(
      `v1/user/sessions/${encodeURIComponent(String(data.id))}`,
    )
    return { message: extractMessage(body, 'Session revoked.') }
  })

/** DELETE v1/user/sessions — revoke all *other* sessions. */
export const revokeOtherSessionsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const body = await context.api.delete('v1/user/sessions')
    return { message: extractMessage(body, 'Other sessions revoked.') }
  })

/** POST v1/user/change-password */
export const changePasswordFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(changePasswordSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.post('v1/user/change-password', data)
    // Laravel may rotate the token after a password change.
    try {
      await storeToken(body, { remember: true })
    } catch {
      /* no new token returned — keep the current one */
    }
    return { message: extractMessage(body, 'Password changed.') }
  })

/** POST v1/user/password/confirm */
export const confirmPasswordFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(confirmPasswordSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.post('v1/user/password/confirm', data)
    return { message: extractMessage(body, 'Password confirmed.') }
  })

/** GET v1/user/password/status */
export const passwordStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return toJson(unwrapData(await context.api.get('v1/user/password/status'))) as Json
  })

/** GET v1/user/notifications/preferences */
export const getNotificationPreferencesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const body = unwrapData(
      await context.api.get('v1/user/notifications/preferences'),
    )
    const value = toJson(body)
    return (value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}) as JsonObject
  })

/** PUT v1/user/notifications/preferences */
export const updateNotificationPreferencesFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(profileSchema)
  .handler(async ({ context, data }) => {
    const body = await context.api.put('v1/user/notifications/preferences', data)
    return { message: extractMessage(body, 'Preferences saved.') }
  })
