import { revalidateLogic, useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { FormField } from '#/components/form/form-field'
import { SubmitButton } from '#/components/form/submit-button'
import { Switch } from '#/components/ui/switch'
import { useSignInMutation } from '../queries/auth.mutations'
import { type SignInInput, signInSchema } from '../schema/sign-in.schema'
import { applyServerErrors } from '../utils/auth'
import { SocialButtons } from './social-buttons'

export interface SignInFormProps {
  redirect: string
  onSuccess: () => void
  /** Message passed via URL (e.g. social sign-in error). */
  initialError?: string
  initialSuccess?: string
}

export function SignInForm({ redirect, onSuccess, initialError, initialSuccess }: SignInFormProps) {
  const signIn = useSignInMutation()
  const [formError, setFormError] = useState<unknown>(initialError)

  const form = useForm({
    defaultValues: { email: '', password: '', remember: true } as SignInInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: signInSchema },
    onSubmit: async ({ value }) => {
      setFormError(undefined)
      try {
        await signIn.mutateAsync(value)
        onSuccess()
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
      <FormAlert error={formError} success={formError ? undefined : initialSuccess} />

      <form.Field name="email">
        {(field) => (
          <FormField field={field} label="Email" type="email" autoComplete="email" autoFocus />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormField
            field={field}
            label="Password"
            type="password"
            autoComplete="current-password"
            labelAction={
              <Link to="/forgot-password" className="text-[0.7rem] text-primary hover:underline">
                Forgot password?
              </Link>
            }
          />
        )}
      </form.Field>

      <form.Field name="remember">
        {(field) => (
          <div className="flex items-center gap-2">
            <Switch
              id="field-remember"
              checked={field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
            />
            <label htmlFor="field-remember" className="text-xs">
              Keep me signed in
            </label>
          </div>
        )}
      </form.Field>

      <SubmitButton form={form} pending={signIn.isPending} pendingText="Signing in…">
        Sign in
      </SubmitButton>

      <SocialButtons redirect={redirect} />
    </form>
  )
}
