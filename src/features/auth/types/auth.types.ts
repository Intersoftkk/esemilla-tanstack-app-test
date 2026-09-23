import type { Json, JsonObject, Tenant, User } from '#/lib/api/types'

export type { Tenant, User }

/** Result of `GET v1/tenants/check` for the current host. */
export type TenantState =
  | { status: 'found'; tenant: Tenant }
  | { status: 'inactive'; tenant: Tenant | null }
  | { status: 'not_found'; host: string }
  | { status: 'error'; message: string }

/** Bootstrapped once per SSR request by the root route. */
export interface SessionState {
  tenant: TenantState
  user: User | null
}

export interface AuthResult {
  user: User | null
}

export interface SignUpResult extends AuthResult {
  message: string
}

export interface MessageResult {
  message: string
}

/** Pending password-reset OTP (stored in an encrypted HttpOnly cookie). */
export interface PendingReset {
  email: string
  /** true once the user has entered a code on /otp */
  hasCode: boolean
}

export type PasswordStatus = JsonObject

export type NotificationPreferences = Record<string, Json>

export type PasswordResetMode = 'otp' | 'link'
