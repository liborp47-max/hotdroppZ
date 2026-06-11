import { notFound } from 'next/navigation'
import { PerWorkerPage } from '@/components/scout-hq/per-worker-page'
import { platformFromSlug, tokensFor } from '@/components/scout-hq/platform-tokens'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  const key = platformFromSlug(platform)
  if (!key) return { title: 'Worker not found | Scout HQ' }
  const tokens = tokensFor(key)
  return {
    title: `${tokens.label} Worker | Scout HQ`,
    description: `${tokens.label} platform worker — sources, schedule, limits, runs, settings.`,
  }
}

export default async function ScoutWorkerPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  const key = platformFromSlug(platform)
  if (!key) notFound()
  return <PerWorkerPage platform={key} />
}
