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
import { useLogin, useTenant } from '#/lib/auth/hooks'
import { safeRedirect } from '#/lib/auth/schemas'

export const Route = createFileRoute('/_guest/login')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    error: z.string().optional(),
    reset: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: 'Log in' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const tenant = useTenant()
  const login = useLogin()
  const errors = fieldErrorsFrom(login.error)
  const redirectTo = safeRedirect(search.redirect)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { get, bool } = formValues(e.currentTarget)
    login.mutate(
      { email: get('email'), password: get('password'), remember: bool('remember') },
      { onSuccess: () => navigate({ to: redirectTo }) },
    )
  }

  return (
    <AuthCard
      title={`Log in to ${tenant.name}`}
      description="Welcome back! Enter your credentials to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" search={{ redirect: search.redirect }} className="text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert
          error={login.error ?? (search.error ? new Error(search.error) : undefined)}
          success={search.reset ? 'Password reset. You can now log in.' : undefined}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          error={errors.email}
        />
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link to="/forgot-password" className="text-[0.7rem] font-normal text-primary hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password}
        />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="remember" className="accent-primary" defaultChecked />
          Remember me
        </label>
        <Button type="submit" size="lg" className="h-9 w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Log in'}
        </Button>
        <SocialButtons redirect={redirectTo} />
      </form>
    </AuthCard>
  )
}
