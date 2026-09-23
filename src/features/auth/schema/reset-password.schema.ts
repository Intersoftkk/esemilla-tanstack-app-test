import { z } from 'zod'
import { emailField } from './sign-in.schema'
import { passwordField } from './sign-up.schema'

/** Form values (the token/OTP comes from the URL or the pending-reset cookie). */
export const resetPasswordSchema = z
  .object({
    email: emailField,
    password: passwordField,
    password_confirmation: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })

/**
 * Server-function input. Link mode: email + token required.
 * OTP mode: email/code are read from the pending-reset cookie.
 */
export const resetPasswordRequestSchema = z
  .object({
    email: emailField.optional(),
    password: passwordField,
    password_confirmation: z.string(),
    /** Token from the email link (link mode). OTP mode reads it from the cookie. */
    token: z.string().optional(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })
  .refine((d) => !d.token || !!d.email, { path: ['email'], message: 'Email is required.' })

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required.'),
    password: passwordField,
    password_confirmation: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })
  .refine((d) => d.password !== d.current_password, {
    path: ['password'],
    message: 'New password must be different from the current one.',
  })

export const confirmPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
})

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
export type ResetPasswordRequest = z.input<typeof resetPasswordRequestSchema>
export type ChangePasswordInput = z.input<typeof changePasswordSchema>
export type ConfirmPasswordInput = z.input<typeof confirmPasswordSchema>
