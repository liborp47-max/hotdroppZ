'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, RefreshCw, ChevronLeft, Globe, Save, Eye, Edit2, ArrowRight, FileText, Zap } from 'lucide-react'
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

export default function FeedEditorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const postId = searchParams.get('postId')

  const [post, setPost] = useState<FeedPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [step, setStep] = useState<'editor' | 'calendar' | 'approval'>('editor')

  // Editable fields
  const [headline, setHeadline] = useState('')
  const [content, setContent] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

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
        setHeadline(found.headline)
        setContent(found.content)
        setSelectedLanguages(found.languages)
        setSelectedPlatforms(found.platforms)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPost()
  }, [postId])

  const handleSave = async () => {
    if (!post) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          content,
          languages: selectedLanguages,
          platforms: selectedPlatforms,
        }),
      })

      if (!res.ok) throw new Error('Failed to save post')

      const data = await res.json()
      setPost(data.post)
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMoveNext = async () => {
    if (step === 'editor') {
      // Save before moving to Multilanguage
      setIsSaving(true)
      try {
        const res = await fetch(`/api/feed/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline,
            content,
            languages: selectedLanguages,
            platforms: selectedPlatforms,
          }),
        })

        if (!res.ok) throw new Error('Failed to save post')
        // Move to Multilanguage
        router.push(`/feed/multilanguage?postId=${postId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save post')
      } finally {
        setIsSaving(false)
      }
    } else if (step === 'calendar') {
      setStep('approval')
    } else {
      // Done - redirect to approval
      router.push(`/feed/approval?postId=${postId}`)
    }
  }

  const allLanguages = ['en', 'cs', 'de', 'fr', 'es']
  const allPlatforms = ['blog', 'newsletter', 'instagram', 'tiktok', 'twitter', 'youtube']

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-[#A8A8A8]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading post...
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

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header with workflow steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/feed/incoming" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
            <ChevronLeft className="h-4 w-4" />
            Back to Incoming
          </Link>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn('rounded-full w-6 h-6 flex items-center justify-center font-semibold', step === 'editor' ? 'bg-blue-500 text-white' : step === 'calendar' || step === 'approval' ? 'bg-green-500/20 text-[#1AEE99] border border-[#00E085]/35' : 'bg-white/[0.05] text-[#A8A8A8]')}>
              1
            </span>
            <span className={cn('h-0.5 w-4 transition-colors', step === 'calendar' || step === 'approval' ? 'bg-green-500' : 'bg-white/[0.08]')} />
            <span className={cn('rounded-full w-6 h-6 flex items-center justify-center font-semibold', step === 'calendar' ? 'bg-blue-500 text-white' : step === 'approval' ? 'bg-green-500/20 text-[#1AEE99] border border-[#00E085]/35' : 'bg-white/[0.05] text-[#A8A8A8]')}>
              2
            </span>
            <span className={cn('h-0.5 w-4 transition-colors', step === 'approval' ? 'bg-green-500' : 'bg-white/[0.08]')} />
            <span className={cn('rounded-full w-6 h-6 flex items-center justify-center font-semibold', step === 'approval' ? 'bg-blue-500 text-white' : 'bg-white/[0.05] text-[#A8A8A8]')}>
              3
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {post.source === 'writer' ? (
                  <FileText className="h-4 w-4 text-[#00E085]" />
                ) : (
                  <Zap className="h-4 w-4 text-orange-400" />
                )}
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Step 02 / Editor</span>
              </div>
              <h1 className="text-2xl font-black text-[#E8E8E8]">{headline}</h1>
              <p className="text-sm text-[#A8A8A8] mt-1">{post.artist_name}</p>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                'flex items-center gap-2 border px-3 py-2 text-sm font-semibold transition-colors shrink-0',
                editMode
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#D0D0D0] hover:bg-white/[0.05]'
              )}
            >
              <Edit2 className="h-4 w-4" />
              {editMode ? 'Editing' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left - Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
            <h2 className="text-lg font-bold text-[#E8E8E8] mb-4">Content</h2>

            {/* Headline */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                disabled={!editMode}
                className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Content */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Content / Body</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!editMode}
                rows={10}
                className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Languages */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Languages</label>
              <div className="flex flex-wrap gap-2">
                {allLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      if (!editMode) return
                      setSelectedLanguages(selectedLanguages.includes(lang) 
                        ? selectedLanguages.filter(l => l !== lang)
                        : [...selectedLanguages, lang]
                      )
                    }}
                    disabled={!editMode}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
                      selectedLanguages.includes(lang)
                        ? 'border-lime-500 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8]'
                    )}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Platforms</label>
              <div className="grid grid-cols-2 gap-2">
                {allPlatforms.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => {
                      if (!editMode) return
                      setSelectedPlatforms(selectedPlatforms.includes(platform)
                        ? selectedPlatforms.filter(p => p !== platform)
                        : [...selectedPlatforms, platform]
                      )
                    }}
                    disabled={!editMode}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
                      selectedPlatforms.includes(platform)
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8]'
                    )}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            {/* Save button */}
            {editMode && (
              <button
                onClick={handleSave}
                className="w-full mt-6 border border-green-500/50 bg-[rgba(0,224,133,0.10)] px-4 py-2 text-sm font-semibold text-[#1AEE99] hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            )}
          </div>
        </div>

        {/* Right - Preview & Workflow */}
        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5">
            <h3 className="text-sm font-bold text-[#E8E8E8] mb-3">Preview</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-1">Headline</p>
                <p className="text-[#E8E8E8] font-semibold line-clamp-2">{headline}</p>
              </div>
              <div>
                <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-1">Content</p>
                <p className="text-[#D0D0D0] line-clamp-3">{content}</p>
              </div>
              <div>
                <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-1">Languages</p>
                <div className="flex flex-wrap gap-1">
                  {selectedLanguages.map(l => (
                    <span key={l} className="rounded bg-[rgba(0,224,133,0.10)] px-1.5 py-0.5 text-[#1AEE99]">{l}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[#6E6E6E] uppercase tracking-[0.12em] font-semibold mb-1">Platforms</p>
                <div className="flex flex-wrap gap-1">
                  {selectedPlatforms.map(p => (
                    <span key={p} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-300">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Workflow actions */}
          <button
            onClick={handleMoveNext}
            className="w-full bg-blue-500 text-white px-4 py-3 font-semibold text-sm hover:bg-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            Continue to Multilanguage
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
