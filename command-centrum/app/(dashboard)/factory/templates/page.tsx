import { TemplateManager } from '@/components/factory/template-manager'

export const metadata = {
  title: 'Template Manager',
  description: 'Customize content templates per category with grid-based area editor',
}

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-black">
      <TemplateManager />
    </main>
  )
}
