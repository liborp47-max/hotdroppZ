import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

// Resolve paths
const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const WRITER_SCRIPT = path.join(AI_ROOT, 'scout_hq', 'run_writer_engine.py')
const STORY_RESULTS_FILE =
  process.env.STORY_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'story_results.json')
const WRITER_RESULTS_FILE =
  process.env.WRITER_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'writer_results.json')

function readResults() {
  if (!fs.existsSync(WRITER_RESULTS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(WRITER_RESULTS_FILE, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * GET /api/writer/articles
 * Read last writer engine results (generated articles)
 */
export async function GET() {
  const fileData = readResults()
  if (!fileData) {
    return NextResponse.json({
      status: 'empty',
      message: 'No articles generated yet. POST to run writer engine.',
      articles: [],
      total_articles: 0,
    })
  }

  return NextResponse.json(fileData)
}

/**
 * POST /api/writer/articles
 * Run Writer Engine to generate articles from stories
 *
 * Query params:
 * - story_ids: comma-separated story IDs to write from (optional, uses all)
 * - profile: journalistic|editorial|hype|technical|casual (default: journalistic)
 * - formats: comma-separated formats to generate (default: full_article,news_post,social_post)
 * - max_articles: max number of articles (default: 10)
 */
// AUD-SEC-002: allowlist user-controlled values that flow into the Python exec.
const ALLOWED_PROFILES = ['journalistic', 'editorial', 'hype', 'technical', 'casual']
const ALLOWED_FORMATS = ['full_article', 'news_post', 'social_post', 'thread']

export async function POST(req: Request) {
  const url = new URL(req.url)
  const storyIds = (url.searchParams.get('story_ids')?.split(',') || []).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s))
  const profile = url.searchParams.get('profile') || 'journalistic'
  const formats = (url.searchParams.get('formats')?.split(',') || ['full_article', 'news_post', 'social_post']).filter((f) => ALLOWED_FORMATS.includes(f))
  const maxArticles = Math.min(Math.max(Number(url.searchParams.get('max_articles')) || 10, 1), 100)

  if (!ALLOWED_PROFILES.includes(profile)) {
    return NextResponse.json({ error: `Invalid profile (allowed: ${ALLOWED_PROFILES.join(', ')})` }, { status: 400 })
  }
  if (formats.length === 0) {
    return NextResponse.json({ error: `Invalid formats (allowed: ${ALLOWED_FORMATS.join(', ')})` }, { status: 400 })
  }

  const python = process.env.PYTHON_PATH || 'python'

  try {
    const args = [
      WRITER_SCRIPT,
      '--input', STORY_RESULTS_FILE,
      '--profile', profile,
      '--formats', formats.join(','),
      '--max-articles', maxArticles.toString(),
      '--output', WRITER_RESULTS_FILE,
    ]

    if (storyIds.length > 0) {
      args.push('--story-ids', storyIds.join(','))
    }

    await execFileAsync(python, args, {
      cwd: AI_ROOT,
      timeout: 240_000, // 4 min for LLM calls
      env: { ...process.env, PYTHONPATH: AI_ROOT },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Writer engine pipeline failed'
    console.error('[writer] Python error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const data = readResults()
  if (!data) {
    return NextResponse.json(
      { error: 'Writer ran but results file not found' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
