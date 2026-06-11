import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'HDCC — HotDroppZ Control Centrum',
    template: '%s | HDCC',
  },
  description: 'Internal content operations dashboard for HotDroppZ',
  robots: { index: false, follow: false },
  icons: {
    icon: '/icons/ICON.ico',
    shortcut: '/icons/ICON.ico',
    apple: '/icons/ICON.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-[#E8E8E8] antialiased">{children}</body>
    </html>
  )
}
