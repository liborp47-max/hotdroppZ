import { FactoryDashboard } from '@/components/factory/factory-dashboard'

export const metadata = {
  title: 'Factory Coordinator',
  description: 'Orchestrate Writer → Enrichment → Creator for high-end content',
}

export default function FactoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <FactoryDashboard />
    </div>
  )
}
