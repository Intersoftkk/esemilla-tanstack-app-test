/**
 * Same-origin proxy for CLIENT-SIDE API calls:
 *
 *   browser  ->  https://acme.example.com/api/v1/orders
 *            ->  https://api.laravel.dev/api/v1/orders
 *                (+ Authorization: Bearer <token from HttpOnly cookie>)
 *                (+ X-Tenant: <tenant id>)
 *
 * Why a proxy instead of calling api.laravel.dev from the browser?
 *  - the Sanctum token never has to be readable by JavaScript (XSS-safe)
 *  - no CORS setup on Laravel for every tenant/custom domain
 *  - the tenant is always derived server-side from the Host header, so a
 *    user can't spoof another tenant from the browser
 */
import { createFileRoute } from '@tanstack/react-router'
import { isApiError } from '#/lib/api/errors'
import { buildLaravelHeaders, buildLaravelUrl } from '#/server/laravel.server'
import { config } from '#/server/config.server'
import { isSameOriginRequest } from '#/server/request.server'
import { forgetToken, getToken, requireTenant } from '#/server/session.server'

/**
 * Endpoints that issue/rotate tokens must go through server functions
 * (src/lib/auth/functions.ts) so the token lands in the HttpOnly cookie
 * instead of being exposed to the browser.
 */
const BLOCKED = [
  /^v1\/user\/(login|register|refresh-token)$/,
  /^v1\/user\/auth\//,
  /^v1\/user\/logout(-all)?$/,
  /^v1\/tenants\//,
]

/** Request headers forwarded to Laravel (everything else is dropped). */
const FORWARD_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'if-none-match',
  'if-modified-since',
  'x-socket-id',
]

/** Response headers forwarded back to the browser. */
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'cache-control',
  'etag',
  'last-modified',
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-total-count',
  'link',
]

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function proxy({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}): Promise<Response> {
  const path = (params._splat ?? '').replace(/^\/+/, '')

  if (!/^v\d+\//.test(path) || path.includes('..')) {
    return json(404, { message: 'Not found.' })
  }
  if (BLOCKED.some((re) => re.test(path))) {
    return json(403, { message: 'Use the auth server functions for this endpoint.' })
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !isSameOriginRequest(request)) {
    return json(403, { message: 'Cross-site request blocked.' })
  }

  let tenant: Awaited<ReturnType<typeof requireTenant>>
  let token: string | null
  try {
    tenant = await requireTenant()
    token = await getToken()
  } catch (error) {
    if (isApiError(error)) return json(error.status, error.toJSON())
    throw error
  }

  const incoming = new URL(request.url)
  const target = buildLaravelUrl(path)
  target.search = incoming.search

  const forwarded = new Headers()
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) forwarded.set(name, value)
  }
  const headers = buildLaravelHeaders({ headers: forwarded, token, tenant })

  const hasBody = !['GET', 'HEAD'].includes(request.method)

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // @ts-expect-error - required by Node's fetch when streaming a body
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(config.laravel.timeoutMs),
      ]),
    })
  } catch (error) {
    console.error(`[api-proxy] ${request.method} ${path} failed`, error)
    return json(502, { message: 'Unable to reach the API.' })
  }

  // Token revoked/expired on Laravel -> drop the cookie so the UI logs out.
  if (upstream.status === 401 && token) forgetToken()

  const responseHeaders = new Headers({ 'cache-control': 'no-store' })
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
    },
  },
})
