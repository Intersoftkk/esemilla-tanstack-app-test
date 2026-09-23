import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { AuthLayout, AuthLink } from './auth-layout'
import { ResetPasswordForm } from './components/reset-password-form'

export interface ResetPasswordProps {
  email: string
  /** Link mode token (`?token=`); undefined in OTP mode. */
  token?: string
  mode: 'otp' | 'link'
}

export function ResetPassword({ email, token, mode }: ResetPasswordProps) {
  const navigate = useNavigate()

  if (mode === 'link' && !token) {
    return (
      <AuthLayout title="Invalid reset link" description="This link is invalid or has expired.">
        <Button asChild size="lg" className="h-9 w-full">
          <AuthLink to="/forgot-password">Request a new link</AuthLink>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose a new password"
      footer={<AuthLink to="/sign-in">Back to sign in</AuthLink>}
    >
      <ResetPasswordForm
        email={email}
        token={token}
        lockEmail={mode === 'otp'}
        onSuccess={() => navigate({ to: '/sign-in', search: { reset: true }, replace: true })}
        onInvalidCode={
          mode === 'otp'
            ? (message) => navigate({ to: '/otp', search: { error: message } })
            : undefined
        }
      />
    </AuthLayout>
  )
}
