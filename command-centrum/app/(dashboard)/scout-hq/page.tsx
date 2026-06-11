import { ScoutHqClient } from '@/components/scout-hq/scout-hq-client'

export const metadata = {
  title: 'Scout HQ | HotDroppZ',
  description: 'Per-platform worker control room — Spotify, Apple Music, YouTube, YouTube Music, RSS, Charts, Genius.',
}

export default function ScoutHqPage() {
  return <ScoutHqClient />
}
