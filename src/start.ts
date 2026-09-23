import { createSerializationAdapter } from '@tanstack/react-router'
import { createCsrfMiddleware, createStart } from '@tanstack/react-start'
import { ApiError, type ValidationErrors } from '#/lib/api/errors'

/**
 * Lets `ApiError` (status, validation errors) cross the server-function
 * boundary intact, so components can do `error.fieldErrors()` / `error.status`.
 */
const apiErrorAdapter = createSerializationAdapter({
  key: 'api-error',
  test: (value): value is ApiError => value instanceof ApiError,
  toSerializable: (error) => ({
    message: error.message,
    status: error.status,
    errors: error.errors,
    code: error.code ?? null,
  }),
  fromSerializable: (value: {
    message: string
    status: number
    errors: ValidationErrors
    code: string | null
  }) =>
    new ApiError(value.message, {
      status: value.status,
      errors: value.errors,
      code: value.code ?? undefined,
    }),
})

/** Rejects cross-site calls to server functions (login, logout, …). */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  serializationAdapters: [apiErrorAdapter],
  requestMiddleware: [csrfMiddleware],
}))
