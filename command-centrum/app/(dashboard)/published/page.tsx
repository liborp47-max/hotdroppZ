import { createClient } from '@/lib/supabase/server'
import { BookOpen, ExternalLink } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { CategoryTag } from '@/components/shared/category-tag'
import { ScoreMeter } from '@/components/shared/score-meter'
import { dateRangeToISO } from '@/lib/utils/filter'

export const dynamic = 'force-dynamic'

export default async function PublishedPage({
  searchParams,
}: {
  searchParams: Promise<{ dr?: string; cat?: string; q?: string }>
}) {
  const params   = await searchParams
  const supabase = await createClient()

  const category = params.cat || ''
  const dateFrom = dateRangeToISO(params.dr ?? 'all')
  const search   = params.q  || ''

  let query = supabase
    .from('posts')
    .select('id, title, short_text, category, ai_score, tags, source_name, source_url, image_url, created_at', { count: 'exact' })
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(100)

  if (category) query = query.eq('category', category)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (search)   query = query.ilike('title', `%${search}%`)

  const { data: posts, count } = await query

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
           <BookOpen className="h-4 w-4 text-venom-400" />
          <h1 className="text-base font-semibold text-[#E8E8E8]">Published</h1>
        </div>
        <span className="text-xs text-[#A8A8A8] tabular-nums">{count ?? 0} total</span>
      </div>

      {(posts ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-8 w-8 text-[#404040] mb-3" />
          <p className="text-sm font-medium text-[#A8A8A8]">Nothing published yet</p>
          <p className="text-xs text-[#404040] mt-1">Publish approved posts from Final Editor</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider w-8" />
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider">Title</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider w-28">Category</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider w-24">Score</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#A8A8A8] uppercase tracking-wider w-28">Published</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {(posts ?? []).map((post) => (
                <tr key={post.id} className="border-b border-white/[0.06] hover:bg-white/[0.025] transition-colors">
                  <td className="px-4 py-2.5">
                    {post.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.image_url} alt="" className="w-8 h-8 object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-white/[0.05]" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 min-w-0">
                    <p className="font-medium text-[#E8E8E8] leading-snug line-clamp-1">{post.title}</p>
                    {post.source_name && (
                      <p className="text-[11px] text-[#6E6E6E] mt-0.5">{post.source_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <CategoryTag category={post.category} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-20">
                      <ScoreMeter score={post.ai_score} compact />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-[#A8A8A8] tabular-nums">{formatDateShort(post.created_at)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {post.source_url && (
                      <a
                        href={post.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                         className="text-[#6E6E6E] hover:text-venom-400 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
