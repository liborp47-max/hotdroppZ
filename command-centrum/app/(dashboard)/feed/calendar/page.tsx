'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, ChevronLeft, Calendar as CalendarIcon, Clock, Globe, ArrowRight, CheckCircle2, AlertTriangle, Copy, Zap } from 'lucide-react'
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

type PlatformSchedule = {
  platform: string
  date: string
  time: string
  timezone: string
  isScheduled: boolean
}

const TIMEZONES = [
  'UTC',
  'Europe/Prague',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'from-pink-600 to-orange-400',
  tiktok: 'from-black to-slate-700',
  youtube: 'from-red-600 to-red-500',
  twitter: 'from-blue-500 to-cyan-400',
  blog: 'from-blue-600 to-blue-400',
  newsletter: 'from-purple-600 to-pink-400',
  spotify: 'from-green-600 to-emerald-400',
}

export default function FeedCalendarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const postId = searchParams.get('postId')

  const [post, setPost] = useState<FeedPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [timezone, setTimezone] = useState('Europe/Prague')
  const [editMode, setEditMode] = useState(false)

  const [schedules, setSchedules] = useState<Record<string, PlatformSchedule>>({})
  const [autoSchedule, setAutoSchedule] = useState(false)

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

        // Initialize schedules for all platforms
        const initSchedules: Record<string, PlatformSchedule> = {}
        found.platforms.forEach((platform: string) => {
          initSchedules[platform] = {
            platform,
            date: new Date().toISOString().split('T')[0],
            time: '10:00',
            timezone,
            isScheduled: false,
          }
        })
        setSchedules(initSchedules)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setIsLoading(false)
      }
    }

    void loadPost()
  }, [postId, timezone])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-[#A8A8A8]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading post for scheduling...
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

  const scheduledCount = Object.values(schedules).filter(s => s.isScheduled).length
  const totalPlatforms = post.platforms.length

  const handleDateChange = (platform: string, date: string) => {
    setSchedules({
      ...schedules,
      [platform]: {
        ...schedules[platform],
        date,
      },
    })
  }

  const handleTimeChange = (platform: string, time: string) => {
    setSchedules({
      ...schedules,
      [platform]: {
        ...schedules[platform],
        time,
      },
    })
  }

  const toggleScheduled = (platform: string) => {
    setSchedules({
      ...schedules,
      [platform]: {
        ...schedules[platform],
        isScheduled: !schedules[platform].isScheduled,
      },
    })
  }

  const handleAutoSchedule = () => {
    setAutoSchedule(true)
    const baseDate = new Date()
    baseDate.setDate(baseDate.getDate() + 1)

    setTimeout(() => {
      const platformSchedules: Record<string, PlatformSchedule> = {}
      post.platforms.forEach((platform: string, idx: number) => {
        const scheduleDate = new Date(baseDate)
        scheduleDate.setDate(scheduleDate.getDate() + idx)

        platformSchedules[platform] = {
          platform,
          date: scheduleDate.toISOString().split('T')[0],
          time: ['instagram', 'tiktok'].includes(platform) ? '09:00' : '14:00',
          timezone,
          isScheduled: true,
        }
      })
      setSchedules(platformSchedules)
      setAutoSchedule(false)
    }, 800)
  }

  const handleContinue = async () => {
    const allScheduled = Object.values(schedules).every(s => s.isScheduled)
    if (!allScheduled) {
      setError('All platforms must be scheduled before continuing')
      return
    }

    setIsSaving(true)
    try {
      const scheduleData = Object.fromEntries(
        Object.entries(schedules).map(([platform, schedule]) => [
          platform,
          {
            date: schedule.date,
            time: schedule.time,
            timezone: schedule.timezone,
            scheduled_at: new Date().toISOString(),
          },
        ])
      )

      const res = await fetch(`/api/feed/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          schedule_data: scheduleData,
          metadata: {
            scheduledPlatforms: post!.platforms,
            timezone,
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to save schedule')

      router.push(`/feed/approval?postId=${postId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-4">
        <Link href="/feed/multilanguage" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ChevronLeft className="h-4 w-4" />
          Back to Multilanguage
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.15),_transparent_35%),linear-gradient(135deg,_rgba(9,9,11,1),_rgba(24,24,27,0.92))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">Step 04 / Calendar</span>
              </div>
              <h1 className="text-2xl font-black text-[#E8E8E8]">Schedule publication</h1>
              <p className="text-sm text-[#A8A8A8] mt-1">Set date & time for each platform with timezone support</p>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors shrink-0',
                editMode
                  ? 'border-orange-500 bg-orange-500/10 text-orange-300'
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
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Scheduled</div>
          <div className="mt-3 text-3xl font-black text-[#E8E8E8]">{scheduledCount}/{totalPlatforms}</div>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Platforms ready</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#A8A8A8]">Timezone</div>
          <div className="mt-3 text-lg font-black text-[#E8E8E8]">{timezone}</div>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Base timezone</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-4">
          <button
            onClick={handleAutoSchedule}
            disabled={autoSchedule}
            className="w-full border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoSchedule ? 'Scheduling...' : 'Auto-schedule'}
          </button>
          <p className="text-[11px] text-[#A8A8A8] mt-2">Spread across days</p>
        </div>
      </div>

      {/* Timezone selector */}
      <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold text-[#E8E8E8]">Timezone</h3>
        </div>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={!editMode}
          className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-3 py-2 text-sm text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Platform scheduling grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#E8E8E8] mb-3">Schedule per platform</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {post.platforms.map(platform => {
            const schedule = schedules[platform]
            if (!schedule) return null

            return (
              <div
                key={platform}
                className={cn(
                  'rounded-2xl border p-4 transition-all',
                  schedule.isScheduled
                    ? 'border-[#00E085]/35 bg-gradient-to-br from-green-500/5 to-transparent'
                    : 'border-white/10 bg-black/55 backdrop-blur-xl'
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className={cn(
                      'inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider',
                      PLATFORM_COLORS[platform]
                        ? `bg-gradient-to-r ${PLATFORM_COLORS[platform]} text-white`
                        : 'bg-white/[0.05] text-[#D0D0D0]'
                    )}>
                      {platform}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleScheduled(platform)}
                    disabled={!editMode}
                    className={cn(
                      'rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                      schedule.isScheduled
                        ? 'border-green-500 bg-[rgba(0,224,133,0.10)] text-[#1AEE99]'
                        : 'border-white/15 bg-white/[0.03] backdrop-blur-md text-[#A8A8A8] hover:border-white/15'
                    )}
                  >
                    {schedule.isScheduled ? '✓ Scheduled' : 'Schedule'}
                  </button>
                </div>

                {schedule.isScheduled && (
                  <div className="space-y-3">
                    {/* Date picker */}
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-[#A8A8A8] flex items-center gap-2 mb-1.5">
                        <CalendarIcon className="h-3 w-3" />
                        Date
                      </label>
                      <input
                        type="date"
                        value={schedule.date}
                        onChange={(e) => handleDateChange(platform, e.target.value)}
                        disabled={!editMode}
                        className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1.5 text-xs text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Time picker */}
                    <div>
                      <label className="text-xs uppercase tracking-[0.12em] text-[#A8A8A8] flex items-center gap-2 mb-1.5">
                        <Clock className="h-3 w-3" />
                        Time
                      </label>
                      <input
                        type="time"
                        value={schedule.time}
                        onChange={(e) => handleTimeChange(platform, e.target.value)}
                        disabled={!editMode}
                        className="w-full border border-white/15 bg-white/[0.03] backdrop-blur-md px-2.5 py-1.5 text-xs text-[#E8E8E8] disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Preview */}
                    <div className="rounded-lg border border-white/15 bg-white/[0.03] p-2 text-xs text-[#A8A8A8]">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle2 className="h-3 w-3 text-[#00E085]" />
                        <span>Scheduled for</span>
                      </div>
                      <p className="font-mono text-[#D0D0D0]">
                        {new Date(`${schedule.date}T${schedule.time}`).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} {timezone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Schedule summary */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-[#E8E8E8] mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Publication schedule
        </h3>
        <div className="space-y-2 text-sm">
          {post.platforms.map(platform => {
            const schedule = schedules[platform]
            if (!schedule?.isScheduled) return null
            return (
              <div key={platform} className="flex items-center justify-between border border-white/10 bg-white/[0.02] px-3 py-2">
                <span className="text-[#A8A8A8]">{platform}</span>
                <span className="font-mono text-[#D0D0D0]">
                  {new Date(`${schedule.date}T${schedule.time}`).toLocaleDateString()} at {schedule.time}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Link
          href="/feed/multilanguage"
          className="rounded-lg border border-white/15 bg-white/[0.03] backdrop-blur-md px-4 py-2 text-sm font-semibold text-[#D0D0D0] hover:bg-white/[0.05] transition-colors"
        >
          Back
        </Link>
        <button
          onClick={handleContinue}
          disabled={scheduledCount < totalPlatforms}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2',
            scheduledCount === totalPlatforms
              ? 'bg-orange-500 text-white hover:bg-orange-400'
              : 'bg-white/[0.05] text-[#6E6E6E] cursor-not-allowed'
          )}
        >
          Continue to Approval
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
