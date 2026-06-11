import type { NextConfig } from 'next'

// Desktop (Electron) packaging emits a self-contained server. Gated by an env
// flag so the default web/Vercel build output is completely unchanged.
const isDesktopBuild = process.env.DESKTOP_BUILD === '1'

// Allow an extra Server Actions origin for desktop runs on a non-default port.
// Default web behaviour (localhost:3000 only) is preserved when unset.
const extraActionOrigin = process.env.DESKTOP_SERVER_ACTION_ORIGIN

const nextConfig: NextConfig = {
  ...(isDesktopBuild ? { output: 'standalone' as const } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', ...(extraActionOrigin ? [extraActionOrigin] : [])],
    },
  },
}

export default nextConfig
