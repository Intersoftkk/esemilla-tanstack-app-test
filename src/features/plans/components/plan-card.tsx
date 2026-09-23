import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { Plan } from '../types/plans.types'

function formatPrice(plan: Plan) {
  if (plan.price === null || plan.price === undefined || plan.price === '') return 'Custom'
  const amount = Number(plan.price)
  if (Number.isNaN(amount)) return String(plan.price)
  if (amount === 0) return 'Free'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: plan.currency || 'USD',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${amount} ${plan.currency ?? ''}`.trim()
  }
}

export function PlanCard({ plan, compact }: { plan: Plan; compact?: boolean }) {
  const features = (plan.features ?? []).map((f) => (typeof f === 'string' ? f : f.name))

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-card p-5',
        plan.is_popular && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">{plan.name}</h3>
        {plan.is_popular ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.65rem] text-primary">
            Popular
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-heading text-2xl font-bold">
        {formatPrice(plan)}
        {plan.interval ? (
          <span className="text-xs font-normal text-muted-foreground"> / {plan.interval}</span>
        ) : null}
      </p>
      {plan.description ? (
        <p className="mt-2 text-xs text-muted-foreground">{plan.description}</p>
      ) : null}
      {!compact && features.length ? (
        <ul className="mt-4 space-y-1.5 text-xs">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 text-primary" />
              {f}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto pt-5">
        <Button asChild variant={plan.is_popular ? 'default' : 'outline'} size="lg" className="h-9 w-full">
          <Link to="/plans/$slug" params={{ slug: plan.slug }}>
            View plan
          </Link>
        </Button>
      </div>
    </div>
  )
}
