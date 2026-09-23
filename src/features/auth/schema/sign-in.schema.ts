import { z } from 'zod'

export const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.')
  .transform((v) => v.toLowerCase())

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean(),
})

export type SignInInput = z.input<typeof signInSchema>
export type SignInValues = z.output<typeof signInSchema>
