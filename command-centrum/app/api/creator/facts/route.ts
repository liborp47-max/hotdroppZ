import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const FACT_SCRIPT = path.join(AI_ROOT, 'scout_hq', 'run_creator_fact_builder.py')
const STORY_RESULTS_FILE =
  process.env.STORY_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'story_results.json')
const CREATOR_FACTS_FILE =
  process.env.CREATOR_FACTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'creator_facts.json')

function readResults() {
  if (!fs.existsSync(CREATOR_FACTS_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(CREATOR_FACTS_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export async function GET() {
  const data = readResults()
  if (!data) {
    return NextResponse.json({
      status: 'empty',
      message: 'No creator fact packages yet. POST to run fact builder.',
      packages: [],
      total_packages: 0,
    })
  }
  return NextResponse.json(data)
}

// AUD-SEC-002: validate user-controlled values that flow into the Python exec.
const ALLOWED_LANG = /^[a-z]{2}(,[a-z]{2})*$/
const ALLOWED_MODEL = /^claude-[a-z0-9.-]+$/

export async function POST(req: Request) {
  const url = new URL(req.url)
  const storyIds = (url.searchParams.get('story_ids')?.split(',') || []).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s))
  const languages = url.searchParams.get('languages') || 'en,cs,de'
  const maxPackages = Math.min(Math.max(Number(url.searchParams.get('max_packages')) || 10, 1), 100)
  const model = url.searchParams.get('model') || 'claude-3-5-sonnet-20241022'
  const python = process.env.PYTHON_PATH || 'python'

  if (!ALLOWED_LANG.test(languages)) {
    return NextResponse.json({ error: 'Invalid languages (e.g. en,cs,de)' }, { status: 400 })
  }
  if (!ALLOWED_MODEL.test(model)) {
    return NextResponse.json({ error: 'Invalid model (must be a claude-* id)' }, { status: 400 })
  }

  try {
    const args = [
      FACT_SCRIPT,
      '--input', STORY_RESULTS_FILE,
      '--languages', languages,
      '--model', model,
      '--max-packages', maxPackages.toString(),
      '--output', CREATOR_FACTS_FILE,
    ]

    if (storyIds.length > 0) {
      args.push('--story-ids', storyIds.join(','))
    }

    await execFileAsync(python, args, {
      cwd: AI_ROOT,
      timeout: 300_000,
      env: { ...process.env, PYTHONPATH: AI_ROOT },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Creator fact builder failed'
    console.error('[creator-facts] Python error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const data = readResults()
  if (!data) {
    return NextResponse.json({ error: 'Creator fact builder ran but results file not found' }, { status: 500 })
  }
  return NextResponse.json(data)
}
