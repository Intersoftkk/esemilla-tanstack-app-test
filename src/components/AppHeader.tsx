import { Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth, useLogout } from '#/lib/auth/hooks'

export function AppHeader() {
  const { user, tenant } = useAuth()
  const logout = useLogout()

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-heading text-sm font-semibold">
          {tenant?.logo ? (
            <img src={tenant.logo} alt="" className="size-6 rounded object-cover" />
          ) : (
            <span className="grid size-6 place-items-center rounded bg-primary text-[0.65rem] font-bold text-primary-foreground">
              {tenant?.name.slice(0, 1).toUpperCase() ?? '?'}
            </span>
          )}
          {tenant?.name}
        </Link>

        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <Button variant="ghost" size="lg" asChild>
                <Link to="/dashboard" activeProps={{ className: 'bg-muted' }}>
                  Dashboard
                </Link>
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <Link to="/settings" activeProps={{ className: 'bg-muted' }}>
                  Settings
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut />
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="lg" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="lg" asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
