import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AuthCard,
  Field,
  FormAlert,
  fieldErrorsFrom,
  formValues,
} from '#/components/auth/form'
import { SocialButtons } from '#/components/auth/SocialButtons'
import { Button } from '#/components/ui/button'
import { useRegister, useTenant } from '#/lib/auth/hooks'
import { safeRedirect } from '#/lib/auth/schemas'

export const Route = createFileRoute('/_guest/register')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Create account' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const tenant = useTenant()
  const register = useRegister()
  const errors = fieldErrorsFrom(register.error)
  const redirectTo = safeRedirect(search.redirect)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { get } = formValues(e.currentTarget)
    register.mutate(
      {
        name: get('name'),
        email: get('email'),
        password: get('password'),
        password_confirmation: get('password_confirmation'),
      },
      {
        onSuccess: (res) => {
          if (res.user) navigate({ to: redirectTo })
        },
      },
    )
  }

  const pendingVerification = register.isSuccess && !register.data.user

  return (
    <AuthCard
      title={`Join ${tenant.name}`}
      description="Create your account to get started."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" search={{ redirect: search.redirect }} className="text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {pendingVerification ? (
        <FormAlert success={register.data.message} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormAlert error={register.error} />
          <Field label="Name" name="name" autoComplete="name" required autoFocus error={errors.name} />
          <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            error={errors.password}
            hint="At least 8 characters."
          />
          <Field
            label="Confirm password"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            required
            error={errors.password_confirmation}
          />
          <Button type="submit" size="lg" className="h-9 w-full" disabled={register.isPending}>
            {register.isPending ? 'Creating account…' : 'Create account'}
          </Button>
          <SocialButtons redirect={redirectTo} />
        </form>
      )}
    </AuthCard>
  )
}
