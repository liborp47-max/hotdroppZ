import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-widest uppercase transition-all duration-150 ease-linear focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00E085] disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Primary CTA — subtle two-tone glow, mostly dark, green text
        default:
          'bg-[rgba(0,224,133,0.10)] backdrop-blur-md border border-[rgba(0,224,133,0.45)] text-[#00E085] shadow-[inset_0_1px_0_rgba(0,224,133,0.14),0_0_12px_rgba(0,224,133,0.18)] hover:bg-[rgba(0,224,133,0.18)] hover:border-[rgba(0,224,133,0.70)] hover:text-[#1AEE99] hover:shadow-[inset_0_1px_0_rgba(0,224,133,0.22),0_0_18px_rgba(0,224,133,0.30)] hover:-translate-y-px',
        destructive:
          'bg-white/[0.03] backdrop-blur-md border border-white/[0.12] text-[#A8A8A8] hover:border-[#FF5A5A]/60 hover:text-[#FF5A5A] hover:shadow-[0_0_10px_rgba(255,90,90,0.18)]',
        outline:
          'bg-white/[0.025] backdrop-blur-md border border-white/[0.12] text-[#A8A8A8] hover:border-[rgba(0,224,133,0.50)] hover:text-[#00E085] hover:shadow-[0_0_10px_rgba(0,224,133,0.18)]',
        secondary:
          'bg-white/[0.04] backdrop-blur-md border border-white/[0.10] text-[#E8E8E8] hover:border-white/[0.18] hover:bg-white/[0.07]',
        ghost:
          'bg-transparent text-[#A8A8A8] hover:bg-white/[0.04] hover:text-[#E8E8E8]',
        link:
          'text-[#00E085] underline-offset-4 hover:underline hover:[text-shadow:0_0_8px_rgba(0,224,133,0.45)]',
        approve:
          'bg-[rgba(0,224,133,0.12)] backdrop-blur-md border border-[rgba(0,224,133,0.50)] text-[#00E085] shadow-[inset_0_1px_0_rgba(0,224,133,0.14),0_0_12px_rgba(0,224,133,0.20)] hover:bg-[rgba(0,224,133,0.20)] hover:text-[#1AEE99] hover:shadow-[0_0_18px_rgba(0,224,133,0.32)]',
        reject:
          'bg-white/[0.03] backdrop-blur-md border border-white/[0.12] text-[#A8A8A8] hover:border-[#FF5A5A]/60 hover:text-[#FF5A5A] hover:shadow-[0_0_10px_rgba(255,90,90,0.18)]',
        hold:
          'bg-white/[0.03] backdrop-blur-md border border-white/[0.12] text-[#A8A8A8] hover:border-[#FFB84D]/60 hover:text-[#FFB84D] hover:shadow-[0_0_10px_rgba(255,184,77,0.18)]',
        publish:
          'bg-[rgba(0,224,133,0.08)] backdrop-blur-md border border-[rgba(0,224,133,0.40)] text-[#00E085] hover:bg-[rgba(0,224,133,0.16)] hover:shadow-[0_0_14px_rgba(0,224,133,0.30)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-10 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
