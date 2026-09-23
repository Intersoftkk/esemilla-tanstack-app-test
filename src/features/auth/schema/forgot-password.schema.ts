import { z } from 'zod'
import { emailField } from './sign-in.schema'

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>
