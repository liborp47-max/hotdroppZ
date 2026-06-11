import { cn, categoryColor, categoryLabel } from '@/lib/utils'

interface CategoryTagProps {
  category: string | null | undefined
  className?: string
}

export function CategoryTag({ category, className }: CategoryTagProps) {
  if (!category) return null

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium',
        categoryColor(category),
        className
      )}
    >
      {categoryLabel(category)}
    </span>
  )
}
