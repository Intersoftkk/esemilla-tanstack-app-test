import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTenant } from './hooks/use-auth'

export interface AuthLayoutProps {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Centered card layout shared by all auth pages, branded per tenant. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  const tenant = useTenant()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2 font-heading text-sm font-semibold">
        {tenant.logo ? (
          <img src={tenant.logo} alt="" className="size-8 rounded-md object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {tenant.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        {tenant.name}
      </Link>

      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="font-heading text-lg font-semibold">{title}</h1>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>

      {footer ? (
        <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  )
}

export function AuthLink({ to, search, children }: { to: string; search?: Record<string, unknown>; children: ReactNode }) {
  return (
    <Link to={to} search={search} className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}
