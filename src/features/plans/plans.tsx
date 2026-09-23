import { useSuspenseQuery } from '@tanstack/react-query'
import { FeatureDetails } from './components/feature-details'
import { PlanCard } from './components/plan-card'
import { featuresQueryOptions, plansQueryOptions } from './queries/plans.queries'

/** Pricing page: plans + features are SSR'd via server functions. */
export function Plans() {
  const { data: plans } = useSuspenseQuery(plansQueryOptions())
  const { data: features } = useSuspenseQuery(featuresQueryOptions())

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold">Plans &amp; pricing</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose the plan that fits your team.</p>
      </div>

      {plans.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">No plans available.</p>
      )}

      {features.length ? (
        <section className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">All features</h2>
          <ul className="space-y-2">
            {features.map((f) => (
              <FeatureDetails key={f.slug} feature={f} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
