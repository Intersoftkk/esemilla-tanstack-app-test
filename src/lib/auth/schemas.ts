import { z } from 'zod'

const email = z.string().trim().toLowerCase().email('Enter a valid email address.')
const password = z.string().min(1, 'Password is required.')
const newPassword = z.string().min(8, 'Password must be at least 8 characters.')

export const loginSchema = z.object({
  email,
  password,
  remember: z.boolean().default(false),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(255),
    email,
    password: newPassword,
    password_confirmation: z.string(),
    remember: z.boolean().default(true),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    email,
    password: newPassword,
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })

export const changePasswordSchema = z
  .object({
    current_password: password,
    password: newPassword,
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })

export const confirmPasswordSchema = z.object({ password })

export const socialProviderSchema = z
  .string()
  .regex(/^[a-z0-9_-]{2,32}$/, 'Invalid provider.')

export const socialTokenSchema = z.object({
  provider: socialProviderSchema,
  /** Provider access token or id_token (e.g. Google One Tap credential). */
  token: z.string().min(1),
  remember: z.boolean().default(true),
})

/** Profile updates are passed through to Laravel, which validates them. */
export const profileSchema = z.record(z.string(), z.unknown())

export const deleteAccountSchema = z.object({
  password: z.string().optional(),
  reason: z.string().max(1000).optional(),
})

export const confirmDeleteSchema = z.record(z.string(), z.unknown())

export const sessionIdSchema = z.object({
  id: z.union([z.string().min(1), z.number()]),
})

export const redirectSchema = z
  .string()
  .optional()
  .transform((v) => safeRedirect(v))

/**
 * Only allow same-site relative redirects (prevents open-redirects via
 * `?redirect=https://evil.com`).
 */
export function safeRedirect(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  return value
}

export type LoginInput = z.input<typeof loginSchema>
export type RegisterInput = z.input<typeof registerSchema>
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
export type ChangePasswordInput = z.input<typeof changePasswordSchema>
