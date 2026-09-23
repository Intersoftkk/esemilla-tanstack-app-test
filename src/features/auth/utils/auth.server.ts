/**
 * SERVER-ONLY auth/tenant context (`*.server.ts` is blocked from the client
 * bundle by TanStack Start import protection).
 *
 *   const tenant = await requireTenant()
 *   const api = await requireAuthApi()          // throws 401 if signed out
 *   const data = await api.get('v1/whatever')   // Bearer + X-Tenant added
 */
import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { ApiError, isApiError } from '#/lib/api/errors'
import { extractToken, extractUser, type Tenant, type User } from '#/lib/api/types'
import { config } from '#/server/config.server'
import {
  type AuthCookiePayload,
  clearAuthCookie,
  readAuthCookie,
  sealJson,
  unsealJson,
  writeAuthCookie,
} from '#/server/cookie.server'
import { type LaravelRequestOptions, laravelFetch, laravelRequest, type Query } from '#/server/laravel.server'
import { getDeviceName, getPublicOrigin, getTenantHost } from '#/server/request.server'
import { resolveTenant, type TenantResolution } from '#/server/tenant.server'
import type { PendingReset } from '../types/auth.types'
import { safeRedirect } from './auth'

// ---------------------------------------------------------------------------
// Per-request memoisation (keyed on the incoming Request)
// ---------------------------------------------------------------------------

interface RequestState {
  tenant?: Promise<TenantResolution>
  auth?: Promise<AuthCookiePayload | null>
  user?: Promise<User | null>
}
const states = new WeakMap<Request, RequestState>()

function state(): RequestState {
  const req = getRequest()
  let s = states.get(req)
  if (!s) {
    s = {}
    states.set(req, s)
  }
  return s
}

// ---------------------------------------------------------------------------
// Tenant  (GET v1/tenants/check)
// ---------------------------------------------------------------------------

export function getTenantResolution(): Promise<TenantResolution> {
  const s = state()
  s.tenant ??= resolveTenant(getTenantHost())
  return s.tenant
}

/** Active tenant for this host — or throws 404 / 403 / 503. */
export async function requireTenant(): Promise<Tenant> {
  const res = await getTenantResolution()
  switch (res.status) {
    case 'found':
      return res.tenant
    case 'inactive':
      throw new ApiError('This workspace is currently unavailable.', {
        status: 403,
        code: 'tenant_inactive',
      })
    case 'not_found':
      throw new ApiError('Workspace not found.', { status: 404, code: 'tenant_not_found' })
    default:
      throw new ApiError(res.message, { status: 503, code: 'tenant_error' })
  }
}

// ---------------------------------------------------------------------------
// Sanctum token (encrypted HttpOnly cookie)
// ---------------------------------------------------------------------------

export function getAuth(): Promise<AuthCookiePayload | null> {
  const s = state()
  s.auth ??= (async () => {
    const payload = await readAuthCookie()
    if (!payload) return null
    const tenant = await requireTenant()
    // Token issued for another tenant -> drop it (defence in depth).
    if (payload.tenantId !== tenant.id) {
      clearAuthCookie()
      return null
    }
    if (payload.expiresAt && payload.expiresAt <= Date.now()) {
      clearAuthCookie()
      return null
    }
    return payload
  })()
  return s.auth
}

export async function getToken(): Promise<string | null> {
  return (await getAuth())?.token ?? null
}

/** Persist a freshly issued Sanctum token for the current tenant. */
export async function storeToken(responseBody: unknown, opts: { remember: boolean }) {
  const extracted = extractToken(responseBody)
  if (!extracted) {
    throw new ApiError('The API did not return an access token.', {
      status: 502,
      code: 'missing_token',
    })
  }
  const tenant = await requireTenant()
  const payload: AuthCookiePayload = {
    token: extracted.token,
    expiresAt: extracted.expiresAt,
    tenantId: tenant.id,
    remember: opts.remember,
    iat: Date.now(),
  }
  await writeAuthCookie(payload)
  const s = state()
  s.auth = Promise.resolve(payload)
  s.user = undefined
}

export function forgetToken() {
  clearAuthCookie()
  const s = state()
  s.auth = Promise.resolve(null)
  s.user = Promise.resolve(null)
}

// ---------------------------------------------------------------------------
// Bound API client
// ---------------------------------------------------------------------------

type ReqOpts = Omit<LaravelRequestOptions, 'method' | 'body' | 'token' | 'tenant'>

export interface ServerApi {
  tenant: Tenant
  token: string | null
  request<T = unknown>(path: string, opts?: LaravelRequestOptions): Promise<T>
  get<T = unknown>(path: string, query?: Query, opts?: ReqOpts): Promise<T>
  post<T = unknown>(path: string, body?: unknown, opts?: ReqOpts): Promise<T>
  put<T = unknown>(path: string, body?: unknown, opts?: ReqOpts): Promise<T>
  patch<T = unknown>(path: string, body?: unknown, opts?: ReqOpts): Promise<T>
  delete<T = unknown>(path: string, body?: unknown, opts?: ReqOpts): Promise<T>
}

function createServerApi(tenant: Tenant, token: string | null): ServerApi {
  const request = async <T,>(path: string, opts: LaravelRequestOptions = {}) => {
    try {
      return await laravelFetch<T>(path, { ...opts, tenant, token })
    } catch (error) {
      // Token revoked/expired on Laravel -> drop our cookie too.
      if (token && isApiError(error) && error.status === 401) forgetToken()
      throw error
    }
  }
  return {
    tenant,
    token,
    request,
    get: (path, query, opts) => request(path, { ...opts, method: 'GET', query }),
    post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
    put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
    patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
    delete: (path, body, opts) => request(path, { ...opts, method: 'DELETE', body }),
  }
}

/** Tenant-scoped client; sends the token when signed in (public endpoints). */
export async function getApi(): Promise<ServerApi> {
  const tenant = await requireTenant()
  return createServerApi(tenant, await getToken())
}

/** Tenant-scoped client that requires a signed-in user. */
export async function requireAuthApi(): Promise<ServerApi> {
  const tenant = await requireTenant()
  const token = await getToken()
  if (!token) throw new ApiError('Unauthenticated.', { status: 401 })
  return createServerApi(tenant, token)
}

/** GET v1/user/me — memoised per request; null when signed out. */
export function getCurrentUser(): Promise<User | null> {
  const s = state()
  s.user ??= (async () => {
    if (!(await getToken())) return null
    try {
      const api = await requireAuthApi()
      return extractUser(await api.get('v1/user/me'))
    } catch (error) {
      if (isApiError(error) && error.status === 401) return null
      throw error
    }
  })()
  return s.user
}

// ---------------------------------------------------------------------------
// Pending password reset (OTP flow): forgot-password -> /otp -> /reset-password
// The email + code are kept in an encrypted, short-lived HttpOnly cookie so
// they never appear in URLs, history or logs.
// ---------------------------------------------------------------------------

interface PendingResetCookie {
  email: string
  otp: string | null
  tenantId: string
  exp: number
}

const RESET_MAX_AGE = 15 * 60
const resetCookieName = () => (config.cookie.secure ? '__Host-pw_reset' : 'pw_reset')
const resetCookieOpts = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: 'lax' as const,
  path: '/',
})

export async function writePendingReset(email: string, otp: string | null) {
  const tenant = await requireTenant()
  const value: PendingResetCookie = {
    email,
    otp,
    tenantId: tenant.id,
    exp: Date.now() + RESET_MAX_AGE * 1000,
  }
  setCookie(resetCookieName(), await sealJson(value), {
    ...resetCookieOpts(),
    maxAge: RESET_MAX_AGE,
  })
}

export async function readPendingResetCookie(): Promise<PendingResetCookie | null> {
  const raw = getCookie(resetCookieName())
  if (!raw) return null
  const value = await unsealJson<PendingResetCookie>(raw)
  if (!value || value.exp < Date.now()) return null
  const tenant = await requireTenant()
  return value.tenantId === tenant.id ? value : null
}

export async function readPendingReset(): Promise<PendingReset | null> {
  const value = await readPendingResetCookie()
  return value ? { email: value.email, hasCode: !!value.otp } : null
}

export function clearPendingReset() {
  deleteCookie(resetCookieName(), resetCookieOpts())
}

// ---------------------------------------------------------------------------
// Social login (Laravel Socialite, stateless)
//   /auth/redirect/:provider -> GET v1/user/auth/{provider}
//   provider -> /auth/callback/:provider -> GET v1/user/auth/{provider}/callback
// ---------------------------------------------------------------------------

const PROVIDER_RE = /^[a-z0-9_-]{2,32}$/
const stateCookieName = () => (config.cookie.secure ? '__Host-oauth_state' : 'oauth_state')

interface OAuthState {
  state: string
  provider: string
  redirect: string
}

const redirectTo = (location: string) =>
  new Response(null, { status: 302, headers: { location } })
const signInError = (message: string) =>
  redirectTo(`/sign-in?error=${encodeURIComponent(message)}`)
const callbackUrl = (request: Request, provider: string) =>
  `${getPublicOrigin(request)}/auth/callback/${provider}`

export async function startSocialSignIn(request: Request, provider: string): Promise<Response> {
  if (!PROVIDER_RE.test(provider)) return signInError('Unsupported sign-in provider.')
  try {
    const tenant = await requireTenant()
    const oauth: OAuthState = {
      state: crypto.randomUUID(),
      provider,
      redirect: safeRedirect(new URL(request.url).searchParams.get('redirect')),
    }
    setCookie(stateCookieName(), await sealJson(oauth), {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })

    const res = await laravelRequest(`v1/user/auth/${provider}`, {
      tenant,
      query: { redirect_uri: callbackUrl(request, provider), state: oauth.state },
    })
    const body = res.data as Record<string, unknown> | null
    const nested = body?.data as Record<string, unknown> | undefined
    const location =
      res.headers.get('location') ??
      (body?.url as string | undefined) ??
      (body?.redirect_url as string | undefined) ??
      (body?.target_url as string | undefined) ??
      (nested?.url as string | undefined)

    if (!location || !/^https:\/\//.test(location)) {
      return signInError('Could not start social sign-in.')
    }
    return redirectTo(location)
  } catch (error) {
    console.error('[social] redirect failed', error)
    return signInError(isApiError(error) ? error.message : 'Could not start social sign-in.')
  }
}

export async function finishSocialSignIn(request: Request, provider: string): Promise<Response> {
  if (!PROVIDER_RE.test(provider)) return signInError('Unsupported sign-in provider.')

  const url = new URL(request.url)
  const raw = getCookie(stateCookieName())
  deleteCookie(stateCookieName(), { path: '/', secure: config.cookie.secure })
  const saved = raw ? await unsealJson<OAuthState>(raw) : null

  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (providerError) return signInError(providerError)

  if (!saved || saved.provider !== provider || saved.state !== url.searchParams.get('state')) {
    return signInError('Sign-in session expired. Please try again.')
  }

  try {
    const tenant = await requireTenant()
    const query: Record<string, string> = Object.fromEntries(url.searchParams)
    query.redirect_uri = callbackUrl(request, provider)
    query.device_name = getDeviceName()

    const res = await laravelRequest(`v1/user/auth/${provider}/callback`, { tenant, query })
    await storeToken(res.data, { remember: true })
    return redirectTo(safeRedirect(saved.redirect))
  } catch (error) {
    console.error('[social] callback failed', error)
    return signInError(isApiError(error) ? error.message : 'Social sign-in failed.')
  }
}
