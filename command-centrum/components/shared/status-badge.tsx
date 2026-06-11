import { Badge } from '@/components/ui/badge'
import { statusColor } from '@/lib/utils'
import type { PostStatus } from '@/lib/types'

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  rejected: 'Rejected',
  hold: 'On Hold',
  published: 'Published',
  archived: 'Archived',
}

interface StatusBadgeProps {
  status: PostStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variantMap: Record<PostStatus, 'published' | 'approved' | 'hold' | 'rejected' | 'draft' | 'archived'> = {
    published: 'published',
    approved: 'approved',
    hold: 'hold',
    rejected: 'rejected',
    draft: 'draft',
    archived: 'archived',
  }

  return (
    <Badge variant={variantMap[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
