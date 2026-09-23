import { createFileRoute, notFound } from '@tanstack/react-router'
import { PlanDetail } from '#/features/plans/plan-detail'
import { planQueryOptions } from '#/features/plans/queries/plans.queries'
import { isApiError } from '#/lib/api/errors'

/** Public: GET v1/plans/{slug} */
export const Route = createFileRoute('/plans/$slug')({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(planQueryOptions(params.slug))
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.name ?? 'Plan' }] }),
  component: function PlanRoute() {
    const { slug } = Route.useParams()
    return <PlanDetail slug={slug} />
  },
})
