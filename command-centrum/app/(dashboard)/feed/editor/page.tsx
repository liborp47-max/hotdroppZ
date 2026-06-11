'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import {
  AlertCircle, Loader2, ChevronLeft, Save, Edit2,
  Bold, Italic, Heading2, List, Link2, Image as ImageIcon, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { markdownLiteToHtml, markdownToPlainText } from '@/lib/feed/markdown-lite'
import { MarkdownWysiwyg } from './markdown-wysiwyg'

type SeoMeta = { metaTitle?: string; metaDescription?: string; slug?: string }

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
  metadata?: { seo?: SeoMeta } & Record<string, unknown>
}

const SEO_DESC_IDEAL = 160

export default function FeedEditorPage() {
  const searchParams = useSearchParams()
  const postId = searchParams.get('postId')

  const [post, setPost] = useState<FeedPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Editable fields
  const [headline, setHeadline] = useState('')
  const [content, setContent] = useState('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [postStatus, setPostStatus] = useState<'draft' | 'scheduled' | 'published'>('draft')
  const [imageUrl, setImageUrl] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [slug, setSlug] = useState('')


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
        const found: FeedPost | undefined = data.posts?.find((p: FeedPost) => p.id === postId)
        if (!found) throw new Error('Post not found')
        setPost(found)
        setHeadline(found.headline)
        setContent(found.content)
        setSelectedLanguages(found.languages)
        setSelectedPlatforms(found.platforms)
        setPostStatus(found.status)
        setImageUrl(found.image_url ?? '')
        const seo = found.metadata?.seo ?? {}
        setMetaTitle(seo.metaTitle ?? '')
        setMetaDescription(seo.metaDescription ?? '')
        setSlug(seo.slug ?? '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPost()
  }, [postId])

  // Persist the edit to the feed post via the API.
  // Payload built by buildEditorSavePayload (lib/feed/editor-save.ts) — pure
  // function with regression test feed-editor-save.test.ts. UM-FEED_SCHEMA_AND_EDITOR_DONE sub-03.
  const handleSave = async () => {
    if (!post) return
    setIsSaving(true)
    setSaveMsg(null)
    try {
      const { buildEditorSavePayload } = await import('@/lib/feed/editor-save')
      const body = buildEditorSavePayload({
        headline,
        content,
        status: postStatus,
        platforms: selectedPlatforms,
        languages: selectedLanguages,
        imageUrl,
        metaTitle,
        metaDescription,
        slug,
      })
      const res = await fetch(`/api/feed/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Save failed')
      }
      setPost({
        ...post,
        headline,
        content,
        languages: selectedLanguages,
        platforms: selectedPlatforms,
        status: postStatus,
        image_url: imageUrl || undefined,
        metadata: { ...post.metadata, seo: { metaTitle, metaDescription, slug } },
      })
      setEditMode(false)
      setSaveMsg('Saved')
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

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
        <Link href="/feed" className="mt-4 inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300">
          <ChevronLeft className="h-4 w-4" />
          Back to Feed
        </Link>
      </div>
    )
  }

  const fieldCls =
    'w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed'
  const toolBtn =
    'flex items-center justify-center h-7 w-7 border border-white/15 bg-white/[0.03] text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/feed" className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300">
          <ChevronLeft className="h-4 w-4" />
          Back to Feed
        </Link>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className={cn(
              'flex items-center gap-1 text-xs',
              saveMsg === 'Saved' ? 'text-[#1AEE99]' : 'text-red-300',
            )}>
              {saveMsg === 'Saved' && <CheckCircle2 className="h-3.5 w-3.5" />}
              {saveMsg}
            </span>
          )}
          <button
            onClick={() => { setEditMode(!editMode); setSaveMsg(null) }}
            className={cn(
              'flex items-center gap-2 border px-3 py-2 text-sm font-semibold transition-colors',
              editMode
                ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#D0D0D0] hover:bg-white/[0.05]'
            )}
          >
            <Edit2 className="h-4 w-4" />
            {editMode ? 'Editing' : 'Edit'}
          </button>
          {editMode && (
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex items-center gap-2 border border-green-500/50 bg-[rgba(0,224,133,0.10)] px-3 py-2 text-sm font-semibold text-[#1AEE99] hover:bg-green-500/20 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Content Editor */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
            <h2 className="text-lg font-bold text-[#E8E8E8] mb-4">Post Content</h2>

            {/* Headline */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                disabled={!editMode}
                className={fieldCls}
              />
            </div>

            {/* Content — WYSIWYG rich-text surface (UM-FEED_RICH_EDITOR / SM1) */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Content</label>
              <MarkdownWysiwyg value={content} onChange={setContent} disabled={!editMode} />
            </div>

            {/* Image */}
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">
                <ImageIcon className="h-3 w-3" /> Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={!editMode}
                placeholder="https://..."
                className={fieldCls}
              />
            </div>

            {/* Status */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Status</label>
              <select
                value={postStatus}
                onChange={(e) => setPostStatus(e.target.value as FeedPost['status'])}
                disabled={!editMode}
                className={fieldCls}
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>

            {/* Languages */}
            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Languages</label>
              <div className="flex flex-wrap gap-2">
                {allLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { if (editMode) setSelectedLanguages(toggleIn(selectedLanguages, lang)) }}
                    disabled={!editMode}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
                      selectedLanguages.includes(lang)
                        ? 'border-lime-500 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
                    )}
                  >
                    {lang}
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
                    onClick={() => { if (editMode) setSelectedPlatforms(toggleIn(selectedPlatforms, platform)) }}
                    disabled={!editMode}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
                      selectedPlatforms.includes(platform)
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
                    )}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SEO meta */}
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6">
            <h2 className="text-lg font-bold text-[#E8E8E8] mb-4">SEO Meta</h2>

            <div className="space-y-2 mb-4">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                disabled={!editMode}
                placeholder={headline}
                className={fieldCls}
              />
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Meta Description</label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[10px] font-mono',
                    metaDescription.length > SEO_DESC_IDEAL ? 'text-red-300' : 'text-[#6E6E6E]',
                  )}>
                    {metaDescription.length}/{SEO_DESC_IDEAL}
                  </span>
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => setMetaDescription(markdownToPlainText(content, SEO_DESC_IDEAL))}
                      className="text-[10px] text-orange-400 hover:text-orange-300"
                    >
                      Auto from content
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                disabled={!editMode}
                rows={3}
                className={fieldCls}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8]">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
                disabled={!editMode}
                placeholder="post-url-slug"
                className={cn(fieldCls, 'font-mono')}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-6 h-fit sticky top-6">
          <h2 className="text-lg font-bold text-[#E8E8E8] mb-4">Live Preview</h2>

          <div className="space-y-4">
            <div className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{
              borderColor: post.source === 'writer' ? 'rgba(0, 224, 133, 0.5)' : 'rgba(249, 115, 22, 0.5)',
              backgroundColor: post.source === 'writer' ? 'rgba(0, 224, 133, 0.1)' : 'rgba(249, 115, 22, 0.1)',
              color: post.source === 'writer' ? '#86efac' : '#fed7aa',
            }}>
              From {post.source}
            </div>

            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={headline} className="w-full rounded-lg border border-white/10 object-cover max-h-48" />
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-1">Headline</p>
              <p className="text-lg font-bold text-[#E8E8E8] leading-tight">{headline}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-1">Content</p>
              <div
                className="feed-md space-y-2 text-sm leading-relaxed text-[#D0D0D0] [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-[#E8E8E8] [&_h3]:font-semibold [&_h3]:text-[#E8E8E8] [&_strong]:text-[#E8E8E8] [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-orange-400 [&_a]:underline"
                 
                dangerouslySetInnerHTML={{ __html: markdownLiteToHtml(content) }}
              />
            </div>

            {/* SEO snippet preview */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-2">Search Result Preview</p>
              <p className="text-sm text-blue-300 truncate">{metaTitle || headline}</p>
              <p className="text-[11px] text-[#1AEE99] truncate">hotdroppz.com/{slug || 'post'}</p>
              <p className="text-xs text-[#A8A8A8] line-clamp-2">
                {metaDescription || markdownToPlainText(content, SEO_DESC_IDEAL)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-2">Languages</p>
              <div className="flex flex-wrap gap-2">
                {selectedLanguages.map((lang) => (
                  <span key={lang} className="rounded-full bg-[rgba(0,224,133,0.10)] border border-lime-500/30 px-2 py-1 text-xs font-semibold text-[#1AEE99]">
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-2">Platforms</p>
              <div className="flex flex-wrap gap-2">
                {selectedPlatforms.map((platform) => (
                  <span key={platform} className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-1 text-xs font-semibold text-blue-300">
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A8A8A8] mb-2">Status</p>
              <span className={cn(
                'inline-block rounded-full border px-3 py-1 text-xs font-semibold',
                postStatus === 'draft' ? 'bg-white/[0.12] border-white/15 text-[#D0D0D0]' :
                postStatus === 'scheduled' ? 'bg-blue-500/10 border-blue-700 text-blue-300' :
                'bg-[rgba(0,224,133,0.10)] border-green-700 text-[#1AEE99]'
              )}>
                {postStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
