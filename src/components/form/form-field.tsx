import type { AnyFieldApi } from '@tanstack/react-form'
import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, type ReactNode, useState } from 'react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { clearServerError, formatFieldError } from '#/features/auth/utils/auth'
import { cn } from '#/lib/utils'

type InputProps = Omit<ComponentProps<typeof Input>, 'name' | 'value' | 'onChange' | 'onBlur'>

export interface FormFieldProps extends InputProps {
  field: AnyFieldApi
  label: ReactNode
  hint?: ReactNode
  /** Rendered next to the label (e.g. "Forgot password?" link). */
  labelAction?: ReactNode
}

/** Text input bound to a TanStack Form field, with label + error message. */
export function FormField({
  field,
  label,
  hint,
  labelAction,
  className,
  type = 'text',
  ...props
}: FormFieldProps) {
  const [reveal, setReveal] = useState(false)
  const id = `field-${field.name}`
  const error =
    field.state.meta.isTouched || field.form.state.submissionAttempts > 0
      ? formatFieldError(field.state.meta.errors)
      : undefined
  const isPassword = type === 'password'

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={field.name}
          type={isPassword && reveal ? 'text' : type}
          value={(field.state.value as string | undefined) ?? ''}
          onBlur={field.handleBlur}
          onChange={(e) => {
            clearServerError(field.form, field.name)
            field.handleChange(e.target.value)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn('h-9', isPassword && 'pr-9')}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setReveal((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
