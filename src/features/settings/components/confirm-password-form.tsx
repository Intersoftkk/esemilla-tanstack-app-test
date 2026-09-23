import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { FormField } from '#/components/form/form-field'
import { SubmitButton } from '#/components/form/submit-button'
import { useConfirmPasswordMutation } from '#/features/auth/queries/auth.mutations'
import { passwordStatusQueryOptions } from '#/features/auth/queries/auth.queries'
import {
  type ConfirmPasswordInput,
  confirmPasswordSchema,
} from '#/features/auth/schema/reset-password.schema'
import { applyServerErrors } from '#/features/auth/utils/auth'

/**
 * GET v1/user/password/status + POST v1/user/password/confirm
 * ("sudo mode" before sensitive actions).
 */
export function ConfirmPasswordForm() {
  const status = useQuery(passwordStatusQueryOptions())
  const confirm = useConfirmPasswordMutation()
  const [formError, setFormError] = useState<unknown>()

  const form = useForm({
    defaultValues: { password: '' } as ConfirmPasswordInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: confirmPasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(undefined)
      try {
        await confirm.mutateAsync(value)
        formApi.reset()
      } catch (error) {
        applyServerErrors(form, error)
        setFormError(error)
      }
    },
  })

  const entries = Object.entries(status.data ?? {})

  return (
    <div className="space-y-4">
      {entries.length ? (
        <dl className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-xs">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
              <dd className="font-medium">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <form
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="password">
          {(field) => (
            <FormField
              field={field}
              className="flex-1"
              label="Confirm your password"
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.Field>
        <div className="sm:w-40">
          <SubmitButton form={form} pending={confirm.isPending}>
            <ShieldCheck /> Confirm
          </SubmitButton>
        </div>
      </form>
      <FormAlert error={formError} success={confirm.isSuccess ? confirm.data.message : undefined} />
    </div>
  )
}
