import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { FormField } from '#/components/form/form-field'
import { SubmitButton } from '#/components/form/submit-button'
import { useForgotPasswordMutation } from '../queries/auth.mutations'
import { type ForgotPasswordInput, forgotPasswordSchema } from '../schema/forgot-password.schema'
import { applyServerErrors, getPasswordResetMode } from '../utils/auth'

export interface ForgotPasswordFormProps {
  /** OTP mode: called after the code was emailed (navigate to /otp). */
  onCodeSent?: (email: string) => void
}

export function ForgotPasswordForm({ onCodeSent }: ForgotPasswordFormProps) {
  const forgot = useForgotPasswordMutation()
  const [formError, setFormError] = useState<unknown>()
  const mode = getPasswordResetMode()

  const form = useForm({
    defaultValues: { email: '' } as ForgotPasswordInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setFormError(undefined)
      try {
        await forgot.mutateAsync(value)
        if (mode === 'otp') onCodeSent?.(value.email)
      } catch (error) {
        applyServerErrors(form, error)
        setFormError(error)
      }
    },
  })

  // Link mode: show the confirmation instead of the form.
  if (mode === 'link' && forgot.isSuccess) {
    return <FormAlert success={forgot.data.message} />
  }

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
          <FormField field={field} label="Email" type="email" autoComplete="email" autoFocus />
        )}
      </form.Field>

      <SubmitButton form={form} pending={forgot.isPending} pendingText="Sending…">
        {mode === 'otp' ? 'Send reset code' : 'Send reset link'}
      </SubmitButton>
    </form>
  )
}
