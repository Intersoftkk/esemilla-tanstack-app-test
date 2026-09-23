import { useNavigate } from '@tanstack/react-router'
import { AuthLayout, AuthLink } from './auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'
import { getPasswordResetMode } from './utils/auth'

export function ForgotPassword() {
  const navigate = useNavigate()
  const mode = getPasswordResetMode()

  return (
    <AuthLayout
      title="Forgot your password?"
      description={
        mode === 'otp'
          ? "Enter your email and we'll send you a verification code."
          : "Enter your email and we'll send you a reset link."
      }
      footer={<AuthLink to="/sign-in">Back to sign in</AuthLink>}
    >
      <ForgotPasswordForm onCodeSent={() => navigate({ to: '/otp' })} />
    </AuthLayout>
  )
}
