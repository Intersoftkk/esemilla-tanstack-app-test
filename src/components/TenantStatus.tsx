import type { TenantState } from '#/lib/auth/functions'

/** Full-page screen rendered when the host is not a valid tenant. */
export function TenantStatus({ state }: { state: Exclude<TenantState, { status: 'found' }> }) {
  const content = {
    not_found: {
      code: '404',
      title: 'Workspace not found',
      body: `There is no workspace at ${'host' in state ? state.host : 'this address'}. Check the URL or contact your administrator.`,
    },
    inactive: {
      code: '403',
      title: 'Workspace unavailable',
      body: 'This workspace is currently suspended or inactive.',
    },
    error: {
      code: '503',
      title: 'Service temporarily unavailable',
      body: 'We could not reach the server. Please try again in a moment.',
    },
  }[state.status]

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="font-heading text-5xl font-bold text-muted-foreground">
          {content.code}
        </p>
        <h1 className="mt-4 text-xl font-semibold">{content.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{content.body}</p>
      </div>
    </main>
  )
}
