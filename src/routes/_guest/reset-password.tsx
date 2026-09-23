import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AuthCard,
  Field,
  FormAlert,
  fieldErrorsFrom,
  formValues,
} from '#/components/auth/form'
import { Button } from '#/components/ui/button'
import { useResetPassword } from '#/lib/auth/hooks'

/**
 * Laravel's reset link should point to:
 *   https://<tenant-domain>/reset-password?token=...&email=...
 * (see ResetPassword::createUrlUsing in the README).
 */
export const Route = createFileRoute('/_guest/reset-password')({
  validateSearch: z.object({
    token: z.string().optional(),
    email: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: 'Reset password' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const reset = useResetPassword()
  const errors = fieldErrorsFrom(reset.error)

  if (!search.token) {
    return (
      <AuthCard title="Invalid reset link" description="This password reset link is invalid or has expired.">
        <Button asChild size="lg" className="h-9 w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    )
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { get } = formValues(e.currentTarget)
    reset.mutate(
      {
        token: search.token ?? '',
        email: get('email'),
        password: get('password'),
        password_confirmation: get('password_confirmation'),
      },
      { onSuccess: () => navigate({ to: '/login', search: { reset: '1' } }) },
    )
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert error={reset.error} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={search.email}
          required
          error={errors.email ?? errors.token}
        />
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          error={errors.password}
        />
        <Field
          label="Confirm password"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          required
          error={errors.password_confirmation}
        />
        <Button type="submit" size="lg" className="h-9 w-full" disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Reset password'}
        </Button>
      </form>
    </AuthCard>
  )
}
