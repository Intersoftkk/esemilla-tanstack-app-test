import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireGuest } from '#/lib/auth/guards'
import { safeRedirect } from '#/lib/auth/schemas'

/** Pathless layout for login / register / password reset (guests only). */
export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context, location }) => {
    const redirect = (location.search as { redirect?: unknown }).redirect
    await requireGuest(context.queryClient, safeRedirect(redirect))
  },
  component: () => <Outlet />,
})
