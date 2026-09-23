/**
 * Isomorphic auth helpers (safe on server and in the browser).
 */
import type { AnyFormApi } from '@tanstack/react-form'
import { isApiError } from '#/lib/api/errors'
import type { PasswordResetMode } from '../types/auth.types'

export const DEFAULT_AUTHED_REDIRECT = '/dashboard'

/**
 * Only allow same-site relative redirects (prevents open-redirects via
 * `?redirect=https://evil.com`).
 */
export function safeRedirect(value: unknown, fallback = DEFAULT_AUTHED_REDIRECT): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  return value
}

export function getPasswordResetMode(): PasswordResetMode {
  return import.meta.env.VITE_PASSWORD_RESET_MODE === 'link' ? 'link' : 'otp'
}

export function getSocialProviders(): Array<string> {
  return String(import.meta.env.VITE_SOCIAL_PROVIDERS ?? '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
}

export const SOCIAL_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  microsoft: 'Microsoft',
  apple: 'Apple',
  linkedin: 'LinkedIn',
  twitter: 'X',
  gitlab: 'GitLab',
}

/**
 * Field errors from a server error: Laravel 422 `errors`, or a Zod error
 * thrown by a server-function validator (arrives as a JSON message).
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!error) return {}
  if (isApiError(error)) return error.fieldErrors()

  if (error instanceof Error) {
    try {
      const issues = JSON.parse(error.message) as Array<{
        path?: Array<string | number>
        message?: string
      }>
      if (Array.isArray(issues)) {
        const out: Record<string, string> = {}
        for (const issue of issues) {
          const key = issue.path?.join('.')
          if (key && issue.message && !out[key]) out[key] = issue.message
        }
        return out
      }
    } catch {
      /* not a zod error */
    }
  }
  return {}
}

/**
 * Push server-side (Laravel 422) errors into a TanStack Form so they render
 * under the matching fields. Returns true when at least one field matched.
 */
export function applyServerErrors(form: AnyFormApi, error: unknown): boolean {
  const errors = getFieldErrors(error)
  let matched = false
  for (const [name, message] of Object.entries(errors)) {
    if (!(name in (form.state.values ?? {}))) continue
    matched = true
    form.setFieldMeta(name, (prev) => ({
      ...prev,
      isTouched: true,
      errorMap: { ...prev.errorMap, onServer: message },
    }))
  }
  return matched
}

/** Clear a server error from a field once the user edits it. */
export function clearServerError(form: AnyFormApi, name: string) {
  const meta = form.getFieldMeta(name)
  if (!meta?.errorMap?.onServer) return
  form.setFieldMeta(name, (prev) => ({
    ...prev,
    errorMap: { ...prev.errorMap, onServer: undefined },
  }))
}

/** Normalise TanStack Form / Standard Schema errors to a display string. */
export function formatFieldError(errors: Array<unknown>): string | undefined {
  for (const error of errors) {
    if (!error) continue
    if (typeof error === 'string') return error
    if (typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message)
    }
  }
  return undefined
}
