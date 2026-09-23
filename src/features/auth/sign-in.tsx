import { useNavigate } from '@tanstack/react-router'
import { AuthLayout, AuthLink } from './auth-layout'
import { SignInForm } from './components/sign-in-form'
import { useTenant } from './hooks/use-auth'
import { safeRedirect } from './utils/auth'

export interface SignInProps {
  redirect?: string
  error?: string
  reset?: boolean
}

export function SignIn({ redirect, error, reset }: SignInProps) {
  const navigate = useNavigate()
  const tenant = useTenant()
  const target = safeRedirect(redirect)

  return (
    <AuthLayout
      title={`Sign in to ${tenant.name}`}
      description="Welcome back! Enter your details to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <AuthLink to="/sign-up" search={{ redirect }}>
            Sign up
          </AuthLink>
        </>
      }
    >
      <SignInForm
        redirect={target}
        initialError={error}
        initialSuccess={reset ? 'Password reset successfully. Please sign in.' : undefined}
        onSuccess={() => navigate({ to: target, replace: true })}
      />
    </AuthLayout>
  )
}
