'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, ChevronLeft, Globe, Check, AlertTriangle, Copy, ArrowRight, CheckCircle2 } from 'lucide-react'
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

type LanguageVariant = {
  language: string
  headline: string
  content: string
  platformVariants: Record<string, { caption: string; hashtags: string }>
  isComplete: boolean
  isReviewed: boolean
}

export default function FeedMultilanguagePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const postId = searchParams.get('postId')

  const [post, setPost] = useState<FeedPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeLanguage, setActiveLanguage] = useState('en')
  const [editMode, setEditMode] = useState(false)

  // Language variants state
  const [variants, setVariants] = useState<Record<string, LanguageVariant>>({})
  const [autoTranslate, setAutoTranslate] = useState(false)

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
        
        // Initialize variants for all languages
        const initVariants: Record<string, LanguageVariant> = {}
        found.languages.forEach((lang: string) => {
          initVariants[lang] = {
            language: lang,
            headline: lang === 'en' ? found.headline : '',
            content: lang === 'en' ? found.content : '',
            platformVariants: {},
            isComplete: lang === 'en',
            isReviewed: lang === 'en',
          }
        })
        setVariants(initVariants)
        setActiveLanguage(found.languages[0] || 'en')
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
          Loading post for translation...
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

  const currentVariant = variants[activeLanguage]
  const completedLanguages = Object.values(variants).filter(v => v.isComplete).length
  const reviewedLanguages = Object.values(variants).filter(v => v.isReviewed).length
  const totalLanguages = Object.keys(variants).length

  const handleHeadlineChange = (value: string) => {
    setVariants({
      ...variants,
      [activeLanguage]: {
        ...currentVariant,
        headline: value,
      },
    })
  }

  const handleContentChange = (value: string) => {
    setVariants({
      ...variants,
      [activeLanguage]: {
        ...currentVariant,
        content: value,
        isComplete: value.length > 10,
      },
    })
  }

  const toggleReview = () => {
    setVariants({
      ...variants,
      [activeLanguage]: {
        ...currentVariant,
        isReviewed: !currentVariant.isReviewed,
      },
    })
  }

  // Real auto-translate — calls POST /api/feed/translate (multilangTranslateFull,
  // Groq with built-in fallback). Skips EN (source) and any already-reviewed
  // variants (human verdict wins). Translated content is never auto-marked
  // reviewed — that stays a human action.
  const handleAutoTranslate = async () => {
    const source = variants['en']
    if (!source?.headline?.trim() || !source?.content?.trim()) {
      setError('EN base headline and content must be filled before auto-translate')
      return
    }
    const targets = Object.keys(variants).filter(
      (lang) => lang !== 'en' && !variants[lang].isReviewed,
    )
    if (targets.length === 0) return

    setAutoTranslate(true)
    setError(null)
    try {
      const res = await fetch('/api/feed/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: source.headline,
          content: source.content,
          languages: targets,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Auto-translate failed')
      }
      const data = (await res.json()) as {
        variants?: Record<string, { headline?: string; content?: string }>
      }

      setVariants((prev) => {
        const next = { ...prev }
        for (const lang of targets) {
          const tr = data.variants?.[lang]
          if (!tr) continue
          const headline = tr.headline ?? prev[lang].headline
          const content = tr.content ?? prev[lang].content
          next[lang] = {
            ...prev[lang],
            headline,
            content,
            isComplete: Boolean(headline.trim() && content.trim()),
            isReviewed: false, // human review toggle stays a human action
          }
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-translate failed')
    } finally {
      setAutoTranslate(false)
    }
  }

  const handleContinue = async () => {
    const allComplete = Object.values(variants).every(v => v.isComplete)
    if (!allComplete) {
      setError('All languages must be completed before continuing')
      return
    }

    setIsSaving(true)
    try {
      const languageVariants = Object.entries(variants).map(([lang, variant]) => ({
        language: lang,
        headline: variant.headline,
        content: variant.content,
        isReviewed: variant.isReviewed,
      }))

      const res = await fetch(`/api/feed/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languages: Object.keys(variants),
          metadata: {
            languageVariants,
            multilanguageCompletedAt: new Date().toISOString(),
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to save translations')
      
      router.push(`/feed/calendar?postId=${postId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save translations')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-4">
        <Link href="/feed/incoming" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ChevronLeft className="h-4 w-4" />
          Back to Incoming
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-300">Step 03 / Multilanguage</span>
              </div>
              <h1 className="text-2xl font-black text-[#E8E8E8]">Translate & localize</h1>
              <p className="text-sm text-[#A8A8A8] mt-1">Create quality translations for all languages before approval</p>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors shrink-0',
                editMode
                  ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                  : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#D0D0D0] hover:bg-white/[0.05]'
              )}
            >
              {editMode ? 'Editing' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Completed</div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{completedLanguages}/{totalLanguages}</div>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Languages with content</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Reviewed</div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{reviewedLanguages}/{totalLanguages}</div>
          <p className="text-[11px] text-[#A8A8A8] mt-2">QA approved</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <button
            onClick={handleAutoTranslate}
            disabled={autoTranslate}
            className="w-full border border-purple-500/50 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoTranslate ? 'Translating...' : 'Auto-translate'}
          </button>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Fill empty languages</p>
        </div>
      </div>

      {/* Main editor */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Language tabs */}
        <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 h-fit lg:col-span-1">
          <h3 className="text-sm font-bold text-[#E8E8E8] mb-4">Languages</h3>
          <div className="space-y-2">
            {Object.entries(variants).map(([lang, variant]) => (
              <button
                key={lang}
                onClick={() => setActiveLanguage(lang)}
                className={cn(
                  'w-full border p-3 text-left transition-all text-sm',
                  activeLanguage === lang
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/15 bg-white/[0.03] hover:border-white/15'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold uppercase">{lang}</span>
                  <div className="flex items-center gap-1">
                    {variant.isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-[#00E085]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                    )}
                    {variant.isReviewed && (
                      <Check className="h-3 w-3 text-blue-400" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#A8A8A8] mt-1">
                  {variant.isComplete ? 'Complete' : 'Pending'} 
                  {variant.isReviewed ? ' • Reviewed' : ''}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Content editor */}
        {currentVariant && (
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#E8E8E8]">
                  Translate to {activeLanguage.toUpperCase()}
                </h3>
                {editMode && (
                  <button
                    onClick={toggleReview}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
                      currentVariant.isReviewed
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
                    )}
                  >
                    <Check className="h-3 w-3 inline mr-1" />
                    {currentVariant.isReviewed ? 'Reviewed' : 'Mark reviewed'}
                  </button>
                )}
              </div>

              {/* Headline */}
              <div className="space-y-2 mb-4">
                <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] flex items-center gap-2">
                  <span>Headline</span>
                  {currentVariant.headline && <Check className="h-3 w-3 text-[#00E085]" />}
                </label>
                <input
                  type="text"
                  value={currentVariant.headline}
                  onChange={(e) => handleHeadlineChange(e.target.value)}
                  disabled={!editMode}
                  placeholder={activeLanguage === 'en' ? 'Enter headline' : 'Translate headline from English'}
                  className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-[#6E6E6E]"
                />
                {activeLanguage !== 'en' && variants['en'] && (
                  <p className="text-xs text-[#A8A8A8] italic">EN: {variants['en'].headline}</p>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2 mb-4">
                <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] flex items-center gap-2">
                  <span>Content</span>
                  {currentVariant.content && <Check className="h-3 w-3 text-[#00E085]" />}
                </label>
                <textarea
                  value={currentVariant.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  disabled={!editMode}
                  placeholder={activeLanguage === 'en' ? 'Enter content' : 'Translate content from English'}
                  rows={8}
                  className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-[#6E6E6E]"
                />
                {activeLanguage !== 'en' && variants['en'] && (
                  <p className="text-xs text-[#A8A8A8] italic line-clamp-2">EN: {variants['en'].content}</p>
                )}
              </div>

              {/* Completeness check */}
              <div className={cn(
                'rounded-lg border p-3 text-xs',
                currentVariant.isComplete
                  ? 'border-[#00E085]/35 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                  : 'border-orange-500/30 bg-orange-500/10 text-orange-300'
              )}>
                {currentVariant.isComplete ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Content complete</p>
                      <p className="text-[10px] opacity-75">Ready for review and approval</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Missing content</p>
                      <p className="text-[10px] opacity-75">Fill in all fields before continuing</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Link
          href="/feed/incoming"
          className="rounded-lg border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
        >
          Back
        </Link>
        <button
          onClick={handleContinue}
          disabled={completedLanguages < totalLanguages}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2',
            completedLanguages === totalLanguages
              ? 'bg-purple-500 text-white hover:bg-purple-400'
              : 'bg-white/[0.05] text-[#6E6E6E] cursor-not-allowed'
          )}
        >
          Continue to Calendar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Completeness summary */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
        <div className="text-xs uppercase tracking-[0.12em] font-semibold text-[#6E6E6E] mb-3">Translation Status</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(variants).map(([lang, variant]) => (
            <div key={lang} className="rounded-lg border border-white/10 bg-white/[0.025] p-2 text-center text-xs">
              <div className="font-semibold text-[#E8E8E8] mb-1">{lang.toUpperCase()}</div>
              <div className="flex items-center justify-center gap-1 text-[10px]">
                {variant.isComplete ? (
                  <CheckCircle2 className="h-3 w-3 text-[#00E085]" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-orange-400" />
                )}
                <span className="text-[#A8A8A8]">{variant.isComplete ? 'Complete' : 'Pending'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
