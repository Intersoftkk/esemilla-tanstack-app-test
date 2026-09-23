import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { getErrorMessage } from '#/lib/api/errors'

/** Form-level error / success banner. */
export function FormAlert({ error, success }: { error?: unknown; success?: ReactNode }) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>{typeof error === 'string' ? error : getErrorMessage(error)}</span>
      </div>
    )
  }
  if (success) {
    return (
      <output className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        <span>{success}</span>
      </output>
    )
  }
  return null
}
