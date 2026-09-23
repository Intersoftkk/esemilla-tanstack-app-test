/**
 * Auth server functions — one per Laravel `v1/user/*` endpoint.
 *
 * They execute on the TanStack Start server (the browser only gets an RPC
 * stub), so the Sanctum token stays inside the encrypted HttpOnly cookie.
 */
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ApiError, isApiError } from '#/lib/api/errors'
import { extractMessage, extractUser, type JsonObject, toJson, unwrapData } from '#/lib/api/types'
import { getDeviceName } from '#/server/request.server'
import { forgotPasswordSchema } from '../schema/forgot-password.schema'
import { otpSchema } from '../schema/otp.schema'
import {
  changePasswordSchema,
  confirmPasswordSchema,
  resetPasswordRequestSchema,
} from '../schema/reset-password.schema'
import { signInSchema } from '../schema/sign-in.schema'
import { signUpSchema } from '../schema/sign-up.schema'
import type {
  AuthResult,
  MessageResult,
  NotificationPreferences,
  PasswordStatus,
  PendingReset,
  SessionState,
  SignUpResult,
} from '../types/auth.types'
import {
  clearPendingReset,
  forgetToken,
  getApi,
  getCurrentUser,
  getTenantResolution,
  readPendingReset,
  readPendingResetCookie,
  requireAuthApi,
  requireTenant,
  storeToken,
  writePendingReset,
} from './auth.server'

// ---------------------------------------------------------------------------
// Middleware (reuse in any feature: `.middleware([authMiddleware])`)
// ---------------------------------------------------------------------------

/** `context.tenant` + `context.api` (guest or signed-in). */
export const tenantMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const api = await getApi()
    return next({ context: { tenant: api.tenant, api } })
  },
)

/** Requires a Sanctum token; `context.api` sends `Authorization: Bearer`. */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const api = await requireAuthApi()
    return next({ context: { tenant: api.tenant, api } })
  },
)

/** Server-function factories for other features. */
export const tenantServerFn = createServerFn().middleware([tenantMiddleware])
export const authedServerFn = createServerFn().middleware([authMiddleware])

// ---------------------------------------------------------------------------
// Session bootstrap — GET v1/tenants/check (+ GET v1/user/me)
// ---------------------------------------------------------------------------

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

    let user = null
    try {
      user = await getCurrentUser()
    } catch (error) {
      // API hiccup: render as guest instead of crashing the page.
      console.error('[auth] failed to load current user', error)
    }
    return { tenant: { status: 'found', tenant: res.tenant }, user }
  },
)

// ---------------------------------------------------------------------------
// Guest endpoints
// ---------------------------------------------------------------------------

/** POST v1/user/login */
export const signInFn = createServerFn({ method: 'POST' })
  .validator(signInSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
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
export const signUpFn = createServerFn({ method: 'POST' })
  .validator(signUpSchema)
  .handler(async ({ data }): Promise<SignUpResult> => {
    const api = await getApi()
    const body = await api.post('v1/user/register', {
      ...data,
      device_name: getDeviceName(),
    })
    try {
      await storeToken(body, { remember: true })
    } catch (error) {
      // API requires email verification before issuing a token.
      if (isApiError(error) && error.code === 'missing_token') {
        return {
          user: null,
          message: extractMessage(body, 'Account created. Please verify your email.'),
        }
      }
      throw error
    }
    return {
      user: extractUser(body) ?? (await getCurrentUser()),
      message: extractMessage(body, 'Welcome!'),
    }
  })

/** POST v1/user/forgot-password (starts the OTP flow when mode = otp) */
export const forgotPasswordFn = createServerFn({ method: 'POST' })
  .validator(forgotPasswordSchema)
  .handler(async ({ data }): Promise<MessageResult> => {
    const api = await getApi()
    const body = await api.post('v1/user/forgot-password', data)
    await writePendingReset(data.email, null)
    return {
      message: extractMessage(body, 'We have emailed you a password reset code.'),
    }
  })

/** Current pending reset (email + whether a code was entered). */
export const getPendingResetFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PendingReset | null> => readPendingReset(),
)

/**
 * Store the OTP the user typed. Your API has no separate "verify OTP"
 * endpoint, so the code is verified by `reset-password`; if Laravel rejects
 * it the reset form sends the user back to /otp.
 */
export const submitOtpFn = createServerFn({ method: 'POST' })
  .validator(otpSchema.pick({ otp: true }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    // Trust only the email stored server-side at forgot-password time.
    const pending = await readPendingResetCookie()
    if (!pending) {
      throw new ApiError('Your reset session has expired. Please request a new code.', {
        status: 422,
        code: 'otp_missing',
        errors: { otp: ['Your reset session has expired. Please request a new code.'] },
      })
    }
    await writePendingReset(pending.email, data.otp)
    return { ok: true }
  })

/** POST v1/user/reset-password */
export const resetPasswordFn = createServerFn({ method: 'POST' })
  .validator(resetPasswordRequestSchema)
  .handler(async ({ data }): Promise<MessageResult> => {
    let token = data.token
    let email = data.email
    if (!token) {
      const pending = await readPendingResetCookie()
      if (!pending?.otp) {
        throw new ApiError('Your reset code has expired. Please request a new one.', {
          status: 422,
          code: 'otp_missing',
          errors: { otp: ['Please enter the code we emailed you.'] },
        })
      }
      token = pending.otp
      email = pending.email
    }

    const api = await getApi()
    const body = await api.post('v1/user/reset-password', {
      email,
      // Laravel's Password broker uses `token`; OTP-based controllers often
      // use `otp`/`code`. Send all so either implementation works.
      token,
      otp: token,
      code: token,
      password: data.password,
      password_confirmation: data.password_confirmation,
    })
    clearPendingReset()
    return { message: extractMessage(body, 'Your password has been reset.') }
  })

/**
 * POST v1/user/auth/{provider}/token
 * Exchange a provider token (Google One Tap credential, native SDK) for a
 * Sanctum token.
 */
export const socialTokenSignInFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      provider: z.string().regex(/^[a-z0-9_-]{2,32}$/),
      token: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<AuthResult> => {
    const api = await getApi()
    const body = await api.post(`v1/user/auth/${data.provider}/token`, {
      token: data.token,
      access_token: data.token,
      device_name: getDeviceName(),
    })
    await storeToken(body, { remember: true })
    return { user: extractUser(body) ?? (await getCurrentUser()) }
  })

// ---------------------------------------------------------------------------
// Authenticated endpoints (auth:sanctum)
// ---------------------------------------------------------------------------

/** GET v1/user/me */
export const getMeFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = extractUser(await context.api.get('v1/user/me'))
    if (!user) throw new ApiError('Unauthenticated.', { status: 401 })
    return user
  })

/** POST v1/user/logout — always clears the local cookie. */
export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    await requireTenant()
    const api = await requireAuthApi()
    await api.post('v1/user/logout')
  } catch (error) {
    if (!(isApiError(error) && error.status === 401)) {
      console.error('[auth] logout request failed', error)
    }
  } finally {
    forgetToken()
  }
  return { ok: true as const }
})

/** POST v1/user/change-password */
export const changePasswordFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(changePasswordSchema)
  .handler(async ({ context, data }): Promise<MessageResult> => {
    const body = await context.api.post('v1/user/change-password', data)
    // Some implementations rotate the token after a password change.
    try {
      await storeToken(body, { remember: true })
    } catch {
      /* no new token — keep the current one */
    }
    return { message: extractMessage(body, 'Password changed.') }
  })

/** POST v1/user/password/confirm */
export const confirmPasswordFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(confirmPasswordSchema)
  .handler(async ({ context, data }): Promise<MessageResult> => {
    const body = await context.api.post('v1/user/password/confirm', data)
    return { message: extractMessage(body, 'Password confirmed.') }
  })

/** GET v1/user/password/status */
export const getPasswordStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PasswordStatus> => {
    const value = toJson(unwrapData(await context.api.get('v1/user/password/status')))
    return (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as JsonObject
  })

/** GET v1/user/notifications/preferences */
export const getNotificationPreferencesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<NotificationPreferences> => {
    const value = toJson(
      unwrapData(await context.api.get('v1/user/notifications/preferences')),
    )
    return (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as JsonObject
  })

/** PUT v1/user/notifications/preferences */
export const updateNotificationPreferencesFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.record(z.string(), z.unknown()))
  .handler(async ({ context, data }): Promise<MessageResult> => {
    const body = await context.api.put('v1/user/notifications/preferences', data)
    return { message: extractMessage(body, 'Preferences saved.') }
  })
