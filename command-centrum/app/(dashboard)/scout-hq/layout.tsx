import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'SCOUT HQ' }

export default async function ScoutHQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // SCOUT HQ main layout wrapper
  return (
    <div className="bg-black text-[#E8E8E8]">
      {children}
    </div>
  )
}
