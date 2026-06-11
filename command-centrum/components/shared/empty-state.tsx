import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 rounded-full bg-white/[0.05] p-4">
        <Icon className="h-8 w-8 text-[#A8A8A8]" />
      </div>
      <h3 className="mb-1 text-sm font-medium text-[#D0D0D0]">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-[#A8A8A8] max-w-xs">{description}</p>
      )}
      {action}
    </div>
  )
}
