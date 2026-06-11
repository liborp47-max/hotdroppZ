import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  basePath: string
  searchParams: Record<string, string>
}

function buildUrl(basePath: string, searchParams: Record<string, string>, targetPage: number): string {
  const params = new URLSearchParams(searchParams)
  if (targetPage <= 1) params.delete('page')
  else params.set('page', String(targetPage))
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function pageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: (number | '...')[] = [1]
  if (current > 3) result.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) result.push(i)
  if (current < total - 2) result.push('...')
  result.push(total)
  return result
}

export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages = pageRange(page, totalPages)

  return (
    <div className="flex items-center justify-center gap-1 py-6">
      <Link
        href={buildUrl(basePath, searchParams, page - 1)}
        aria-disabled={page <= 1}
        className={`p-1.5 text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/[0.05] transition-colors ${
          page <= 1 ? 'pointer-events-none opacity-30' : ''
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`el-${i}`} className="px-2 text-sm text-[#6E6E6E]">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildUrl(basePath, searchParams, p as number)}
            className={`min-w-8 h-8 flex items-center justify-center text-sm transition-colors ${
              p === page
                ? 'bg-white/[0.08] text-[#E8E8E8] font-medium'
                : 'text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/[0.05]'
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={buildUrl(basePath, searchParams, page + 1)}
        aria-disabled={page >= totalPages}
        className={`p-1.5 text-[#A8A8A8] hover:text-[#D0D0D0] hover:bg-white/[0.05] transition-colors ${
          page >= totalPages ? 'pointer-events-none opacity-30' : ''
        }`}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
