/**
 * Public API of the auth feature.
 *
 * NOTE: `utils/auth.server.ts` is intentionally NOT re-exported (server-only).
 * Import it directly from server code:  `#/features/auth/utils/auth.server`
 */

// Pages
export { AuthLayout } from './auth-layout'
export { ForgotPassword } from './forgot-password'
export { Otp } from './otp'
export { ResetPassword } from './reset-password'
export { SignIn } from './sign-in'
export { SignUp } from './sign-up'

// Components
export { ForgotPasswordForm } from './components/forgot-password-form'
export { OtpForm } from './components/otp-form'
export { ResetPasswordForm } from './components/reset-password-form'
export { SignInForm } from './components/sign-in-form'
export { SignUpForm } from './components/sign-up-form'
export { SocialButtons } from './components/social-buttons'

// Hooks
export { useAuth, useSession, useTenant, useUser } from './hooks/use-auth'

// Queries & mutations
export { authKeys } from './queries/auth.keys'
export * from './queries/auth.mutations'
export * from './queries/auth.queries'

// Schemas
export * from './schema/forgot-password.schema'
export * from './schema/otp.schema'
export * from './schema/reset-password.schema'
export * from './schema/sign-in.schema'
export * from './schema/sign-up.schema'

// Types
export type * from './types/auth.types'

// Server functions / middleware (RPC stubs on the client)
export {
  authedServerFn,
  authMiddleware,
  tenantMiddleware,
  tenantServerFn,
} from './utils/auth.functions'

// Utils
export { applyServerErrors, getFieldErrors, safeRedirect } from './utils/auth'
