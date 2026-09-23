import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type * as React from 'react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { getErrorMessage, isApiError } from '#/lib/api/errors'
import { cn } from '#/lib/utils'

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 space-y-1">
            <h1 className="font-heading text-lg font-semibold">{title}</h1>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {children}
        </div>
        {footer ? (
          <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

export function Field({
  label,
  name,
  error,
  hint,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: React.ReactNode
  name: string
  error?: string
  hint?: React.ReactNode
}) {
  const id = props.id ?? `field-${name}`
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-9"
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormAlert({
  error,
  success,
}: {
  error?: unknown
  success?: React.ReactNode
}) {
  if (error) {
    // Validation errors are shown next to fields; only show a summary here.
    const message =
      isApiError(error) && error.isValidation && Object.keys(error.errors).length
        ? error.message
        : getErrorMessage(error)
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>{message}</span>
      </div>
    )
  }
  if (success) {
    return (
      <output className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        <span>{success}</span>
      </output>
    )
  }
  return null
}

/**
 * Field errors from a server error: Laravel 422 `errors` or a Zod validation
 * error thrown by a server function validator.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!error) return {}
  if (isApiError(error)) return error.fieldErrors()

  // Zod errors from server-function validators arrive as a JSON message.
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

export function formValues(form: HTMLFormElement) {
  const data = new FormData(form)
  const get = (key: string) => {
    const value = data.get(key)
    return typeof value === 'string' ? value : ''
  }
  return { data, get, bool: (key: string) => data.get(key) === 'on' }
}
