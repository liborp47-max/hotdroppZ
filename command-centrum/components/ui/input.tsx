import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md backdrop-saturate-150 px-3 py-1 text-sm text-[#E8E8E8] transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#404040] focus-visible:outline-none focus-visible:border-[rgba(0,224,133,0.50)] focus-visible:bg-black/40 focus-visible:shadow-[0_0_0_1px_rgba(0,224,133,0.40),0_0_8px_rgba(0,224,133,0.14)] disabled:cursor-not-allowed disabled:opacity-30',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
