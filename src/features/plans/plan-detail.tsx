import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { PlanCard } from './components/plan-card'
import { planQueryOptions } from './queries/plans.queries'

export function PlanDetail({ slug }: { slug: string }) {
  const { data: plan } = useSuspenseQuery(planQueryOptions(slug))

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10">
      <Link to="/plans" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All plans
      </Link>
      <PlanCard plan={plan} />
    </main>
  )
}
