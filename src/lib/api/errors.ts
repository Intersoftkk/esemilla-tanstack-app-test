/**
 * Shared (isomorphic) API error type.
 *
 * Thrown by:
 *  - the server-side Laravel client (src/server/laravel.server.ts)
 *  - the browser API client (src/lib/api/client.ts)
 *  - server functions (it is registered as a serialization adapter in
 *    src/start.ts, so it survives the server -> client boundary intact)
 */

export type ValidationErrors = Record<string, Array<string>>

export interface ApiErrorInit {
  status: number
  errors?: ValidationErrors
  code?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: ValidationErrors
  readonly code?: string

  constructor(message: string, init: ApiErrorInit) {
    super(message)
    this.name = 'ApiError'
    this.status = init.status
    this.errors = init.errors ?? {}
    this.code = init.code
  }

  get isUnauthorized() {
    return this.status === 401
  }
  get isForbidden() {
    return this.status === 403
  }
  get isNotFound() {
    return this.status === 404
  }
  get isValidation() {
    return this.status === 422
  }
  /** Laravel returns 423 when `password.confirm` middleware requires re-auth. */
  get isPasswordConfirmationRequired() {
    return this.status === 423
  }
  get isRateLimited() {
    return this.status === 429
  }

  /** First message per field — handy for forms. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, messages] of Object.entries(this.errors)) {
      if (messages?.[0]) out[key] = messages[0]
    }
    return out
  }

  toJSON() {
    return {
      message: this.message,
      status: this.status,
      errors: this.errors,
      code: this.code,
    }
  }

  /** Build from a Laravel error payload (`{ message, errors }`). */
  static fromResponse(status: number, body: unknown): ApiError {
    const obj = (body && typeof body === 'object' ? body : {}) as Record<
      string,
      unknown
    >
    const message =
      (typeof obj.message === 'string' && obj.message) ||
      (typeof obj.error === 'string' && obj.error) ||
      defaultMessage(status)

    return new ApiError(message, {
      status,
      errors: normalizeErrors(obj.errors),
      code: typeof obj.code === 'string' ? obj.code : undefined,
    })
  }
}

export function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) return true
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'ApiError' &&
    typeof (error as { status?: unknown }).status === 'number'
  )
}

/** Human readable message for any thrown value. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (isApiError(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function normalizeErrors(errors: unknown): ValidationErrors {
  if (!errors || typeof errors !== 'object') return {}
  const out: ValidationErrors = {}
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(value)) out[key] = value.map(String)
    else if (typeof value === 'string') out[key] = [value]
  }
  return out
}

function defaultMessage(status: number) {
  switch (status) {
    case 400:
      return 'Bad request.'
    case 401:
      return 'Unauthenticated.'
    case 403:
      return 'This action is unauthorized.'
    case 404:
      return 'Not found.'
    case 419:
      return 'Session expired.'
    case 422:
      return 'The given data was invalid.'
    case 423:
      return 'Password confirmation required.'
    case 429:
      return 'Too many requests. Please slow down.'
    case 503:
      return 'Service unavailable.'
    default:
      return status >= 500 ? 'Server error.' : 'Request failed.'
  }
}
