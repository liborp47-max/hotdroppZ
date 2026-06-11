import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

// Resolve paths
const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const STORY_SCRIPT = path.join(AI_ROOT, 'scout_hq', 'run_story_builder.py')
const CLUSTER_RESULTS_FILE =
  process.env.CLUSTER_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'cluster_results.json')
const STORY_RESULTS_FILE =
  process.env.STORY_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'story_results.json')

function readResults() {
  if (!fs.existsSync(STORY_RESULTS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(STORY_RESULTS_FILE, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * GET /api/story-builder/stories
 * Read last story builder results (stories built from clusters)
 */
export async function GET() {
  const fileData = readResults()
  if (!fileData) {
    return NextResponse.json({
      status: 'empty',
      message: 'No stories yet. POST to run story builder.',
      stories: [],
      total_stories: 0,
    })
  }

  return NextResponse.json(fileData)
}

/**
 * POST /api/story-builder/stories
 * Run Story Builder on latest clusters to generate story packages
 *
 * Query params:
 * - cluster_ids: comma-separated cluster IDs to build stories from (optional, uses all)
 * - max_stories: max number of stories to generate (default: 10)
 * - model: LLM model to use (default: gpt-4-1.5)
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const clusterIds = url.searchParams.get('cluster_ids')?.split(',') || []
  const maxStories = Number(url.searchParams.get('max_stories')) || 10
  const model = url.searchParams.get('model') || 'claude-3-5-sonnet-20241022'

  const python = process.env.PYTHON_PATH || 'python'

  try {
    const args = [
      STORY_SCRIPT,
      '--input', CLUSTER_RESULTS_FILE,
      '--model', model,
      '--max-stories', maxStories.toString(),
      '--output', STORY_RESULTS_FILE,
    ]

    if (clusterIds.length > 0) {
      args.push('--cluster-ids', clusterIds.join(','))
    }

    await execFileAsync(python, args, {
      cwd: AI_ROOT,
      timeout: 300_000, // 5 min for LLM calls (clusters can have many relationships)
      env: { ...process.env, PYTHONPATH: AI_ROOT },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Story builder pipeline failed'
    console.error('[story] Python error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const data = readResults()
  if (!data) {
    return NextResponse.json(
      { error: 'Story builder ran but results file not found' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
