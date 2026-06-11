'use client'

import { CheckCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BulkActionBarProps {
  count: number
  onApprove: () => void
  onReject: () => void
  onHold: () => void
  onPublish?: () => void
  onClear: () => void
  loading?: boolean
  className?: string
}

export function BulkActionBar({
  count,
  onApprove,
  onReject,
  onHold,
  onPublish,
  onClear,
  loading = false,
  className,
}: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'border border-white/15 bg-white/[0.03] backdrop-blur-md backdrop-blur-sm shadow-2xl shadow-black/50',
        className
      )}
    >
      <div className="flex items-center gap-2 pr-3 border-r border-white/15">
        <CheckCheck className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium text-[#E8E8E8]">
          {count} selected
        </span>
      </div>

      <Button
        variant="approve"
        size="sm"
        onClick={onApprove}
        disabled={loading}
      >
        Approve
      </Button>
      <Button
        variant="hold"
        size="sm"
        onClick={onHold}
        disabled={loading}
      >
        Hold
      </Button>
      <Button
        variant="reject"
        size="sm"
        onClick={onReject}
        disabled={loading}
      >
        Reject
      </Button>
      {onPublish && (
        <Button
          variant="publish"
          size="sm"
          onClick={onPublish}
          disabled={loading}
        >
          Publish
        </Button>
      )}

      <button
        onClick={onClear}
        className="ml-1 p-1 text-[#A8A8A8] hover:text-[#D0D0D0] transition-colors"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
