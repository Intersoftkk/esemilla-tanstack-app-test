import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AuthCard,
  Field,
  FormAlert,
  fieldErrorsFrom,
  formValues,
} from '#/components/auth/form'
import { Button } from '#/components/ui/button'
import { useForgotPassword } from '#/lib/auth/hooks'

export const Route = createFileRoute('/_guest/forgot-password')({
  head: () => ({ meta: [{ title: 'Forgot password' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const forgot = useForgotPassword()
  const errors = fieldErrorsFrom(forgot.error)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    forgot.mutate({ email: formValues(e.currentTarget).get('email') })
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Back to login
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert error={forgot.error} success={forgot.data?.message} />
        <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus error={errors.email} />
        <Button type="submit" size="lg" className="h-9 w-full" disabled={forgot.isPending}>
          {forgot.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  )
}
