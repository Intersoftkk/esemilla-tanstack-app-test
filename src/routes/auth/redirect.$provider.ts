import { createFileRoute } from '@tanstack/react-router'
import { startSocialSignIn } from '#/features/auth/utils/auth.server'

/** GET /auth/redirect/:provider -> provider consent screen */
export const Route = createFileRoute('/auth/redirect/$provider')({
  server: {
    handlers: {
      GET: ({ request, params }) => startSocialSignIn(request, params.provider),
    },
  },
})
