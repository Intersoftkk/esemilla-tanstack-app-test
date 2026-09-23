/**
 * Tenant resolution: request host  ->  GET v1/tenants/check?domain=<host>
 *
 * Works for both platform sub-domains (acme.example.com) and custom alias
 * domains (shop.acme.com) — the host is sent as-is and Laravel decides.
 *
 * Results are cached in memory (positive + negative cache) and concurrent
 * lookups for the same host are de-duplicated, so the check endpoint is hit
 * at most once per host per TTL, per server instance.
 */
import { isApiError } from '#/lib/api/errors'
import { normalizeTenant, type Tenant } from '#/lib/api/types'
import { config } from './config.server'
import { laravelFetch } from './laravel.server'

export type TenantResolution =
  | { status: 'found'; tenant: Tenant }
  | { status: 'inactive'; tenant: Tenant }
  | { status: 'not_found'; host: string }
  | { status: 'error'; host: string; message: string }

interface CacheEntry {
  value: TenantResolution
  expiresAt: number
}

const MAX_CACHE_ENTRIES = 5000
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<TenantResolution>>()

/** Very small sanity check so garbage Host headers never reach Laravel. */
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/

export async function resolveTenant(host: string): Promise<TenantResolution> {
  if (!HOST_RE.test(host)) return { status: 'not_found', host }

  const now = Date.now()
  const hit = cache.get(host)
  if (hit && hit.expiresAt > now) return hit.value

  const pending = inflight.get(host)
  if (pending) return pending

  const promise = lookup(host)
    .then((value) => {
      const ttl =
        value.status === 'found' || value.status === 'inactive'
          ? config.tenant.cacheTtlMs
          : value.status === 'not_found'
            ? config.tenant.negativeCacheTtlMs
            : 0 // never cache transient errors
      if (ttl > 0) {
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldest = cache.keys().next().value
          if (oldest) cache.delete(oldest)
        }
        cache.set(host, { value, expiresAt: Date.now() + ttl })
      }
      return value
    })
    .finally(() => inflight.delete(host))

  inflight.set(host, promise)
  return promise
}

async function lookup(host: string): Promise<TenantResolution> {
  try {
    const body = await laravelFetch(config.tenant.checkPath, {
      query: { [config.tenant.checkParam]: host },
      tenantDomain: host,
      forwardClient: false,
    })
    const tenant = normalizeTenant(body, host)
    if (!tenant) return { status: 'not_found', host }
    return tenant.active
      ? { status: 'found', tenant }
      : { status: 'inactive', tenant }
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) {
      return { status: 'not_found', host }
    }
    if (isApiError(error) && (error.status === 403 || error.status === 423)) {
      return {
        status: 'inactive',
        tenant: {
          id: '',
          name: host,
          domain: host,
          slug: null,
          logo: null,
          locale: null,
          active: false,
          settings: {},
        },
      }
    }
    console.error(`[tenant] check failed for ${host}`, error)
    return {
      status: 'error',
      host,
      message: isApiError(error) ? error.message : 'Tenant lookup failed',
    }
  }
}

/** Drop a host from the cache (e.g. after a tenant changes its domain). */
export function forgetTenant(host?: string) {
  if (host) cache.delete(host)
  else cache.clear()
}
