import { createFileRoute } from '@tanstack/react-router'
import { Plans } from '#/features/plans/plans'
import { featuresQueryOptions, plansQueryOptions } from '#/features/plans/queries/plans.queries'

/** Public: GET v1/plans + GET v1/features (SSR via server functions). */
export const Route = createFileRoute('/plans/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(plansQueryOptions()),
      context.queryClient.ensureQueryData(featuresQueryOptions()),
    ]),
  head: () => ({ meta: [{ title: 'Plans & pricing' }] }),
  component: Plans,
})
