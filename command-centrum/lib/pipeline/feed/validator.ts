/**
 * SM-3 — Card completeness validation gate.
 *
 * Mission spec: "Required fields filled? URLs accessible? Image aspect ratio?
 *                Block incomplete cards."
 *
 * Risk R4 (plan-manager triage): HTTP probe must NEVER hard-block —
 * third-party outage (Spotify, YT) would freeze the whole pipeline. Probe
 * failures map to `warn`, not `block`. Default `probeUrls=false`; opt-in.
 *
 * Status semantics:
 *   pass  — all required fields present, no warnings
 *   warn  — required ok, but some quality flag (missing subtitle, probe fail,
 *           unknown aspect ratio, etc.) — STILL publishable
 *   block — missing required field; the upstream pipeline must fix before publish
 *
 * Operates on feed_posts row + CardMetadata produced by metadata-enricher.ts.
 * Legacy validator (FeedContent-based, 2026-05-12) lives at legacy-validator.ts.
 */

import type {
  CardMetadata,
  FeedEnginePostRow,
  TemplateId,
  ValidationResult,
  ValidatorOptions,
} from './types.ts'

const DEFAULT_SHORT_SUMMARY_MAX = 50
const DEFAULT_PROBE_TIMEOUT_MS = 1500
const DEFAULT_ASPECT_RANGE: [number, number] = [0.5, 2.5]

// Well-known image host patterns whose aspect ratios we trust without probing.
const KNOWN_ASPECT_HOSTS: Array<{ pattern: RegExp; ratio: number; label: string }> = [
  { pattern: /^https?:\/\/i\.ytimg\.com\//i, ratio: 16 / 9, label: 'youtube_thumbnail' },
  { pattern: /^https?:\/\/i\.scdn\.co\//i, ratio: 1.0, label: 'spotify_image' },
  { pattern: /^https?:\/\/is\d?-ssl\.mzstatic\.com\//i, ratio: 1.0, label: 'apple_music_image' },
]

export interface ValidatorInput {
  post: Pick<
    FeedEnginePostRow,
    | 'id'
    | 'title'
    | 'spotify_url'
    | 'youtube_url'
    | 'genius_url'
    | 'image_url'
    | 'template_id'
  > & { apple_music_url?: string | null }
  metadata: CardMetadata | null
}

export async function validateCard(
  input: ValidatorInput,
  opts: ValidatorOptions = {},
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const post = input.post
  const meta = input.metadata ?? {}

  const maxShort = opts.shortSummaryMaxLength ?? DEFAULT_SHORT_SUMMARY_MAX

  // ─── Required field checks ───────────────────────────────────────────────
  if (!post.title || !post.title.trim()) errors.push('title is required')
  if (!post.template_id || !isKnownTemplate(post.template_id)) {
    errors.push(`template_id missing or unknown: ${post.template_id ?? 'null'}`)
  }
  if (!post.spotify_url && !post.youtube_url && !post.image_url && !post.apple_music_url) {
    errors.push('at least one media URL required (spotify/youtube/apple_music/image)')
  }

  // ─── Quality field checks ────────────────────────────────────────────────
  if (!meta.subtitle || !meta.subtitle.trim()) warnings.push('subtitle missing')
  if (!meta.category) warnings.push('category missing')
  if (!meta.artist) warnings.push('artist missing')
  if (!meta.shortSummary || !meta.shortSummary.trim()) {
    warnings.push('shortSummary missing')
  } else if (meta.shortSummary.length > maxShort) {
    errors.push(`shortSummary too long: ${meta.shortSummary.length} > ${maxShort}`)
  }

  // ─── Image aspect ratio (heuristic, never blocks) ────────────────────────
  if (post.image_url) {
    const aspect = inferAspectRatio(post.image_url)
    const [min, max] = opts.aspectRatioRange ?? DEFAULT_ASPECT_RANGE
    if (aspect === null) {
      warnings.push('image_url aspect ratio unknown (un-tested host)')
    } else if (aspect < min || aspect > max) {
      warnings.push(`image_url aspect ratio ${aspect.toFixed(2)} outside [${min}, ${max}]`)
    }
  }

  // ─── URL probe (opt-in, soft-fail per R4) ────────────────────────────────
  if (opts.probeUrls) {
    const urls = [post.spotify_url, post.youtube_url, post.image_url, post.genius_url].filter(
      (u): u is string => Boolean(u),
    )
    const probes = urls.map((u) => probeUrl(u, opts.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS))
    const results = await Promise.all(probes)
    for (const r of results) {
      if (!r.ok) warnings.push(`url probe failed (${r.status}): ${r.url}`)
    }
  }

  const status = errors.length > 0 ? 'block' : warnings.length > 0 ? 'warn' : 'pass'
  return { status, errors, warnings }
}

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function isKnownTemplate(value: string): value is TemplateId {
  return (
    value === 'MusicCard' || value === 'AlbumCard' || value === 'VideoCard' || value === 'FeatureCard'
  )
}

export function inferAspectRatio(imageUrl: string): number | null {
  for (const host of KNOWN_ASPECT_HOSTS) {
    if (host.pattern.test(imageUrl)) return host.ratio
  }
  return null
}

interface ProbeResult {
  url: string
  ok: boolean
  status: number | string
}

async function probeUrl(url: string, timeoutMs: number): Promise<ProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return { url, ok: res.ok, status: res.status }
  } catch (e) {
    const msg = e instanceof Error ? e.name : 'unknown'
    return { url, ok: false, status: msg }
  } finally {
    clearTimeout(timer)
  }
}
