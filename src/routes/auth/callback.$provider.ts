import { createFileRoute } from '@tanstack/react-router'
import { finishSocialSignIn } from '#/features/auth/utils/auth.server'

/** GET /auth/callback/:provider  (register this URL with the provider) */
export const Route = createFileRoute('/auth/callback/$provider')({
  server: {
    handlers: {
      GET: ({ request, params }) => finishSocialSignIn(request, params.provider),
    },
  },
})
