import { useQuery } from '@tanstack/react-query'
import { FormAlert } from '#/components/form/form-alert'
import { Switch } from '#/components/ui/switch'
import { useUpdateNotificationPreferencesMutation } from '#/features/auth/queries/auth.mutations'
import { notificationPreferencesQueryOptions } from '#/features/auth/queries/auth.queries'

/** GET / PUT v1/user/notifications/preferences (optimistic toggles). */
export function NotificationPreferences() {
  const prefs = useQuery(notificationPreferencesQueryOptions())
  const update = useUpdateNotificationPreferencesMutation()
  const toggles = Object.entries(prefs.data ?? {}).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
  )

  return (
    <div className="space-y-3">
      <FormAlert error={prefs.error ?? update.error} />
      {prefs.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
      {!prefs.isLoading && toggles.length === 0 ? (
        <p className="text-xs text-muted-foreground">No preferences available.</p>
      ) : null}
      {toggles.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between text-xs">
          <label htmlFor={`pref-${key}`} className="capitalize">
            {key.replace(/[_.]/g, ' ')}
          </label>
          <Switch
            id={`pref-${key}`}
            checked={value}
            onCheckedChange={(checked) => update.mutate({ ...prefs.data, [key]: checked })}
          />
        </div>
      ))}
    </div>
  )
}
