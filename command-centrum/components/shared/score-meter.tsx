import { cn, scoreToBarColor, scoreToColor } from '@/lib/utils'

interface ScoreMeterProps {
  score: number | null | undefined
  showLabel?: boolean
  compact?: boolean
  className?: string
}

export function ScoreMeter({ score, showLabel = true, compact = false, className }: ScoreMeterProps) {
  const displayScore = score ?? 0
  const barColor = scoreToBarColor(score)
  const textColor = scoreToColor(score)

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${displayScore}%` }}
          />
        </div>
        {showLabel && (
          <span className={cn('text-xs font-mono font-medium tabular-nums w-7 text-right', textColor)}>
            {score ?? '—'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#A8A8A8]">Score</span>
          <span className={cn('text-sm font-mono font-semibold', textColor)}>
            {score !== null && score !== undefined ? score : '—'}
          </span>
        </div>
      )}
      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${displayScore}%` }}
        />
      </div>
    </div>
  )
}
