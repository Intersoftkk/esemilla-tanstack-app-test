import { createFileRoute } from '@tanstack/react-router'
import { startSocialLogin } from '#/server/social.server'

/** GET /auth/redirect/:provider -> provider consent screen */
export const Route = createFileRoute('/auth/redirect/$provider')({
  server: {
    handlers: {
      GET: ({ request, params }) => startSocialLogin(request, params.provider),
    },
  },
})
