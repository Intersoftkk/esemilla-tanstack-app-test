import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '#/features/auth/sign-up'

const str = (v: unknown) => (typeof v === 'string' && v.length ? v : undefined)

export const Route = createFileRoute('/_guest/sign-up')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: str(s.redirect) }),
  head: () => ({ meta: [{ title: 'Create account' }] }),
  component: function SignUpRoute() {
    const { redirect } = Route.useSearch()
    return <SignUp redirect={redirect} />
  },
})
