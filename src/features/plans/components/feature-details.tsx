import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '#/lib/api/errors'
import { featureQueryOptions } from '../queries/plans.queries'
import type { Feature } from '../types/plans.types'

/**
 * Feature row that lazily loads `GET v1/features/{slug}` FROM THE BROWSER
 * (through the /api proxy) when expanded — a client-side call example.
 */
export function FeatureDetails({ feature }: { feature: Feature }) {
  const [open, setOpen] = useState(false)
  const detail = useQuery({ ...featureQueryOptions(feature.slug), enabled: open })

  return (
    <li className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-xs font-medium">{feature.name}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          {detail.isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : detail.error ? (
            <span className="text-destructive">{getErrorMessage(detail.error)}</span>
          ) : (
            (detail.data?.description ?? feature.description ?? 'No description.')
          )}
        </div>
      ) : null}
    </li>
  )
}
