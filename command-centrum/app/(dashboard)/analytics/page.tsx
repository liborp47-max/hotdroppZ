import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { BarChart2, Eye, MousePointerClick, Share2, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { PostAnalytics } from '@/lib/types'

export const metadata: Metadata = { title: 'Analytics' }
export const dynamic = 'force-dynamic'

interface PostWithAnalytics {
  id: string
  title: string
  category: string | null
  published_at: string | null
  status: string
  analytics: PostAnalytics[]
}

function MetricCard({
  label, value, icon: Icon, color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#A8A8A8] uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#E8E8E8]">{value}</p>
    </div>
  )
}

function CategoryBar({ category, value, max }: { category: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#A8A8A8] w-32 truncate flex-shrink-0">{category}</span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-venom-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-[#A8A8A8] w-12 text-right flex-shrink-0">
        {value.toLocaleString()}
      </span>
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const [
    { data: posts },
    { data: analyticsRows },
  ] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, category, published_at, status')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(100),
    supabase
      .from('post_analytics')
      .select('*')
      .order('recorded_at', { ascending: false }),
  ])

  // Build per-post aggregate
  const analyticsMap = new Map<string, { views: number; clicks: number; shares: number; engagement_rate: number }>()
  for (const row of (analyticsRows ?? [])) {
    const existing = analyticsMap.get(row.post_id)
    if (existing) {
      existing.views += row.views
      existing.clicks += row.clicks
      existing.shares += row.shares
      existing.engagement_rate = Math.max(existing.engagement_rate, row.engagement_rate)
    } else {
      analyticsMap.set(row.post_id, {
        views: row.views,
        clicks: row.clicks,
        shares: row.shares,
        engagement_rate: row.engagement_rate,
      })
    }
  }

  const postsWithAnalytics: (typeof posts extends (infer T)[] | null ? T : never)[] & { _views?: number } = []
  const enriched = (posts ?? []).map((post) => ({
    ...post,
    _analytics: analyticsMap.get(post.id) ?? { views: 0, clicks: 0, shares: 0, engagement_rate: 0 },
  }))

  const totalViews = enriched.reduce((s, p) => s + p._analytics.views, 0)
  const totalClicks = enriched.reduce((s, p) => s + p._analytics.clicks, 0)
  const totalShares = enriched.reduce((s, p) => s + p._analytics.shares, 0)
  const avgEngagement = enriched.length > 0
    ? (enriched.reduce((s, p) => s + p._analytics.engagement_rate, 0) / enriched.length).toFixed(1)
    : '0.0'

  // Category breakdown
  const categoryViews = new Map<string, number>()
  for (const post of enriched) {
    const cat = post.category ?? 'Uncategorized'
    categoryViews.set(cat, (categoryViews.get(cat) ?? 0) + post._analytics.views)
  }
  const categoryBreakdown = Array.from(categoryViews.entries())
    .sort((a, b) => b[1] - a[1])
  const maxCatViews = categoryBreakdown[0]?.[1] ?? 0

  const sorted = enriched.sort((a, b) => b._analytics.views - a._analytics.views)

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#E8E8E8] flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-venom-500" />
          Analytics
        </h1>
        <p className="text-sm text-[#A8A8A8] mt-1">
          Performance of {(posts ?? []).length} published post{(posts ?? []).length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Views"
          value={totalViews.toLocaleString()}
          icon={Eye}
          color="bg-blue-500/15 text-blue-400"
        />
        <MetricCard
          label="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={MousePointerClick}
          color="bg-venom-500/15 text-venom-400"
        />
        <MetricCard
          label="Total Shares"
          value={totalShares.toLocaleString()}
          icon={Share2}
          color="bg-green-500/15 text-[#00E085]"
        />
        <MetricCard
          label="Avg Engagement"
          value={`${avgEngagement}%`}
          icon={TrendingUp}
          color="bg-purple-500/15 text-purple-400"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Category breakdown */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 col-span-1">
          <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider mb-4">
            Views by Category
          </h2>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-[#6E6E6E] text-center py-6">No data yet</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map(([cat, views]) => (
                <CategoryBar key={cat} category={cat} value={views} max={maxCatViews} />
              ))}
            </div>
          )}
        </div>

        {/* Top posts table */}
        <div className="rounded-xl border border-white/10 overflow-hidden col-span-2">
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.03] backdrop-blur-md">
            <h2 className="text-xs font-semibold text-[#A8A8A8] uppercase tracking-wider">
              Top Posts by Views
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Post</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Views</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Clicks</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Shares</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#A8A8A8]">Eng%</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#A8A8A8]">Published</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 25).map((post, i) => (
                <tr key={post.id} className="border-b border-white/10 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#6E6E6E] w-5 text-right flex-shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs text-[#E8E8E8] line-clamp-1">{post.title}</p>
                        {post.category && (
                          <span className="text-[10px] text-[#A8A8A8]">{post.category}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#D0D0D0]">
                    {post._analytics.views.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#A8A8A8]">
                    {post._analytics.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#A8A8A8]">
                    {post._analytics.shares.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[#A8A8A8]">
                    {post._analytics.engagement_rate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A8A8A8]">
                    {post.published_at ? formatDate(post.published_at) : '—'}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#6E6E6E] text-sm">
                    No published posts with analytics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
