'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Zap, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronRight, Copy, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type WrittenContent = {
  format: string
  title: string
  subtitle?: string
  body: string
  summary: string
  keywords: string[]
  estimated_read_time?: number
}

type WriterArticle = {
  story_package_id: string
  formats: WrittenContent[]
  writer_profile: string
  tone: string
  recommended_platform: string
  hashtags: string[]
  mentions: string[]
  predicted_engagement: number
  content_warnings: string[]
  fact_check_required: boolean
  generated_at: string
}

type WriterResult = {
  status: 'empty' | 'ok' | 'error'
  articles?: WriterArticle[]
  total_articles?: number
  message?: string
  error?: string
}

function normalizeContent(content: Partial<WrittenContent> | null | undefined): WrittenContent {
  return {
    format: content?.format || 'full_article',
    title: content?.title || 'Untitled content',
    subtitle: content?.subtitle,
    body: content?.body || '',
    summary: content?.summary || '',
    keywords: Array.isArray(content?.keywords) ? content.keywords : [],
    estimated_read_time: content?.estimated_read_time,
  }
}

function normalizeArticle(article: Partial<WriterArticle>): WriterArticle {
  return {
    story_package_id: article.story_package_id || crypto.randomUUID(),
    formats: Array.isArray(article.formats) ? article.formats.map((f) => normalizeContent(f)) : [],
    writer_profile: article.writer_profile || 'editorial',
    tone: article.tone || 'neutral',
    recommended_platform: article.recommended_platform || 'blog',
    hashtags: Array.isArray(article.hashtags) ? article.hashtags : [],
    mentions: Array.isArray(article.mentions) ? article.mentions : [],
    predicted_engagement: typeof article.predicted_engagement === 'number' ? article.predicted_engagement : 0,
    content_warnings: Array.isArray(article.content_warnings) ? article.content_warnings : [],
    fact_check_required: Boolean(article.fact_check_required),
    generated_at: article.generated_at || new Date().toISOString(),
  }
}

export default function WriterPage() {
  const [articles, setArticles] = useState<WriterArticle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadArticles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/writer/articles')
      const data: WriterResult = await res.json()

      if (data.status === 'error' || !data.articles) {
        setArticles([])
        return
      }

      const normalized = (data.articles || []).map((article) => normalizeArticle(article))
      setArticles(normalized)
      const initialFormats: Record<string, string> = {}
      normalized.forEach((article) => {
        if (article.formats.length > 0) {
          initialFormats[article.story_package_id] = article.formats[0].format
        }
      })
      setSelectedFormat(initialFormats)
    } catch (err) {
      setError('Failed to load articles')
      setArticles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runWriter = async () => {
    setIsRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/writer/articles?max_articles=10', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Writer failed')
      }
      const data: WriterResult = await res.json()
      const normalized = (data.articles || []).map((article) => normalizeArticle(article))
      setArticles(normalized)
      
      const initialFormats: Record<string, string> = {}
      normalized.forEach((article) => {
        if (article.formats.length > 0) {
          initialFormats[article.story_package_id] = article.formats[0].format
        }
      })
      setSelectedFormat(initialFormats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Writer run failed')
    } finally {
      setIsRunning(false)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert('Failed to copy')
    }
  }

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  const getFormatLabel = (format: string) => {
    const labels: Record<string, string> = {
      full_article: '📄 Full Article',
      news_post: '📰 News Post',
      social_post: '📱 Social',
      thread: '🧵 Thread',
      headline_only: '🎯 Headline',
    }
    return labels[format] || format
  }

  const getProfileColor = (profile: string) => {
    const colors: Record<string, string> = {
      journalistic: 'text-blue-400 bg-blue-400/10',
      editorial: 'text-purple-400 bg-purple-400/10',
      hype: 'text-pink-400 bg-pink-400/10',
      technical: 'text-cyan-400 bg-cyan-400/10',
      casual: 'text-amber-400 bg-amber-400/10',
    }
    return colors[profile] || 'text-[#A8A8A8] bg-white/[0.06]'
  }

  const getPlatformEmoji = (platform: string) => {
    const emojis: Record<string, string> = {
      twitter: '𝕏',
      instagram: '📷',
      tiktok: '🎵',
      blog: '📝',
      newsletter: '📬',
    }
    return emojis[platform] || '🌐'
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center w-8 h-8 bg-yellow-500/15">
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#E8E8E8]">Writer Engine</h1>
          </div>
          <p className="text-sm text-[#A8A8A8]">
            Generate publication-ready articles, posts, and threads from stories
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void loadArticles()}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-semibold border transition-colors',
              isLoading
                ? 'text-[#A8A8A8] border-white/10 bg-white/[0.025] cursor-not-allowed'
                : 'bg-white/[0.05] hover:bg-white/[0.05] text-[#D0D0D0] border-white/15'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Reload
          </button>
          <button
            onClick={() => void runWriter()}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-bold shadow-lg transition-colors',
              isRunning
                ? 'bg-white/[0.05] text-[#A8A8A8] shadow-none cursor-not-allowed'
                : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/25',
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                WRITING...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-current" />
                GENERATE ARTICLES
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Status */}
      <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#A8A8A8]">Articles Generated</span>
          <span className="text-lg font-bold text-[#E8E8E8]">{articles.length}</span>
        </div>
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {isLoading && !articles.length ? (
          <div className="flex items-center gap-2 py-8 justify-center text-[#6E6E6E]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading articles...
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-[#A8A8A8]">No articles generated yet</p>
            <p className="text-xs text-[#404040] mt-1">Run Writer Engine to generate publication-ready content</p>
          </div>
        ) : (
          articles.map((article) => {
            const currentFormat = selectedFormat[article.story_package_id] || article.formats[0]?.format
            const content = article.formats.find((f) => f.format === currentFormat) || article.formats[0] || normalizeContent(undefined)
            const isExpanded = expandedArticle === article.story_package_id

            return (
              <div
                key={article.story_package_id}
                className="rounded-lg border border-white/10 bg-white/[0.025] overflow-hidden"
              >
                {/* Article Header */}
                <button
                  onClick={() => setExpandedArticle(isExpanded ? null : article.story_package_id)}
                  className="w-full flex items-start justify-between gap-3 p-4 hover:bg-white/[0.05] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('px-2 py-0.5 text-xs font-semibold', getProfileColor(article.writer_profile))}>
                        {article.writer_profile.toUpperCase()}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-white/[0.05] text-[#A8A8A8]">
                        {getFormatLabel(currentFormat)}
                      </span>
                      <span className="text-xs">
                        {getPlatformEmoji(article.recommended_platform)} {article.recommended_platform}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[#E8E8E8] line-clamp-2">{content.title}</h3>
                    {content.subtitle && (
                      <p className="text-xs text-[#A8A8A8] mt-1 line-clamp-1">{content.subtitle}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-[#6E6E6E]">
                      <span>📊 Engagement: {article.predicted_engagement}%</span>
                      {content.estimated_read_time && <span>⏱️ {content.estimated_read_time}m read</span>}
                      <span>🏷️ {content.keywords.length} keywords</span>
                    </div>
                  </div>

                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-[#6E6E6E] shrink-0 mt-1" />
                    : <ChevronRight className="h-4 w-4 text-[#6E6E6E] shrink-0 mt-1" />
                  }
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-4 space-y-4 bg-black/40 backdrop-blur-md">
                    {/* Format Selector */}
                    {article.formats.length > 1 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">Formats</h4>
                        <div className="flex flex-wrap gap-2">
                          {article.formats.map((fmt) => (
                            <button
                              key={fmt.format}
                              onClick={() => setSelectedFormat((prev) => ({ ...prev, [article.story_package_id]: fmt.format }))}
                              className={cn(
                                'px-2 py-1 text-xs font-medium border transition-colors',
                                currentFormat === fmt.format
                                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                                  : 'bg-white/[0.04] border-white/15 text-[#A8A8A8] hover:text-[#D0D0D0]'
                              )}
                            >
                              {getFormatLabel(fmt.format)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Content Display */}
                    <div className="space-y-2 bg-white/[0.03] backdrop-blur-md p-3 border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-sm font-semibold text-[#E8E8E8]">{content.title}</h5>
                        <button
                          onClick={() => copyToClipboard(content.body || content.title, `content-${article.story_package_id}`)}
                          className={cn(
                            'px-2 py-1 text-xs transition-colors',
                            copiedId === `content-${article.story_package_id}`
                              ? 'bg-green-500/20 text-[#1AEE99]'
                              : 'bg-white/[0.05] text-[#A8A8A8] hover:text-[#E8E8E8]'
                          )}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {content.subtitle && (
                        <p className="text-xs text-[#A8A8A8] italic">{content.subtitle}</p>
                      )}
                      <p className="text-sm text-[#D0D0D0] whitespace-pre-wrap leading-relaxed">{content.body}</p>
                      <p className="text-xs text-[#6E6E6E] italic mt-2">Summary: {content.summary}</p>
                    </div>

                    {/* Hashtags & Mentions */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">Hashtags & Mentions</h4>
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-2">
                            {(article.hashtags || []).map((tag) => (
                            <span key={tag} className="bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(article.mentions || []).map((mention) => (
                            <span key={mention} className="bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs px-2 py-1 rounded">
                              {mention}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Keywords */}
                    {(content.keywords || []).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-[#A8A8A8] uppercase">SEO Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {(content.keywords || []).map((keyword) => (
                            <span key={keyword} className="bg-green-500/20 border border-green-500/40 text-[#1AEE99] text-xs px-2 py-1 rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {(article.content_warnings || []).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-amber-400 uppercase">⚠️ Content Warnings</h4>
                        <ul className="text-xs text-amber-300 space-y-1 pl-3">
                          {(article.content_warnings || []).map((warning, i) => (
                            <li key={i} className="list-disc">{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="border-t border-white/10 pt-2 text-xs text-[#6E6E6E]">
                      <p>
                        Tone: {article.tone} | Platform: {article.recommended_platform} | Generated:{' '}
                        {new Date(article.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
