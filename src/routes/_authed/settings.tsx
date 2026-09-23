import { createFileRoute } from '@tanstack/react-router'
import { Monitor, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Field, FormAlert, fieldErrorsFrom, formValues } from '#/components/auth/form'
import { Button } from '#/components/ui/button'
import { Switch } from '#/components/ui/switch'
import { isApiError } from '#/lib/api/errors'
import {
  useChangePassword,
  useConfirmDeleteAccount,
  useConfirmPassword,
  useDeleteAccount,
  useLogoutAll,
  useNotificationPreferences,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useUpdateNotificationPreferences,
  useUpdateProfile,
  useUser,
} from '#/lib/auth/hooks'
import { sessionsQueryOptions } from '#/lib/auth/queries'

export const Route = createFileRoute('/_authed/settings')({
  loader: ({ context }) => {
    // Prefetch without blocking navigation.
    void context.queryClient.prefetchQuery(sessionsQueryOptions())
  },
  head: () => ({ meta: [{ title: 'Settings' }] }),
  component: SettingsPage,
})

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-heading text-xl font-semibold">Settings</h1>
      <ProfileSection />
      <PasswordSection />
      <SessionsSection />
      <NotificationsSection />
      <DangerSection />
    </main>
  )
}

function ProfileSection() {
  const user = useUser()
  const update = useUpdateProfile()
  const errors = fieldErrorsFrom(update.error)

  return (
    <Section title="Profile" description="PATCH v1/user/me">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const { get } = formValues(e.currentTarget)
          update.mutate({ name: get('name'), email: get('email') })
        }}
      >
        <FormAlert error={update.error} success={update.data?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={user.name} error={errors.name} />
          <Field label="Email" name="email" type="email" defaultValue={user.email} error={errors.email} />
        </div>
        <Button type="submit" size="lg" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </Section>
  )
}

function PasswordSection() {
  const change = useChangePassword()
  const errors = fieldErrorsFrom(change.error)

  return (
    <Section title="Password" description="POST v1/user/change-password">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const { get } = formValues(form)
          change.mutate(
            {
              current_password: get('current_password'),
              password: get('password'),
              password_confirmation: get('password_confirmation'),
            },
            { onSuccess: () => form.reset() },
          )
        }}
      >
        <FormAlert error={change.error} success={change.data?.message} />
        <Field label="Current password" name="current_password" type="password" autoComplete="current-password" error={errors.current_password} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" name="password" type="password" autoComplete="new-password" error={errors.password} />
          <Field label="Confirm" name="password_confirmation" type="password" autoComplete="new-password" error={errors.password_confirmation} />
        </div>
        <Button type="submit" size="lg" disabled={change.isPending}>
          {change.isPending ? 'Updating…' : 'Change password'}
        </Button>
      </form>
    </Section>
  )
}

function SessionsSection() {
  const sessions = useSessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const logoutAll = useLogoutAll()

  return (
    <Section title="Active sessions" description="GET / DELETE v1/user/sessions">
      <FormAlert error={sessions.error ?? revoke.error ?? revokeOthers.error} />
      <ul className="divide-y">
        {sessions.isLoading ? <li className="py-3 text-xs text-muted-foreground">Loading…</li> : null}
        {sessions.data?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <Monitor className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">
                  {s.name ?? s.user_agent ?? 'Unknown device'}
                  {s.is_current ? <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[0.65rem] text-primary">This device</span> : null}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  {[s.ip_address, s.last_used_at && `Last active ${new Date(s.last_used_at).toLocaleString()}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {!s.is_current ? (
              <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>
                Revoke
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="lg" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
          Log out other devices
        </Button>
        <Button variant="destructive" size="lg" disabled={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
          Log out everywhere
        </Button>
      </div>
    </Section>
  )
}

function NotificationsSection() {
  const prefs = useNotificationPreferences()
  const update = useUpdateNotificationPreferences()
  const entries = Object.entries(prefs.data ?? {}).filter(([, v]) => typeof v === 'boolean') as Array<[string, boolean]>

  return (
    <Section title="Notifications" description="GET / PUT v1/user/notifications/preferences">
      <FormAlert error={prefs.error ?? update.error} />
      {prefs.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
      {!prefs.isLoading && entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No toggleable preferences returned by the API.</p>
      ) : null}
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <label htmlFor={`pref-${key}`} className="capitalize">
              {key.replace(/[_.]/g, ' ')}
            </label>
            <Switch
              id={`pref-${key}`}
              checked={value}
              disabled={update.isPending}
              onCheckedChange={(checked) => update.mutate({ ...prefs.data, [key]: checked })}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

function DangerSection() {
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const confirmPassword = useConfirmPassword()
  const del = useDeleteAccount()
  const confirmDelete = useConfirmDeleteAccount()
  const passwordRequired = isApiError(del.error) && del.error.isPasswordConfirmationRequired

  return (
    <Section title="Delete account" description="DELETE v1/user/me → POST v1/user/me/delete/confirm">
      <div className="space-y-4">
        <FormAlert
          error={del.error && !passwordRequired ? del.error : (confirmDelete.error ?? confirmPassword.error)}
          success={del.data?.message ?? confirmDelete.data?.message}
        />

        {passwordRequired ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              confirmPassword.mutate(
                { password: formValues(e.currentTarget).get('password') },
                { onSuccess: () => del.mutate({}) },
              )
            }}
          >
            <Field className="flex-1" label="Confirm your password" name="password" type="password" />
            <Button type="submit" size="lg" className="h-9">Confirm</Button>
          </form>
        ) : null}

        {del.isSuccess && !del.data.deleted ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              confirmDelete.mutate({ code: formValues(e.currentTarget).get('code') })
            }}
          >
            <Field className="flex-1" label="Confirmation code" name="code" />
            <Button type="submit" variant="destructive" size="lg" className="h-9">Delete permanently</Button>
          </form>
        ) : needsConfirm ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="lg" disabled={del.isPending} onClick={() => del.mutate({})}>
              <Trash2 /> Yes, delete my account
            </Button>
            <Button variant="outline" size="lg" onClick={() => setNeedsConfirm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="destructive" size="lg" onClick={() => setNeedsConfirm(true)}>
            <Trash2 /> Delete account
          </Button>
        )}
      </div>
    </Section>
  )
}
