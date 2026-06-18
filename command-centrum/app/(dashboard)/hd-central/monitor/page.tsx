import { LivePipelineMonitor } from '@/components/hdcc/live-pipeline-monitor'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Live Pipeline Monitor',
  description: 'Real-time per-stage pipeline status, queues, latency, and errors',
}

export default function PipelineMonitorPage() {
  return <LivePipelineMonitor />
}
