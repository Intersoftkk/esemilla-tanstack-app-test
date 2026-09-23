import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { ForgotPasswordInput } from '../schema/forgot-password.schema'
import type { OtpInput } from '../schema/otp.schema'
import type {
  ChangePasswordInput,
  ConfirmPasswordInput,
  ResetPasswordRequest,
} from '../schema/reset-password.schema'
import type { SignInInput } from '../schema/sign-in.schema'
import type { SignUpInput } from '../schema/sign-up.schema'
import type { SessionState, User } from '../types/auth.types'
import {
  changePasswordFn,
  confirmPasswordFn,
  forgotPasswordFn,
  resetPasswordFn,
  signInFn,
  signOutFn,
  signUpFn,
  socialTokenSignInFn,
  submitOtpFn,
  updateNotificationPreferencesFn,
} from '../utils/auth.functions'
import { authKeys } from './auth.keys'

export function setSessionUser(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData<SessionState>(authKeys.session(), (old) =>
    old ? { ...old, user } : old,
  )
}

/**
 * After sign-in/out: set the user, drop every other cached query (it belonged
 * to the previous user) and re-run route guards/loaders.
 */
function useAuthChanged() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async (user: User | null) => {
    queryClient.removeQueries({
      predicate: (q) => !(q.queryKey[0] === 'auth' && q.queryKey[1] === 'session'),
    })
    if (user) setSessionUser(queryClient, user)
    else await queryClient.invalidateQueries({ queryKey: authKeys.session() })
    await router.invalidate()
  }
}

export function useSignInMutation() {
  const fn = useServerFn(signInFn)
  const changed = useAuthChanged()
  return useMutation({
    mutationFn: (data: SignInInput) => fn({ data }),
    onSuccess: (res) => changed(res.user),
  })
}

export function useSignUpMutation() {
  const fn = useServerFn(signUpFn)
  const changed = useAuthChanged()
  return useMutation({
    mutationFn: (data: SignUpInput) => fn({ data }),
    onSuccess: (res) => (res.user ? changed(res.user) : undefined),
  })
}

export function useSocialTokenSignInMutation() {
  const fn = useServerFn(socialTokenSignInFn)
  const changed = useAuthChanged()
  return useMutation({
    mutationFn: (data: { provider: string; token: string }) => fn({ data }),
    onSuccess: (res) => changed(res.user),
  })
}

export function useSignOutMutation() {
  const fn = useServerFn(signOutFn)
  const changed = useAuthChanged()
  const router = useRouter()
  return useMutation({
    mutationFn: () => fn(),
    onSettled: async () => {
      await changed(null)
      await router.navigate({ to: '/sign-in' })
    },
  })
}

export function useForgotPasswordMutation() {
  const fn = useServerFn(forgotPasswordFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ForgotPasswordInput) => fn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.pendingReset() }),
  })
}

export function useSubmitOtpMutation() {
  const fn = useServerFn(submitOtpFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: OtpInput) => fn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.pendingReset() }),
  })
}

export function useResendOtpMutation() {
  const fn = useServerFn(forgotPasswordFn)
  return useMutation({
    mutationFn: (email: string) => fn({ data: { email } }),
  })
}

export function useResetPasswordMutation() {
  const fn = useServerFn(resetPasswordFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => fn({ data }),
    onSuccess: () => queryClient.removeQueries({ queryKey: authKeys.pendingReset() }),
  })
}

export function useChangePasswordMutation() {
  const fn = useServerFn(changePasswordFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ChangePasswordInput) => fn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.passwordStatus() }),
  })
}

export function useConfirmPasswordMutation() {
  const fn = useServerFn(confirmPasswordFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ConfirmPasswordInput) => fn({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.passwordStatus() }),
  })
}

export function useUpdateNotificationPreferencesMutation() {
  const fn = useServerFn(updateNotificationPreferencesFn)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => fn({ data }),
    onMutate: async (next) => {
      // Optimistic toggle
      const key = authKeys.notificationPreferences()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, next)
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(authKeys.notificationPreferences(), ctx.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: authKeys.notificationPreferences() }),
  })
}
