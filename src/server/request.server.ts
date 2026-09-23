/**
 * Helpers to inspect the *incoming* browser request (host, IP, UA, origin).
 */
import {
  getRequest,
  getRequestHeader,
  getRequestIP,
} from '@tanstack/react-start/server'
import { config } from './config.server'

/** Normalise a host: lowercase, strip port and trailing dot. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
}

/** Host of the current request (the tenant domain). */
export function getTenantHost(request: Request = getRequest()): string {
  if (config.tenant.devDomain) return normalizeHost(config.tenant.devDomain)

  let host: string | null = null
  if (config.trustProxy) {
    host = request.headers.get('x-forwarded-host')?.split(',')[0] ?? null
  }
  host ??= request.headers.get('host') ?? new URL(request.url).host
  return normalizeHost(host)
}

/** Public origin of the current request, e.g. `https://acme.example.com`. */
export function getPublicOrigin(request: Request = getRequest()): string {
  const url = new URL(request.url)
  let proto = url.protocol.replace(':', '')
  let host = request.headers.get('host') ?? url.host
  if (config.trustProxy) {
    proto = request.headers.get('x-forwarded-proto')?.split(',')[0] ?? proto
    host = request.headers.get('x-forwarded-host')?.split(',')[0] ?? host
  }
  return `${proto}://${host}`
}

export function getClientIp(): string | undefined {
  try {
    return getRequestIP({ xForwardedFor: config.trustProxy })
  } catch {
    return undefined
  }
}

export function getUserAgent(): string | undefined {
  try {
    return getRequestHeader('user-agent')
  } catch {
    return undefined
  }
}

/** Human friendly device name for Sanctum's `device_name` / token name. */
export function getDeviceName(ua = getUserAgent() ?? ''): string {
  const browser =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\//.test(ua) && 'Opera') ||
    (/Chrome\//.test(ua) && 'Chrome') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    (/Safari\//.test(ua) && 'Safari') ||
    'Browser'
  const os =
    (/Windows/.test(ua) && 'Windows') ||
    (/iPhone|iPad|iOS/.test(ua) && 'iOS') ||
    (/Android/.test(ua) && 'Android') ||
    (/Mac OS X|Macintosh/.test(ua) && 'macOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    'Unknown OS'
  return `${browser} on ${os}`.slice(0, 255)
}

/**
 * Same-origin check for state-changing requests hitting our `/api` proxy.
 * (Server functions are covered by TanStack's CSRF middleware in start.ts.)
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'

  const expected = getPublicOrigin(request)
  const origin = request.headers.get('origin')
  if (origin) return origin === expected

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin === expected
    } catch {
      return false
    }
  }
  return false
}
