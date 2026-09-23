import { createFileRoute } from '@tanstack/react-router'
import { ForgotPassword } from '#/features/auth/forgot-password'

export const Route = createFileRoute('/_guest/forgot-password')({
  head: () => ({ meta: [{ title: 'Forgot password' }] }),
  component: ForgotPassword,
})
