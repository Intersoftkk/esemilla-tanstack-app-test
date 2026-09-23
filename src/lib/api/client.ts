/**
 * Browser API client for CLIENT-SIDE calls.
 *
 * Talks to the same-origin proxy (`/api/*`, see src/routes/api/$.ts), which
 * attaches the Sanctum token + tenant headers server-side. No token ever
 * lives in JS, localStorage, or a readable cookie.
 *
 *   const orders = await api.get<Order[]>('v1/orders', { page: 2 })
 *   await api.post('v1/orders', { product_id: 1 })
 */
import { ApiError } from './errors'

type QueryValue = string | number | boolean | null | undefined
export type ClientQuery = Record<string, QueryValue | Array<QueryValue>>

export interface ClientRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: ClientQuery
  body?: unknown
}

type UnauthorizedHandler = (error: ApiError) => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Registered once in the root provider (logs the user out in the UI). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

function buildUrl(path: string, query?: ClientQuery) {
  const url = new URL(`/api/${path.replace(/^\/+/, '')}`, window.location.origin)
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

export async function apiRequest<T = unknown>(
  path: string,
  { method = 'GET', query, body, headers, ...init }: ClientRequestOptions = {},
): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error(
      'lib/api/client is browser-only. On the server use a server function ' +
        '(see src/lib/api/server-fn.ts) or getApi() from session.server.ts.',
    )
  }

  const h = new Headers(headers)
  h.set('accept', 'application/json')

  let payload: BodyInit | undefined
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
      payload = body
    } else {
      h.set('content-type', 'application/json')
      payload = JSON.stringify(body)
    }
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      ...init,
      method,
      headers: h,
      body: payload,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('Network error. Check your connection.', {
      status: 0,
      code: 'network_error',
    })
  }

  const text = res.status === 204 ? '' : await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text.slice(0, 500) }
    }
  }

  if (!res.ok) {
    const error = ApiError.fromResponse(res.status, data)
    if (error.status === 401) onUnauthorized?.(error)
    throw error
  }
  return data as T
}

export const api = {
  request: apiRequest,
  get: <T = unknown>(path: string, query?: ClientQuery, init?: ClientRequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'GET', query }),
  post: <T = unknown>(path: string, body?: unknown, init?: ClientRequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, init?: ClientRequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, init?: ClientRequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, body?: unknown, init?: ClientRequestOptions) =>
    apiRequest<T>(path, { ...init, method: 'DELETE', body }),
}
