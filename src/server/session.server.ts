/**
 * Per-request auth/tenant context for server code
 * (server functions, loaders via server functions, server routes).
 *
 *   const { tenant } = await requireTenant()
 *   const api = await requireAuthApi()          // throws 401 if logged out
 *   const orders = await api.get('v1/orders')   // Bearer + X-Tenant added
 */
import { getRequest } from '@tanstack/react-start/server'
import { ApiError, isApiError } from '#/lib/api/errors'
import { extractToken, extractUser, type Tenant, type User } from '#/lib/api/types'
import {
  type AuthCookiePayload,
  clearAuthCookie,
  readAuthCookie,
  writeAuthCookie,
} from './cookie.server'
import { config } from './config.server'
import {
  type LaravelRequestOptions,
  laravelFetch,
  type Query,
} from './laravel.server'
import { getTenantHost } from './request.server'
import { resolveTenant, type TenantResolution } from './tenant.server'

// ---------------------------------------------------------------------------
// Per-request memoisation (keyed on the Request object)
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
// Tenant
// ---------------------------------------------------------------------------

export function getTenantResolution(): Promise<TenantResolution> {
  const s = state()
  s.tenant ??= resolveTenant(getTenantHost())
  return s.tenant
}

/** Resolved, active tenant for this host — or throws 404 / 403 / 503. */
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
      throw new ApiError('Workspace not found.', {
        status: 404,
        code: 'tenant_not_found',
      })
    default:
      throw new ApiError(res.message, { status: 503, code: 'tenant_error' })
  }
}

// ---------------------------------------------------------------------------
// Token (encrypted cookie)
// ---------------------------------------------------------------------------

/** Current auth payload, validated against the current tenant. */
export function getAuth(): Promise<AuthCookiePayload | null> {
  const s = state()
  s.auth ??= (async () => {
    const payload = await readAuthCookie()
    if (!payload) return null

    const tenant = await requireTenant()
    // Token issued on another tenant (should be impossible with host-only
    // cookies, but defence in depth): drop it.
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
export async function storeToken(
  responseBody: unknown,
  opts: { remember: boolean },
): Promise<void> {
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

export function forgetToken(): void {
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
      // Token revoked / expired on Laravel side -> drop our cookie too.
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
    delete: (path, body, opts) =>
      request(path, { ...opts, method: 'DELETE', body }),
  }
}

/** API client for the current tenant (guest or authenticated). */
export async function getApi(): Promise<ServerApi> {
  const tenant = await requireTenant()
  return createServerApi(tenant, await getToken())
}

/** API client that requires a logged-in user (throws 401 otherwise). */
export async function requireAuthApi(): Promise<ServerApi> {
  const tenant = await requireTenant()
  const token = await getToken()
  if (!token) throw new ApiError('Unauthenticated.', { status: 401 })
  return createServerApi(tenant, token)
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/** GET v1/user/me — memoised per request; null when logged out. */
export function getCurrentUser(): Promise<User | null> {
  const s = state()
  s.user ??= (async () => {
    const token = await getToken()
    if (!token) return null
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

/**
 * Rotate the Sanctum token when it's close to expiry
 * (POST v1/user/refresh-token). No-op for non-expiring tokens.
 */
export async function maybeRefreshToken(): Promise<void> {
  const auth = await getAuth()
  if (!auth?.expiresAt) return
  if (auth.expiresAt - Date.now() > config.auth.refreshThresholdMs) return
  try {
    const api = await requireAuthApi()
    const body = await api.post('v1/user/refresh-token')
    await storeToken(body, { remember: auth.remember })
  } catch (error) {
    if (!(isApiError(error) && error.status === 401)) {
      console.error('[auth] token refresh failed', error)
    }
  }
}
