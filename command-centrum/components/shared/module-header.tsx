import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfigItem {
  label: string
  value: string | number
  mono?: boolean
}

interface ModuleHeaderProps {
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  title: string
  subtitle: string
  description: string
  config?: ConfigItem[]
  children?: React.ReactNode
}

export function ModuleHeader({
  icon: Icon,
  iconColor = 'text-venom-400',
  iconBg = 'bg-venom-500/10 border-venom-500/20',
  title,
  subtitle,
  description,
  config,
  children,
}: ModuleHeaderProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={cn('p-2 border shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-[#E8E8E8]">{title}</h2>
            <span className="text-[10px] text-[#6E6E6E] font-mono uppercase tracking-wider">{subtitle}</span>
          </div>
          <p className="text-xs text-[#A8A8A8] mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {config && config.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06]">
          {config.map(({ label, value, mono }) => (
            <div key={label}>
              <p className="text-[10px] text-[#6E6E6E] uppercase tracking-wider mb-0.5">{label}</p>
              <p className={cn('text-sm font-semibold text-[#D0D0D0]', mono && 'font-mono text-xs')}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {children && (
        <div className="pt-2 border-t border-white/[0.06]">
          {children}
        </div>
      )}
    </div>
  )
}
