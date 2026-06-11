import { ExternalLink } from 'lucide-react'
import { StatusBadge } from './status-badge'
import { CategoryTag } from './category-tag'
import { ScoreMeter } from './score-meter'
import { truncate, timeAgo } from '@/lib/utils'
import type { Post } from '@/lib/types'

interface PostCardProps {
  post: Post
  actions?: React.ReactNode
}

export function PostCard({ post, actions }: PostCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-md p-4 hover:border-white/15 transition-colors">
      <div className="flex items-start gap-3">
        {post.image_url && (
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden bg-white/[0.05]">
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-medium text-[#E8E8E8] leading-snug">
              {truncate(post.title, 80)}
            </h3>
            <StatusBadge status={post.status} className="flex-shrink-0" />
          </div>
          <div className="flex items-center gap-2 text-xs text-[#A8A8A8] mb-2">
            {post.source_name && <span>{post.source_name}</span>}
            {post.source_url && (
              <a
                href={post.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#D0D0D0] transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>
          {post.summary && (
            <p className="text-xs text-[#A8A8A8] mb-2 line-clamp-2">{post.summary}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {post.category && <CategoryTag category={post.category} />}
            {post.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-[#A8A8A8]">#{tag}</span>
            ))}
          </div>
        </div>
      </div>
      {post.ai_score !== null && (
        <div className="mt-3">
          <ScoreMeter score={post.ai_score} compact />
        </div>
      )}
      {actions && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
