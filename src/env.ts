import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1')

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),

    /** Base URL of the single Laravel API, e.g. https://api.laravel.dev */
    LARAVEL_API_URL: z.string().url(),

    /**
     * Secret used to encrypt the auth session cookie (min 32 chars).
     * Generate with: openssl rand -base64 48
     */
    SESSION_SECRET: z.string().min(32),

    /** Cookie name that stores the encrypted Sanctum token. */
    AUTH_COOKIE_NAME: z.string().min(1).default('tenant_auth'),

    /** Cookie lifetime (seconds). Defaults to 30 days. */
    AUTH_COOKIE_MAX_AGE: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),

    /** Force the `Secure` flag on cookies (defaults to true in production). */
    AUTH_COOKIE_SECURE: bool,

    /** Seconds a resolved tenant is cached in memory. */
    TENANT_CACHE_TTL: z.coerce.number().int().nonnegative().default(300),

    /** Seconds an unknown host is cached as "not a tenant". */
    TENANT_NEGATIVE_CACHE_TTL: z.coerce.number().int().nonnegative().default(30),

    /**
     * Trust X-Forwarded-Host / X-Forwarded-For / X-Forwarded-Proto headers.
     * Enable ONLY when running behind a trusted reverse proxy / load balancer.
     */
    TRUST_PROXY: bool,

    /**
     * DEV ONLY: pretend every request comes from this host
     * (useful on localhost, where there is no tenant domain).
     */
    DEV_TENANT_DOMAIN: z.string().min(1).optional(),


    /** Timeout for calls from this server to Laravel (ms). */
    LARAVEL_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    /** Comma separated list of enabled social providers, e.g. "google,github" */
    VITE_SOCIAL_PROVIDERS: z.string().optional(),
    /**
     * How `forgot-password` works on your Laravel side:
     *  - "otp"  : Laravel emails a code -> user enters it on /otp -> /reset-password
     *  - "link" : Laravel emails a link to /reset-password?token=...&email=...
     */
    VITE_PASSWORD_RESET_MODE: z.enum(['otp', 'link']).default('otp'),
  },

  /**
   * On the server we read from process.env (the Vite config loads `.env` into
   * it during development); in the browser only VITE_* vars exist.
   */
  runtimeEnv:
    typeof window === 'undefined'
      ? { ...process.env, ...import.meta.env }
      : import.meta.env,

  /**
   * Server vars are only validated on the server. Accessing them in the browser
   * throws, which is exactly what we want.
   */
  isServer: typeof window === 'undefined',

  emptyStringAsUndefined: true,
})
