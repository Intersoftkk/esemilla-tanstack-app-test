/**
 * Low-level HTTP client: TanStack Start server  ->  Laravel API.
 *
 * Every call made from the server automatically carries:
 *   - Accept: application/json         (so Laravel returns JSON errors)
 *   - Authorization: Bearer <token>    (when a token is provided)
 *   - X-Tenant / X-Tenant-Domain       (so Laravel can initialise tenancy)
 *   - X-Forwarded-For / User-Agent     (real client info for rate limits,
 *                                       Sanctum sessions list, audit logs)
 *
 * Because the browser never talks to api.laravel.dev directly, Laravel does
 * NOT need any CORS configuration for tenant domains.
 */
import { ApiError } from '#/lib/api/errors'
import type { Tenant } from '#/lib/api/types'
import { config } from './config.server'
import { getClientIp, getUserAgent } from './request.server'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue | Array<QueryValue>>

export interface LaravelRequestOptions {
  method?: HttpMethod
  query?: Query
  /** Plain object (sent as JSON), FormData, or any BodyInit. */
  body?: unknown
  token?: string | null
  tenant?: Pick<Tenant, 'id' | 'domain'> | null
  /** Host to send when no tenant is known yet (tenant check). */
  tenantDomain?: string
  headers?: HeadersInit
  signal?: AbortSignal
  /** Forward client IP / UA headers (default true). */
  forwardClient?: boolean
}

export interface LaravelResponse<T> {
  status: number
  headers: Headers
  data: T
}

export function buildLaravelUrl(path: string, query?: Query): URL {
  const clean = path.replace(/^\/+/, '')
  const url = new URL(`${config.laravel.baseUrl}/${clean}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      const values = Array.isArray(value) ? value : [value]
      for (const v of values) {
        if (v === undefined || v === null) continue
        url.searchParams.append(
          Array.isArray(value) ? `${key}[]` : key,
          typeof v === 'boolean' ? (v ? '1' : '0') : String(v),
        )
      }
    }
  }
  return url
}

/** Headers shared by `laravelFetch` and the `/api` proxy. */
export function buildLaravelHeaders(
  opts: Pick<
    LaravelRequestOptions,
    'token' | 'tenant' | 'tenantDomain' | 'headers' | 'forwardClient'
  >,
): Headers {
  const headers = new Headers(opts.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  headers.set('x-requested-with', 'XMLHttpRequest')

  if (opts.token) headers.set('authorization', `Bearer ${opts.token}`)

  if (opts.tenant) {
    headers.set(config.tenant.idHeader, opts.tenant.id)
    headers.set(config.tenant.domainHeader, opts.tenant.domain)
  } else if (opts.tenantDomain) {
    headers.set(config.tenant.domainHeader, opts.tenantDomain)
  }

  if (opts.forwardClient !== false) {
    const ip = getClientIp()
    const ua = getUserAgent()
    if (ip) headers.set('x-forwarded-for', ip)
    if (ua) headers.set('user-agent', ua)
  }
  return headers
}

export async function laravelRequest<T = unknown>(
  path: string,
  opts: LaravelRequestOptions = {},
): Promise<LaravelResponse<T>> {
  const url = buildLaravelUrl(path, opts.query)
  const headers = buildLaravelHeaders(opts)

  let body: BodyInit | undefined
  if (opts.body !== undefined && opts.body !== null) {
    if (
      opts.body instanceof FormData ||
      opts.body instanceof URLSearchParams ||
      opts.body instanceof Blob ||
      typeof opts.body === 'string'
    ) {
      body = opts.body as BodyInit
    } else {
      headers.set('content-type', 'application/json')
      body = JSON.stringify(opts.body)
    }
  }

  const timeout = AbortSignal.timeout(config.laravel.timeoutMs)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout

  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal,
      redirect: 'manual',
      cache: 'no-store',
    })
  } catch (cause) {
    const isTimeout = cause instanceof DOMException && cause.name === 'TimeoutError'
    console.error(`[laravel] ${opts.method ?? 'GET'} ${url.pathname} failed`, cause)
    throw new ApiError(
      isTimeout ? 'The API took too long to respond.' : 'Unable to reach the API.',
      { status: isTimeout ? 504 : 503, code: 'api_unreachable' },
    )
  }

  const data = await parseBody(res)
  if (!res.ok && !(res.status >= 300 && res.status < 400)) {
    throw ApiError.fromResponse(res.status, data)
  }
  return { status: res.status, headers: res.headers, data: data as T }
}

/** Convenience wrapper returning only the parsed body. */
export async function laravelFetch<T = unknown>(
  path: string,
  opts: LaravelRequestOptions = {},
): Promise<T> {
  return (await laravelRequest<T>(path, opts)).data
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204 || res.status === 205) return null
  const text = await res.text()
  if (!text) return null
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('json') || /^[[{]/.test(text.trim())) {
    try {
      return JSON.parse(text)
    } catch {
      /* fallthrough */
    }
  }
  return { message: text.slice(0, 500) }
}
