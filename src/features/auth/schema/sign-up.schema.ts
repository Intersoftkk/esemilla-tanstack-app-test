import { z } from 'zod'
import { emailField } from './sign-in.schema'

export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(255),
    email: emailField,
    password: passwordField,
    password_confirmation: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match.',
  })

export type SignUpInput = z.input<typeof signUpSchema>
export type SignUpValues = z.output<typeof signUpSchema>
