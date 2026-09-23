import { revalidateLogic, useForm } from '@tanstack/react-form'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useEffect, useState } from 'react'
import { FormAlert } from '#/components/form/form-alert'
import { SubmitButton } from '#/components/form/submit-button'
import { Button } from '#/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '#/components/ui/input-otp'
import { useResendOtpMutation, useSubmitOtpMutation } from '../queries/auth.mutations'
import { OTP_LENGTH, type OtpInput, otpSchema } from '../schema/otp.schema'
import { formatFieldError } from '../utils/auth'

const RESEND_COOLDOWN = 60

export interface OtpFormProps {
  email: string
  /** Error carried over from a failed reset (e.g. "invalid code"). */
  initialError?: string
  onVerified: () => void
}

export function OtpForm({ email, initialError, onVerified }: OtpFormProps) {
  const submitOtp = useSubmitOtpMutation()
  const resend = useResendOtpMutation()
  const [formError, setFormError] = useState<unknown>(initialError)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const form = useForm({
    defaultValues: { email, otp: '' } as OtpInput,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: otpSchema },
    onSubmit: async ({ value }) => {
      setFormError(undefined)
      try {
        await submitOtp.mutateAsync(value)
        onVerified()
      } catch (error) {
        setFormError(error)
      }
    },
  })

  const half = Math.ceil(OTP_LENGTH / 2)

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FormAlert
        error={formError ?? resend.error}
        success={resend.isSuccess ? 'A new code has been sent.' : undefined}
      />

      <form.Field name="otp">
        {(field) => {
          const error =
            field.form.state.submissionAttempts > 0
              ? formatFieldError(field.state.meta.errors)
              : undefined
          return (
            <div className="flex flex-col items-center gap-2">
              <InputOTP
                maxLength={OTP_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                autoFocus
                value={field.state.value}
                onChange={(v) => field.handleChange(v)}
                onComplete={() => void form.handleSubmit()}
                aria-invalid={error ? true : undefined}
                aria-label="One-time code"
              >
                <InputOTPGroup>
                  {Array.from({ length: half }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                    <InputOTPSlot key={i} index={i} aria-invalid={error ? true : undefined} />
                  ))}
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH - half }, (_, i) => (
                    <InputOTPSlot
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                      key={i}
                      index={half + i}
                      aria-invalid={error ? true : undefined}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          )
        }}
      </form.Field>

      <SubmitButton form={form} pending={submitOtp.isPending} pendingText="Verifying…">
        Continue
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        Didn&apos;t get a code?{' '}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled={cooldown > 0 || resend.isPending}
          onClick={() =>
            resend.mutate(email, {
              onSuccess: () => {
                setCooldown(RESEND_COOLDOWN)
                setFormError(undefined)
              },
            })
          }
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </Button>
      </p>
    </form>
  )
}
