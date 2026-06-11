import { FinalsPool } from '@/components/factory/finals-pool'

export const metadata = {
  title: 'Finals Pool',
  description: 'Final content staging area — approve and push to Feed',
}

export default function FinalsPage() {
  return (
    <main className="min-h-screen bg-black">
      <FinalsPool />
    </main>
  )
}
