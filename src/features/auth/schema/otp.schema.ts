import { z } from 'zod'
import { emailField } from './sign-in.schema'

export const OTP_LENGTH = 6

export const otpSchema = z.object({
  email: emailField,
  otp: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code.`),
})

export type OtpInput = z.input<typeof otpSchema>
