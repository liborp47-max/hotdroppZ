'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, ChevronLeft, ShieldCheck, CheckCircle2, X, ArrowRight, AlertTriangle, Clock, Globe, Zap } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type FeedPost = {
  id: string
  story_id: string
  artist_name: string
  headline: string
  content: string
  platforms: string[]
  status: 'draft' | 'scheduled' | 'published'
  languages: string[]
  image_url?: string
  priority: number
  created_at: string
  source: 'writer' | 'creator'
}

type ChecklistItem = {
  id: string
  title: string
  description: string
  required: boolean
  checked: boolean
  category: 'content' | 'technical' | 'metadata'
}

export default function FeedApprovalPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const postId = searchParams.get('postId')

  const [post, setPost] = useState<FeedPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 'headline',
      title: 'Headline present',
      description: 'Post has a compelling headline',
      required: true,
      checked: false,
      category: 'content',
    },
    {
      id: 'content',
      title: 'Content complete',
      description: 'Body text is well-written and complete',
      required: true,
      checked: false,
      category: 'content',
    },
    {
      id: 'languages',
      title: 'All languages translated',
      description: 'All required language variants are present',
      required: true,
      checked: false,
      category: 'content',
    },
    {
      id: 'platforms',
      title: 'Platforms targeted',
      description: 'At least one platform is selected',
      required: true,
      checked: false,
      category: 'metadata',
    },
    {
      id: 'schedule',
      title: 'Schedule set',
      description: 'Publication dates and times configured',
      required: true,
      checked: false,
      category: 'technical',
    },
    {
      id: 'image',
      title: 'Image included',
      description: 'Post has cover image',
      required: false,
      checked: false,
      category: 'content',
    },
    {
      id: 'hashtags',
      title: 'Hashtags included',
      description: 'Relevant hashtags for platform',
      required: false,
      checked: false,
      category: 'metadata',
    },
    {
      id: 'links',
      title: 'Links verified',
      description: 'All external links work correctly',
      required: false,
      checked: false,
      category: 'technical',
    },
  ])

  const [isApproving, setIsApproving] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    if (!postId) {
      setError('No post ID provided')
      setIsLoading(false)
      return
    }

    const loadPost = async () => {
      try {
        const res = await fetch('/api/feed/posts')
        if (!res.ok) throw new Error('Failed to load posts')
        const data = await res.json()
        const found = data.posts?.find((p: FeedPost) => p.id === postId)
        if (!found) throw new Error('Post not found')

        setPost(found)

        // Auto-check based on post data
        setChecklist(prev => prev.map(item => {
          if (item.id === 'headline') return { ...item, checked: !!found.headline }
          if (item.id === 'content') return { ...item, checked: !!found.content }
          if (item.id === 'languages') return { ...item, checked: found.languages.length > 0 }
          if (item.id === 'platforms') return { ...item, checked: found.platforms.length > 0 }
          return item
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPost()
  }, [postId])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-[#A8A8A8]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading post for approval...
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error || 'Post not found'}</span>
        </div>
        <Link href="/feed/incoming" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ChevronLeft className="h-4 w-4" />
          Back to Incoming
        </Link>
      </div>
    )
  }

  const requiredChecks = checklist.filter(c => c.required)
  const allRequiredChecked = requiredChecks.every(c => c.checked)
  const totalChecked = checklist.filter(c => c.checked).length

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  const handleApprove = async () => {
    if (!allRequiredChecked) {
      setError('All required checks must be completed')
      return
    }

    setIsApproving(true)
    try {
      const res = await fetch(`/api/feed/${postId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          notes: `Approved with ${totalChecked}/${checklist.length} items verified`,
        }),
      })

      if (!res.ok) throw new Error('Failed to approve post')
      
      const data = await res.json()
      router.push(`/feed/published?postId=${postId}&approved=true`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve post')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required')
      return
    }

    setIsApproving(true)
    try {
      const res = await fetch(`/api/feed/${postId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reason: rejectionReason,
        }),
      })

      if (!res.ok) throw new Error('Failed to reject post')

      router.push(`/feed/incoming?rejected=true&reason=${encodeURIComponent(rejectionReason)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject post')
    } finally {
      setIsApproving(false)
      setShowRejectModal(false)
    }
  }

  const contentChecks = checklist.filter(c => c.category === 'content')
  const metadataChecks = checklist.filter(c => c.category === 'metadata')
  const technicalChecks = checklist.filter(c => c.category === 'technical')

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-4">
        <Link href="/feed/calendar" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ChevronLeft className="h-4 w-4" />
          Back to Calendar
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(0,224,133,0.15),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-[#00E085]" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1AEE99]">Step 05 / Approval</span>
              </div>
              <h1 className="text-2xl font-black text-[#E8E8E8]">Final quality check</h1>
              <p className="text-sm text-[#A8A8A8] mt-1">Review and approve before publication</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* Post summary */}
      <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
        <h3 className="text-sm font-bold text-[#E8E8E8] mb-4">Post Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wider mb-1">Headline</p>
              <p className="text-[#E8E8E8] font-medium">{post.headline}</p>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wider mb-1">Artist</p>
              <p className="text-[#E8E8E8] font-medium">{post.artist_name}</p>
            </div>
          </div>
          <div>
            <p className="text-[#A8A8A8] text-xs uppercase tracking-wider mb-1">Content</p>
            <p className="text-[#D0D0D0] line-clamp-3">{post.content}</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wider mb-1">Platforms</p>
              <div className="flex flex-wrap gap-1">
                {post.platforms.map(p => (
                  <span key={p} className="rounded px-2 py-1 text-xs bg-blue-500/20 text-blue-300">{p}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wider mb-1">Languages</p>
              <div className="flex flex-wrap gap-1">
                {post.languages.map(l => (
                  <span key={l} className="rounded px-2 py-1 text-xs bg-purple-500/20 text-purple-300">{l}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[#A8A8A8] text-xs uppercase tracking-wider mb-1">Status</p>
              <span className={cn(
                'rounded px-2 py-1 text-xs inline-block',
                post.status === 'draft' ? 'bg-white/[0.08] text-[#E8E8E8]' : 'bg-orange-500/20 text-orange-300'
              )}>
                {post.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist by category */}
      <div className="space-y-4">
        {/* Content checks */}
        {contentChecks.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5">
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
              Content Quality
            </h3>
            <div className="space-y-2">
              {contentChecks.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={cn(
                    'w-full border p-3 text-left transition-all',
                    item.checked
                      ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)]'
                      : 'border-white/15 bg-white/[0.03] hover:border-white/15'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'rounded-lg border-2 w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center',
                      item.checked
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md'
                    )}>
                      {item.checked && <CheckCircle2 className="h-3 w-3 text-[#00E085]" />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#E8E8E8] text-sm">{item.title}</p>
                      <p className="text-xs text-[#A8A8A8] mt-0.5">{item.description}</p>
                    </div>
                    {item.required && (
                      <span className="ml-auto text-xs font-semibold text-red-400">REQUIRED</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metadata checks */}
        {metadataChecks.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5">
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              Metadata & Targeting
            </h3>
            <div className="space-y-2">
              {metadataChecks.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={cn(
                    'w-full border p-3 text-left transition-all',
                    item.checked
                      ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)]'
                      : 'border-white/15 bg-white/[0.03] hover:border-white/15'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'rounded-lg border-2 w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center',
                      item.checked
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md'
                    )}>
                      {item.checked && <CheckCircle2 className="h-3 w-3 text-[#00E085]" />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#E8E8E8] text-sm">{item.title}</p>
                      <p className="text-xs text-[#A8A8A8] mt-0.5">{item.description}</p>
                    </div>
                    {item.required && (
                      <span className="ml-auto text-xs font-semibold text-red-400">REQUIRED</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Technical checks */}
        {technicalChecks.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5">
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              Technical & Links
            </h3>
            <div className="space-y-2">
              {technicalChecks.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={cn(
                    'w-full border p-3 text-left transition-all',
                    item.checked
                      ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)]'
                      : 'border-white/15 bg-white/[0.03] hover:border-white/15'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'rounded-lg border-2 w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center',
                      item.checked
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md'
                    )}>
                      {item.checked && <CheckCircle2 className="h-3 w-3 text-[#00E085]" />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#E8E8E8] text-sm">{item.title}</p>
                      <p className="text-xs text-[#A8A8A8] mt-0.5">{item.description}</p>
                    </div>
                    {item.required && (
                      <span className="ml-auto text-xs font-semibold text-red-400">REQUIRED</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-[0.12em] font-semibold text-[#6E6E6E]">Checklist Progress</span>
          <span className="text-sm font-bold text-[#E8E8E8]">{totalChecked}/{checklist.length}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className={cn(
              'h-full transition-all rounded-full',
              allRequiredChecked ? 'bg-green-500' : 'bg-orange-500'
            )}
            style={{ width: `${(totalChecked / checklist.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Rejection modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl border border-white/10 bg-black p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-[#E8E8E8] mb-2">Reject post</h3>
            <p className="text-sm text-[#A8A8A8] mb-4">Provide a reason for rejection. The post will return to the editor.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Image quality issues, unclear messaging, copyright concerns..."
              className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] placeholder:text-[#6E6E6E] mb-4"
              rows={4}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isApproving || !rejectionReason.trim()}
                className="flex-1 bg-red-500 text-white px-4 py-2 text-sm font-semibold hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Link
          href="/feed/calendar"
          className="rounded-lg border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
        >
          Back
        </Link>
        <button
          onClick={() => setShowRejectModal(true)}
          className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50 transition-colors"
        >
          <X className="h-4 w-4 inline mr-1" />
          Reject
        </button>
        <button
          onClick={async () => {
            const reason = typeof window !== 'undefined' ? window.prompt('Reason for requested changes:') : null
            if (!reason || !reason.trim()) return
            setIsApproving(true)
            try {
              const res = await fetch(`/api/feed/${postId}/action`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'request_changes', reason }),
              })
              if (!res.ok) throw new Error('Failed to request changes')
              router.push(`/feed/incoming?postId=${postId}&changesRequested=true`)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to request changes')
            } finally {
              setIsApproving(false)
            }
          }}
          disabled={isApproving}
          className="rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-900/50 transition-colors disabled:opacity-50"
        >
          Request changes
        </button>
        <button
          onClick={handleApprove}
          disabled={isApproving || !allRequiredChecked}
          className={cn(
            'ml-auto px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2',
            allRequiredChecked
              ? 'bg-green-500 text-white hover:bg-[#1AEE99]'
              : 'bg-white/[0.05] text-[#6E6E6E] cursor-not-allowed'
          )}
        >
          {isApproving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Approve & Publish
            </>
          )}
        </button>
      </div>
    </div>
  )
}
