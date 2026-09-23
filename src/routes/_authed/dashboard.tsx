import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import {
  dashboardQueryOptions,
  profileClientQueryOptions,
} from '#/features/example/api'
import { getErrorMessage } from '#/lib/api/errors'
import { useUser } from '#/lib/auth/hooks'

export const Route = createFileRoute('/_authed/dashboard')({
  // SERVER-SIDE: prefetched during SSR (or via server fn on client navigation).
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardQueryOptions()),
  head: () => ({ meta: [{ title: 'Dashboard' }] }),
  component: DashboardPage,
})

function DashboardPage() {
  const user = useUser()
  const { data: server } = useSuspenseQuery(dashboardQueryOptions())

  // CLIENT-SIDE: fetched from the browser through the /api proxy, on demand.
  const client = useQuery({ ...profileClientQueryOptions(), enabled: false })

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Hi, {user.name} 👋</h1>
        <p className="text-sm text-muted-foreground">
          You are signed in to <strong>{server.tenant}</strong>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Server-side call</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Server function → Laravel. Rendered at {server.renderedAt}
          </p>
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[0.7rem]">
            {JSON.stringify(server.user, null, 2)}
          </pre>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Client-side call</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Browser → <code>/api/v1/user/me</code> → Laravel
          </p>
          <Button size="lg" onClick={() => client.refetch()} disabled={client.isFetching}>
            {client.isFetching ? 'Loading…' : 'Fetch from browser'}
          </Button>
          {client.error ? (
            <p className="mt-3 text-xs text-destructive">{getErrorMessage(client.error)}</p>
          ) : null}
          {client.data ? (
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[0.7rem]">
              {JSON.stringify(client.data, null, 2)}
            </pre>
          ) : null}
        </section>
      </div>
    </main>
  )
}
