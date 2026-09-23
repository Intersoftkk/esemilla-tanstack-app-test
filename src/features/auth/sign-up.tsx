import { useNavigate } from '@tanstack/react-router'
import { AuthLayout, AuthLink } from './auth-layout'
import { SignUpForm } from './components/sign-up-form'
import { useTenant } from './hooks/use-auth'
import { safeRedirect } from './utils/auth'

export function SignUp({ redirect }: { redirect?: string }) {
  const navigate = useNavigate()
  const tenant = useTenant()
  const target = safeRedirect(redirect)

  return (
    <AuthLayout
      title={`Join ${tenant.name}`}
      description="Create your account to get started."
      footer={
        <>
          Already have an account?{' '}
          <AuthLink to="/sign-in" search={{ redirect }}>
            Sign in
          </AuthLink>
        </>
      }
    >
      <SignUpForm redirect={target} onSuccess={() => navigate({ to: target, replace: true })} />
    </AuthLayout>
  )
}
