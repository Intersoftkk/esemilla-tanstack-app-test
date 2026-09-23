import { createFileRoute, redirect } from '@tanstack/react-router'
import { Otp } from '#/features/auth/otp'
import { pendingResetQueryOptions } from '#/features/auth/queries/auth.queries'
import { getPasswordResetMode } from '#/features/auth/utils/auth'

const str = (v: unknown) => (typeof v === 'string' && v.length ? v : undefined)

/** Step 2 (OTP mode): enter the code e-mailed by POST v1/user/forgot-password. */
export const Route = createFileRoute('/_guest/otp')({
  validateSearch: (s: Record<string, unknown>): { error?: string } => ({ error: str(s.error) }),
  loader: async ({ context }) => {
    if (getPasswordResetMode() !== 'otp') throw redirect({ to: '/forgot-password' })
    // Always re-read: the pending-reset cookie may have expired.
    const pending = await context.queryClient.fetchQuery({ ...pendingResetQueryOptions(), staleTime: 0 })
    if (!pending) throw redirect({ to: '/forgot-password' })
    return { email: pending.email }
  },
  head: () => ({ meta: [{ title: 'Enter code' }] }),
  component: function OtpRoute() {
    const { email } = Route.useLoaderData()
    const { error } = Route.useSearch()
    return <Otp email={email} error={error} />
  },
})
