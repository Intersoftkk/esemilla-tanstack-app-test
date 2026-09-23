import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { FormField } from '#/components/form/form-field'
import { SubmitButton } from '#/components/form/submit-button'
import { isApiError } from '#/lib/api/errors'
import { useResetPasswordMutation } from '../queries/auth.mutations'
import { type ResetPasswordInput, resetPasswordSchema } from '../schema/reset-password.schema'
import { applyServerErrors } from '../utils/auth'

export interface ResetPasswordFormProps {
  email: string
  /** Link mode: token from `?token=`. OTP mode: omitted (read from cookie). */
  token?: string
  /** Email is fixed in OTP mode (it was entered on forgot-password). */
  lockEmail?: boolean
  onSuccess: () => void
  /** OTP rejected by Laravel -> let the page send the user back to /otp. */
  onInvalidCode?: (message: string) => void
}

const CODE_FIELDS = ['token', 'otp', 'code']

export function ResetPasswordForm({
  email,
  token,
  lockEmail,
  onSuccess,
  onInvalidCode,
}: ResetPasswordFormProps) {
  const reset = useResetPasswordMutation()
  const [formError, setFormError] = useState<unknown>()

  const form = useForm({
    defaultValues: { email, password: '', password_confirmation: '' } as ResetPasswordInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setFormError(undefined)
      try {
        await reset.mutateAsync({ ...value, token })
        onSuccess()
      } catch (error) {
        const codeError =
          isApiError(error) &&
          (error.code === 'otp_missing' || CODE_FIELDS.some((k) => k in error.errors))
        if (codeError && onInvalidCode) {
          const msg = CODE_FIELDS.map((k) => error.errors[k]?.[0]).find(Boolean)
          onInvalidCode(msg ?? error.message)
          return
        }
        applyServerErrors(form, error)
        setFormError(error)
      }
    },
  })

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FormAlert error={formError} />

      <form.Field name="email">
        {(field) => (
          <FormField
            field={field}
            label="Email"
            type="email"
            autoComplete="email"
            readOnly={lockEmail}
            className={lockEmail ? 'opacity-70' : undefined}
          />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormField
            field={field}
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            autoFocus
          />
        )}
      </form.Field>

      <form.Field name="password_confirmation">
        {(field) => (
          <FormField
            field={field}
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.Field>

      <SubmitButton form={form} pending={reset.isPending} pendingText="Saving…">
        Reset password
      </SubmitButton>
    </form>
  )
}
