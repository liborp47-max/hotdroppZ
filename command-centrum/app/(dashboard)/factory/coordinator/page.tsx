import { CoordinatorDashboard } from '@/components/factory/coordinator-dashboard'

export const metadata = {
  title: 'Factory Coordinator',
  description: 'Critical pipeline orchestrator — classify, template, execute all factory workers',
}

export default function CoordinatorPage() {
  return (
    <main className="min-h-screen bg-black">
      <CoordinatorDashboard />
    </main>
  )
}
