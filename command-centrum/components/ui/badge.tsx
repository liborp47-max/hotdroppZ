import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur-md transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default:    'border-[#00E085]/45 bg-[rgba(0,224,133,0.10)] text-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.18)]',
        secondary:  'border-white/10 bg-white/[0.04] text-[#A8A8A8]',
        destructive:'border-[#FF5A5A]/35 bg-[rgba(255,90,90,0.08)] text-[#FF5A5A]',
        outline:    'border-white/12 bg-transparent text-[#A8A8A8]',
        published:  'border-[#00E085]/35 bg-[rgba(0,224,133,0.08)] text-[#00E085]',
        approved:   'border-[#00E085]/45 bg-[rgba(0,224,133,0.12)] text-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.20)]',
        hold:       'border-[#FFB84D]/35 bg-[rgba(255,184,77,0.08)] text-[#FFB84D]',
        rejected:   'border-[#FF5A5A]/35 bg-[rgba(255,90,90,0.08)] text-[#FF5A5A]',
        draft:      'border-white/10 bg-white/[0.03] text-[#6E6E6E]',
        archived:   'border-white/8 bg-white/[0.02] text-[#404040]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
