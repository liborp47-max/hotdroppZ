import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[60px] w-full border border-white/10 bg-white/[0.02] backdrop-blur-md backdrop-saturate-150 px-3 py-2 text-sm text-[#E8E8E8] transition-all duration-150 placeholder:text-[#404040] focus-visible:outline-none focus-visible:border-[rgba(0,224,133,0.50)] focus-visible:bg-black/40 focus-visible:shadow-[0_0_0_1px_rgba(0,224,133,0.40),0_0_8px_rgba(0,224,133,0.14)] disabled:cursor-not-allowed disabled:opacity-30 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
