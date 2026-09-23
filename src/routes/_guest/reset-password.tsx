import { createFileRoute, redirect } from '@tanstack/react-router'
import { pendingResetQueryOptions } from '#/features/auth/queries/auth.queries'
import { ResetPassword } from '#/features/auth/reset-password'
import { getPasswordResetMode } from '#/features/auth/utils/auth'

const str = (v: unknown) => (typeof v === 'string' && v.length ? v : undefined)

/**
 * Step 3. Two modes (VITE_PASSWORD_RESET_MODE):
 *  - otp  : email + code come from the encrypted pending-reset cookie
 *  - link : /reset-password?token=...&email=... (Laravel's default e-mail link)
 */
export const Route = createFileRoute('/_guest/reset-password')({
  validateSearch: (s: Record<string, unknown>): { token?: string; email?: string } => ({
    token: str(s.token),
    email: str(s.email),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const mode = getPasswordResetMode()
    if (mode === 'link' || deps.token) {
      return { mode: 'link' as const, email: deps.email ?? '', token: deps.token }
    }
    const pending = await context.queryClient.fetchQuery({ ...pendingResetQueryOptions(), staleTime: 0 })
    if (!pending) throw redirect({ to: '/forgot-password' })
    if (!pending.hasCode) throw redirect({ to: '/otp' })
    return { mode: 'otp' as const, email: pending.email, token: undefined }
  },
  head: () => ({ meta: [{ title: 'Reset password' }] }),
  component: function ResetPasswordRoute() {
    const data = Route.useLoaderData()
    return <ResetPassword {...data} />
  },
})
