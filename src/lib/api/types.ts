/**
 * Shared domain types + tolerant normalizers for Laravel responses.
 *
 * Laravel apps wrap responses differently (`{ data: {...} }` from API
 * Resources, `{ user, token }`, `{ access_token }` ...). The helpers below
 * accept all common shapes so you only need to touch this file if your API
 * uses something unusual.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | Array<Json>
  | { [key: string]: Json }

export type JsonObject = { [key: string]: Json }

/** Public tenant info (safe to send to the browser). */
export interface Tenant {
  id: string
  name: string
  domain: string
  slug: string | null
  logo: string | null
  locale: string | null
  active: boolean
  /** Any extra *public* settings your Laravel API returns (theme, features…). */
  settings: JsonObject
}

export interface User {
  id: string | number
  name: string
  email: string
  email_verified_at?: string | null
  avatar?: string | null
  [key: string]: Json | undefined
}

export interface AuthSessionEntry {
  id: string | number
  name?: string | null
  ip_address?: string | null
  user_agent?: string | null
  last_used_at?: string | null
  created_at?: string | null
  is_current?: boolean
  [key: string]: Json | undefined
}

export interface MessageResponse {
  message: string
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Unwrap Laravel API Resource `{ data: ... }` envelopes. */
export function unwrapData<T = unknown>(body: unknown): T {
  if (isObject(body) && 'data' in body && body.data !== undefined) {
    return body.data as T
  }
  return body as T
}

export interface ExtractedToken {
  token: string
  /** Unix epoch (ms) or null when the token does not expire. */
  expiresAt: number | null
}

/** Find a Sanctum plain-text token in any common response shape. */
export function extractToken(body: unknown): ExtractedToken | null {
  const candidates = [body, isObject(body) ? body.data : undefined]
  for (const c of candidates) {
    if (!isObject(c)) continue
    const token =
      c.token ?? c.access_token ?? c.plainTextToken ?? c.plain_text_token
    if (typeof token === 'string' && token.length > 0) {
      return { token, expiresAt: extractExpiry(c) }
    }
  }
  return null
}

function extractExpiry(obj: Record<string, unknown>): number | null {
  const expiresAt = obj.expires_at ?? obj.expiresAt
  if (typeof expiresAt === 'string' || typeof expiresAt === 'number') {
    const ms =
      typeof expiresAt === 'number'
        ? expiresAt < 1e12
          ? expiresAt * 1000
          : expiresAt
        : Date.parse(expiresAt)
    if (Number.isFinite(ms)) return ms
  }
  const expiresIn = obj.expires_in ?? obj.expiresIn
  if (typeof expiresIn === 'number' && expiresIn > 0) {
    return Date.now() + expiresIn * 1000
  }
  return null
}

/** Find the user object in `{ user }`, `{ data: { user } }` or `{ data: user }`. */
export function extractUser(body: unknown): User | null {
  const data = unwrapData(body)
  const candidates = [
    isObject(body) ? body.user : undefined,
    isObject(data) ? data.user : undefined,
    data,
  ]
  for (const c of candidates) {
    if (isObject(c) && ('id' in c || 'email' in c)) {
      return toJson(c) as unknown as User
    }
  }
  return null
}

export function extractMessage(body: unknown, fallback: string): string {
  if (isObject(body) && typeof body.message === 'string') return body.message
  const data = unwrapData(body)
  if (isObject(data) && typeof data.message === 'string') return data.message
  return fallback
}

export function normalizeTenant(body: unknown, domain: string): Tenant | null {
  let data = unwrapData(body)
  if (isObject(data) && isObject(data.tenant)) data = data.tenant
  if (!isObject(data)) return null

  // Allow `{ exists: false }` / `{ valid: false }` style responses.
  if (data.exists === false || data.valid === false || data.found === false) {
    return null
  }

  const id = data.id ?? data.uuid ?? data.tenant_id
  if (id === undefined || id === null) return null

  const status = typeof data.status === 'string' ? data.status.toLowerCase() : ''
  const active =
    data.is_active !== false &&
    data.active !== false &&
    !['inactive', 'suspended', 'disabled', 'banned'].includes(status)

  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

  return {
    id: String(id),
    name: str(data.name) ?? str(data.title) ?? domain,
    domain: str(data.domain) ?? domain,
    slug: str(data.slug) ?? str(data.subdomain),
    logo: str(data.logo_url) ?? str(data.logo),
    locale: str(data.locale),
    active,
    settings: isObject(data.settings)
      ? (toJson(data.settings) as JsonObject)
      : {},
  }
}

/** Deep-clone into plain JSON (drops functions / undefined / class instances). */
export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json
}
