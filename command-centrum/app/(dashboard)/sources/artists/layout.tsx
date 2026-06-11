import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AIL',
}

export default function AILLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}