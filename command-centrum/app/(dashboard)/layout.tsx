import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { PipelineProvider } from '@/components/layout/pipeline-context'
import { TestModeProvider } from '@/components/layout/test-mode-context'
import { FilterProvider } from '@/components/layout/filter-context'
import { GlobalFilterBar } from '@/components/shared/global-filter-bar'
import { GlobalPipelineRail } from '@/components/layout/global-pipeline-rail'
import { ImprovementTrigger } from '@/components/improvement-system/improvement-trigger'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  const isAuthenticated = !error && !!user
  let pendingCount = 0

  // Fetch pending draft count only when user session is available.
  if (isAuthenticated) {
    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')

    pendingCount = count ?? 0
  }

  return (
    <TestModeProvider>
      <PipelineProvider>
        <Suspense fallback={null}>
          <FilterProvider>
            <div className="flex h-screen bg-black overflow-hidden">
              <Sidebar />
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header userEmail={user?.email ?? 'guest@local'} pendingCount={pendingCount} />
                <GlobalFilterBar />
                <div className="flex flex-1 min-h-0">
                  <main className="relative flex-1 overflow-y-auto bg-transparent">
                    <ImprovementTrigger />
                    {children}
                  </main>
                  <GlobalPipelineRail />
                </div>
              </div>
            </div>
          </FilterProvider>
        </Suspense>
      </PipelineProvider>
    </TestModeProvider>
  )
}
