import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireGuest } from '#/features/auth/queries/auth.queries'
import { safeRedirect } from '#/features/auth/utils/auth'

/** Pathless layout for sign-in / sign-up / password reset (guests only). */
export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context, location }) => {
    const redirect = (location.search as { redirect?: unknown }).redirect
    await requireGuest(context.queryClient, safeRedirect(redirect))
  },
  component: () => <Outlet />,
})
