import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { FormField } from '#/components/form/form-field'
import { SubmitButton } from '#/components/form/submit-button'
import { useSignUpMutation } from '../queries/auth.mutations'
import { type SignUpInput, signUpSchema } from '../schema/sign-up.schema'
import { applyServerErrors } from '../utils/auth'
import { SocialButtons } from './social-buttons'

export interface SignUpFormProps {
  redirect: string
  /** Called when the API returned a token (user is signed in). */
  onSuccess: () => void
}

export function SignUpForm({ redirect, onSuccess }: SignUpFormProps) {
  const signUp = useSignUpMutation()
  const [formError, setFormError] = useState<unknown>()

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    } as SignUpInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: signUpSchema },
    onSubmit: async ({ value }) => {
      setFormError(undefined)
      try {
        const res = await signUp.mutateAsync(value)
        if (res.user) onSuccess()
      } catch (error) {
        applyServerErrors(form, error)
        setFormError(error)
      }
    },
  })

  // Email verification required: API created the account without a token.
  if (signUp.isSuccess && !signUp.data.user) {
    return <FormAlert success={signUp.data.message} />
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

      <form.Field name="name">
        {(field) => <FormField field={field} label="Full name" autoComplete="name" autoFocus />}
      </form.Field>

      <form.Field name="email">
        {(field) => <FormField field={field} label="Email" type="email" autoComplete="email" />}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormField
            field={field}
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
          />
        )}
      </form.Field>

      <form.Field name="password_confirmation">
        {(field) => (
          <FormField
            field={field}
            label="Confirm password"
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.Field>

      <SubmitButton form={form} pending={signUp.isPending} pendingText="Creating account…">
        Create account
      </SubmitButton>

      <SocialButtons redirect={redirect} />
    </form>
  )
}
