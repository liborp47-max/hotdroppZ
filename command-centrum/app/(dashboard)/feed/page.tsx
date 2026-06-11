import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Feed',
  description: 'Manage and publish feed posts',
}

import FeedClientNew from './feed-client-new'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  return <FeedClientNew />
}
