import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  notFound,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { AppHeader } from '#/components/app-header'
import { TenantStatus } from '#/components/tenant-status'
import { useSession } from '#/features/auth/hooks/use-auth'
import { sessionQueryOptions } from '#/features/auth/queries/auth.queries'
import { getLocale } from '#/paraglide/runtime'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', getLocale())
    }
    // Resolve tenant (v1/tenants/check) + current user (v1/user/me) once
    // during SSR; afterwards it's served from the React Query cache.
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())

    // Unknown / suspended tenant: stop here so no child guard or loader runs.
    // Rendered by `notFoundComponent` below (HTTP 404 during SSR).
    if (session.tenant.status !== 'found') throw notFound()

    return { session }
  },

  head: ({ match }) => {
    const session = match.context.session
    const tenantName =
      session?.tenant.status === 'found' ? session.tenant.tenant.name : undefined
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: tenantName ?? 'Workspace' },
      ],
      links: [{ rel: 'stylesheet', href: appCss }],
    }
  },

  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}

function NotFound() {
  const session = useSession()
  if (session.tenant.status !== 'found') {
    return <TenantStatus state={session.tenant} />
  }
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-heading text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh">
        {children}
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
              TanStackQueryDevtools,
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
