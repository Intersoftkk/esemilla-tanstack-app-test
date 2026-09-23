/**
 * Server-only configuration.
 * Files named `*.server.ts` can never be imported into the client bundle
 * (TanStack Start import protection enforces this at build time).
 */
import { env } from '#/env'

const isProd = process.env.NODE_ENV === 'production'

export const config = {
  isProd,

  laravel: {
    /**
     * Base URL including the Laravel route prefix.
     *   routes/api.php  ->  https://api.laravel.dev/api
     * Endpoint paths are appended, e.g. `${baseUrl}/v1/user/login`.
     */
    baseUrl: env.LARAVEL_API_URL.replace(/\/+$/, ''),
    timeoutMs: env.LARAVEL_TIMEOUT_MS,
  },

  tenant: {
    checkPath: process.env.TENANT_CHECK_PATH || 'v1/tenants/check',
    /** Query param used to send the host to `TenantController@check`. */
    checkParam: process.env.TENANT_CHECK_PARAM || 'domain',
    /**
     * Header sent on every server -> Laravel call so Laravel can initialise
     * tenancy. `X-Tenant` is the default of stancl/tenancy's
     * InitializeTenancyByRequestData middleware.
     */
    idHeader: process.env.TENANT_HEADER || 'X-Tenant',
    domainHeader: process.env.TENANT_DOMAIN_HEADER || 'X-Tenant-Domain',
    cacheTtlMs: env.TENANT_CACHE_TTL * 1000,
    negativeCacheTtlMs: env.TENANT_NEGATIVE_CACHE_TTL * 1000,
    devDomain: isProd ? undefined : env.DEV_TENANT_DOMAIN,
  },

  cookie: {
    /**
     * In production the cookie is `__Host-` prefixed: Secure, Path=/, and
     * *no Domain attribute*. That makes it host-only, so every tenant
     * sub-domain and every custom alias domain gets its own isolated session.
     */
    secure: env.AUTH_COOKIE_SECURE || isProd,
    get name() {
      return this.secure ? `__Host-${env.AUTH_COOKIE_NAME}` : env.AUTH_COOKIE_NAME
    },
    maxAge: env.AUTH_COOKIE_MAX_AGE,
    secret: env.SESSION_SECRET,
  },

  trustProxy: env.TRUST_PROXY,
} as const
