import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonCard() {
  return (
    <div className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-16 w-16 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  )
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-[#1A1A1A]">
      <td className="px-3 py-2.5">
        <Skeleton className="h-4 w-4" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-10 w-10 rounded" />
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-5 w-16 rounded" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-5 w-12" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-5 w-16 rounded" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-3 w-24" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-16" />
        </div>
      </td>
    </tr>
  )
}
