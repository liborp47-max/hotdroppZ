import { BrainstormingEngine } from '@/components/ceo/brainstorming-engine'

export const metadata = {
  title: 'Brainstorming Engine | CEO',
  description: 'AI upgrade suggestions filtered by Primary Mission and current plan, fed into the backlog.',
}

export default function BrainstormingPage() {
  return <BrainstormingEngine />
}
