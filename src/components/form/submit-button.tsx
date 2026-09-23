import type { AnyFormApi } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'

/** Submit button that disables itself while the form (or mutation) is busy. */
export function SubmitButton({
  form,
  pending,
  children,
  pendingText,
}: {
  form: AnyFormApi
  pending?: boolean
  children: ReactNode
  pendingText?: ReactNode
}) {
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const busy = pending || isSubmitting
  return (
    <Button type="submit" size="lg" className="h-9 w-full" disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : null}
      {busy && pendingText ? pendingText : children}
    </Button>
  )
}
