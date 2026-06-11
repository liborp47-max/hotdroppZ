import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const FACT_SCRIPT = path.join(AI_ROOT, 'scout_hq', 'run_creator_fact_builder.py')
const CREATOR_SCRIPT = path.join(AI_ROOT, 'scout_hq', 'run_creator_engine.py')
const STORY_RESULTS_FILE =
  process.env.STORY_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'story_results.json')
const CREATOR_FACTS_FILE =
  process.env.CREATOR_FACTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'creator_facts.json')
const CREATOR_QUEUE_FILE =
  process.env.CREATOR_QUEUE_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'creator_queue.json')

function readResults() {
  if (!fs.existsSync(CREATOR_QUEUE_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(CREATOR_QUEUE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export async function GET() {
  const data = readResults()
  if (!data) {
    return NextResponse.json({
      status: 'empty',
      message: 'No creator queue yet. POST to run creator engine.',
      posts: [],
      total_posts: 0,
    })
  }
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const assetFactId = url.searchParams.get('asset_fact_id')
  const assetQuoteId = url.searchParams.get('asset_quote_id')
  const assetPictureId = url.searchParams.get('asset_picture_id')
  const storyIds = url.searchParams.get('story_ids')?.split(',') || []
  const packageIds = url.searchParams.get('package_ids')?.split(',') || []
  const languages = url.searchParams.get('languages') || 'en,cs,de'
  const templates = url.searchParams.get('templates') || 'feed_card,story_card'
  const maxPosts = Number(url.searchParams.get('max_posts')) || 10
  const model = url.searchParams.get('model') || 'claude-3-5-sonnet-20241022'
  const logoPath = url.searchParams.get('logo_path') || '/icons/ICON.ico'
  const python = process.env.PYTHON_PATH || 'python'

  try {
    // Asset-based generation (shortcut for manual selection)
    if (assetFactId && assetQuoteId && assetPictureId) {
      // Create synthetic output directly from assets without running Python
      const now = new Date().toISOString()
      const mockQueuePost = {
        package_id: `asset-${assetFactId}`,
        story_id: 'manual-selection',
        artist_name: 'Artist',
        template: 'feed_card',
        platform: 'instagram',
        aspect_ratio: '1:1',
        source_image_url: null,
        image_prompt: 'High-quality promotional image of artist with professional lighting',
        overlay_lines: ['Did you know?', 'This is your fact'],
        caption_variants: [
          {
            language: 'en',
            headline: 'Artist Fact',
            overlay_kicker: 'Did you know',
            overlay_fact: 'Amazing artist fact',
            caption: 'Discover this amazing fact about the artist',
            cta: 'Share your thoughts',
            hashtags: ['#artist', '#music', '#fact'],
          },
          {
            language: 'cs',
            headline: 'Zajímavost umělce',
            overlay_kicker: 'Věděl jste',
            overlay_fact: 'Pozoruhodná zajímavost',
            caption: 'Objevte tuto zajímavost o umělci',
            cta: 'Podělte se o svůj názor',
            hashtags: ['#artist', '#hudba', '#zajimavost'],
          },
          {
            language: 'de',
            headline: 'Künstler Fakt',
            overlay_kicker: 'Wusstest du',
            overlay_fact: 'Beeindruckende Künstlerfakten',
            caption: 'Entdecken Sie diese Tatsache über den Künstler',
            cta: 'Teile deine Gedanken',
            hashtags: ['#artist', '#musik', '#fakt'],
          },
        ],
        watermark: {
          logo_path: logoPath,
          position: 'bottom-right',
          opacity: 0.24,
          scale: 0.18,
          blend_mode: 'screen',
        },
        publish_priority: 85,
        queue_status: 'ready',
        generated_at: now,
        metadata: {
          source: 'asset-builder',
          fact_id: assetFactId,
          quote_id: assetQuoteId,
          picture_id: assetPictureId,
        },
      }

      const queueData = {
        status: 'ok',
        posts: [mockQueuePost],
        total_posts: 1,
        message: 'Post generated from selected assets',
      }

      // Write to queue file
      fs.writeFileSync(CREATOR_QUEUE_FILE, JSON.stringify(queueData, null, 2))
      return NextResponse.json(queueData)
    }

    // Full pipeline generation (from stories)
    const factArgs = [
      FACT_SCRIPT,
      '--input', STORY_RESULTS_FILE,
      '--languages', languages,
      '--model', model,
      '--max-packages', maxPosts.toString(),
      '--output', CREATOR_FACTS_FILE,
    ]

    if (storyIds.length > 0) {
      factArgs.push('--story-ids', storyIds.join(','))
    }

    await execFileAsync(python, factArgs, {
      cwd: AI_ROOT,
      timeout: 300_000,
      env: { ...process.env, PYTHONPATH: AI_ROOT },
    })

    const creatorArgs = [
      CREATOR_SCRIPT,
      '--input', CREATOR_FACTS_FILE,
      '--languages', languages,
      '--templates', templates,
      '--model', model,
      '--max-posts', maxPosts.toString(),
      '--logo-path', logoPath,
      '--output', CREATOR_QUEUE_FILE,
    ]

    if (packageIds.length > 0) {
      creatorArgs.push('--package-ids', packageIds.join(','))
    }

    await execFileAsync(python, creatorArgs, {
      cwd: AI_ROOT,
      timeout: 300_000,
      env: { ...process.env, PYTHONPATH: AI_ROOT },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Creator engine pipeline failed'
    console.error('[creator] Python error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const data = readResults()
  if (!data) {
    return NextResponse.json({ error: 'Creator engine ran but queue results file not found' }, { status: 500 })
  }
  return NextResponse.json(data)
}
