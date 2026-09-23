/**
 * Encrypted, HttpOnly auth cookie that stores the Sanctum token.
 *
 * - The browser JS can never read the token (HttpOnly) -> XSS can't steal it.
 * - The value is AES-GCM encrypted + authenticated with SESSION_SECRET.
 * - Host-only cookie => isolated per tenant domain / alias domain.
 */
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { config } from './config.server'

export interface AuthCookiePayload {
  /** Sanctum plain-text token (`id|secret`). */
  token: string
  /** Tenant id the token was issued for (prevents cross-tenant replay). */
  tenantId: string
  /** Token expiry, epoch ms, or null. */
  expiresAt: number | null
  /** Persistent ("remember me") vs browser-session cookie. */
  remember: boolean
  /** Issued at, epoch ms. */
  iat: number
}

// ---------------------------------------------------------------------------
// Crypto (WebCrypto — works in Node 20+, Bun, Deno, Workers)
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()
const decoder = new TextDecoder()
let keyPromise: Promise<CryptoKey> | null = null

function getKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle
    .digest('SHA-256', encoder.encode(config.cookie.secret))
    .then((raw) =>
      crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']),
    )
  return keyPromise
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function seal(payload: AuthCookiePayload): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getKey(),
    encoder.encode(JSON.stringify(payload)),
  )
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`
}

export async function unseal(value: string): Promise<AuthCookiePayload | null> {
  try {
    const [version, iv, data] = value.split('.')
    if (version !== 'v1' || !iv || !data) return null
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(iv) },
      await getKey(),
      fromBase64Url(data),
    )
    const parsed = JSON.parse(decoder.decode(plain)) as AuthCookiePayload
    return typeof parsed?.token === 'string' ? parsed : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cookie IO (works inside server functions, middleware and server routes)
// ---------------------------------------------------------------------------

function cookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: 'lax' as const,
    path: '/',
    // No `domain` => host-only cookie (required for __Host- prefix).
    ...(remember ? { maxAge: config.cookie.maxAge } : {}),
  }
}

export async function readAuthCookie(): Promise<AuthCookiePayload | null> {
  const raw = getCookie(config.cookie.name)
  if (!raw) return null
  return unseal(raw)
}

export async function writeAuthCookie(
  payload: Omit<AuthCookiePayload, 'iat'> & { iat?: number },
): Promise<void> {
  const full: AuthCookiePayload = { ...payload, iat: payload.iat ?? Date.now() }
  setCookie(config.cookie.name, await seal(full), cookieOptions(full.remember))
}

export function clearAuthCookie(): void {
  deleteCookie(config.cookie.name, cookieOptions(false))
}
