import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { FormField } from '#/components/form/form-field'
import { SubmitButton } from '#/components/form/submit-button'
import { useChangePasswordMutation } from '#/features/auth/queries/auth.mutations'
import {
  type ChangePasswordInput,
  changePasswordSchema,
} from '#/features/auth/schema/reset-password.schema'
import { applyServerErrors } from '#/features/auth/utils/auth'

/** POST v1/user/change-password */
export function ChangePasswordForm() {
  const change = useChangePasswordMutation()
  const [formError, setFormError] = useState<unknown>()

  const form = useForm({
    defaultValues: {
      current_password: '',
      password: '',
      password_confirmation: '',
    } as ChangePasswordInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(undefined)
      try {
        await change.mutateAsync(value)
        formApi.reset()
      } catch (error) {
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
      <FormAlert error={formError} success={change.isSuccess ? change.data.message : undefined} />
      <form.Field name="current_password">
        {(field) => (
          <FormField field={field} label="Current password" type="password" autoComplete="current-password" />
        )}
      </form.Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="password">
          {(field) => (
            <FormField field={field} label="New password" type="password" autoComplete="new-password" />
          )}
        </form.Field>
        <form.Field name="password_confirmation">
          {(field) => (
            <FormField field={field} label="Confirm new password" type="password" autoComplete="new-password" />
          )}
        </form.Field>
      </div>
      <div className="sm:w-48">
        <SubmitButton form={form} pending={change.isPending} pendingText="Updating…">
          Change password
        </SubmitButton>
      </div>
    </form>
  )
}
