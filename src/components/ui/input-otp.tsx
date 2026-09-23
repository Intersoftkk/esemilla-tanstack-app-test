import { OTPInput, OTPInputContext } from 'input-otp'
import { MinusIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '#/lib/utils'

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        'flex items-center gap-2 has-disabled:opacity-50',
        containerClassName,
      )}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) {
  const context = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = context?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        'relative flex size-10 items-center justify-center border-y border-r border-input bg-input/20 text-sm font-medium transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md',
        'aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring/30',
        'data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      ) : null}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="input-otp-separator" aria-hidden="true" {...props}>
      <MinusIcon className="size-3.5 text-muted-foreground" />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
