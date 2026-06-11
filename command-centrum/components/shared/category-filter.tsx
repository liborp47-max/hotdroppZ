import Link from 'next/link'

export const SCOUT_CATEGORIES = [
  { value: 'droppz',     label: 'DROPPZ'     },
  { value: 'usa_rap',    label: 'USA RAP'    },
  { value: 'uk_rap',     label: 'UK RAP'     },
  { value: 'eu_rap',     label: 'EU RAP'     },
  { value: 'ru_rap',     label: 'RU RAP'     },
  { value: 'balkan_rap', label: 'BALKAN'     },
  { value: 'rnb',        label: 'R&B'        },
  { value: 'fashion',    label: 'Fashion'    },
  { value: 'culture',    label: 'Culture'    },
  { value: 'fun',        label: 'Fun'        },
  { value: 'news',       label: 'News'       },
] as const

interface CategoryFilterProps {
  activeCategory?: string
  basePath: string
  searchParams: Record<string, string>
}

function buildUrl(basePath: string, searchParams: Record<string, string>, category?: string): string {
  const params = new URLSearchParams(searchParams)
  params.delete('page')
  if (category) params.set('category', category)
  else params.delete('category')
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function CategoryFilter({ activeCategory, basePath, searchParams }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Link
        href={buildUrl(basePath, searchParams, undefined)}
        className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-colors ${
          !activeCategory
            ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
            : 'bg-white/[0.05] text-[#A8A8A8] hover:bg-white/[0.08] hover:text-[#E8E8E8]'
        }`}
      >
        All
      </Link>
      {SCOUT_CATEGORIES.map((cat) => (
        <Link
          key={cat.value}
          href={buildUrl(basePath, searchParams, cat.value)}
          className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-colors ${
            activeCategory === cat.value
              ? 'bg-orange-500 text-white'
              : 'bg-white/[0.05] text-[#A8A8A8] hover:bg-white/[0.08] hover:text-[#E8E8E8]'
          }`}
        >
          {cat.label}
        </Link>
      ))}
    </div>
  )
}
