import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '#/features/auth/sign-in'

const str = (v: unknown) => (typeof v === 'string' && v.length ? v : undefined)

export const Route = createFileRoute('/_guest/sign-in')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; error?: string; reset?: boolean } => ({
    redirect: str(s.redirect),
    error: str(s.error),
    reset: s.reset === true || s.reset === 'true' || s.reset === '1' ? true : undefined,
  }),
  head: () => ({ meta: [{ title: 'Sign in' }] }),
  component: function SignInRoute() {
    const search = Route.useSearch()
    return <SignIn {...search} />
  },
})
