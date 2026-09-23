import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireUser } from '#/lib/auth/guards'

/**
 * Pathless layout: every route inside `src/routes/_authed/` requires login.
 * The authenticated user is available as `context.user` in child routes.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context.queryClient, location)
    return { user }
  },
  component: () => <Outlet />,
})
