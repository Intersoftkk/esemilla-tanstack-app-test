import { useNavigate } from '@tanstack/react-router'
import { AuthLayout, AuthLink } from './auth-layout'
import { OtpForm } from './components/otp-form'

export interface OtpProps {
  /** Email from the pending-reset cookie (resolved in the route loader). */
  email: string
  error?: string
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`
}

export function Otp({ email, error }: OtpProps) {
  const navigate = useNavigate()

  return (
    <AuthLayout
      title="Enter verification code"
      description={
        <>
          We sent a code to <strong className="text-foreground">{maskEmail(email)}</strong>.
        </>
      }
      footer={<AuthLink to="/forgot-password">Use a different email</AuthLink>}
    >
      <OtpForm
        email={email}
        initialError={error}
        onVerified={() => navigate({ to: '/reset-password' })}
      />
    </AuthLayout>
  )
}
