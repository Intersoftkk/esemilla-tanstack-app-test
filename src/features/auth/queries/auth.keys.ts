export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  pendingReset: () => [...authKeys.all, 'pending-reset'] as const,
  passwordStatus: () => [...authKeys.all, 'password-status'] as const,
  notificationPreferences: () => [...authKeys.all, 'notification-preferences'] as const,
}
