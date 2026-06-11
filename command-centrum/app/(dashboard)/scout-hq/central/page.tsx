import { ScoutCentralClient } from '@/components/scout-hq/scout-central-client'

export const metadata = {
  title: 'Scout Central | Scout HQ',
  description: 'Expandable worker grid — quick control + open-worker drill.',
}

export default function ScoutCentralPage() {
  return <ScoutCentralClient />
}
