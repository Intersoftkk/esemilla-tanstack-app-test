import type { ReactNode } from 'react'
import { ChangePasswordForm } from './components/change-password-form'
import { ConfirmPasswordForm } from './components/confirm-password-form'
import { NotificationPreferences } from './components/notification-preferences'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function Settings() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-heading text-xl font-semibold">Settings</h1>
      <Section title="Change password" description="Update the password you use to sign in.">
        <ChangePasswordForm />
      </Section>
      <Section title="Password confirmation" description="Re-enter your password before sensitive actions.">
        <ConfirmPasswordForm />
      </Section>
      <Section title="Notifications" description="Choose what we notify you about.">
        <NotificationPreferences />
      </Section>
    </main>
  )
}
