import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/features/auth/hooks/use-auth'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { tenant, user } = useAuth()

  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-heading text-3xl font-bold">Welcome to {tenant?.name}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {user ? `Signed in as ${user.email}` : 'Sign in to access your workspace.'}
      </p>
      <div className="mt-8 flex justify-center gap-2">
        {user ? (
          <Button size="lg" asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        ) : (
          <>
            <Button size="lg" asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/sign-up">Create account</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
