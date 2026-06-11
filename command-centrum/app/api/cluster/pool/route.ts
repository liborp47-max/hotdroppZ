import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

// Resolve paths relative to command-centrum (process.cwd() at runtime)
const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const PYTHON_SCRIPT = path.join(AI_ROOT, 'scout_hq', 'run_cluster_pipeline.py')
const RESULTS_FILE =
  process.env.CLUSTER_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'cluster_results.json')
const STORY_RESULTS_FILE =
  process.env.STORY_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'story_results.json')
const WRITER_RESULTS_FILE =
  process.env.WRITER_RESULTS_PATH ??
  path.join(AI_ROOT, 'scout_hq', 'writer_results.json')

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

// GET /api/cluster/pool — read last cluster results from Final Pool
export async function GET() {
  const fileData = readJson(RESULTS_FILE)
  if (!fileData) {
    return NextResponse.json({
      status: 'empty',
      message: 'No cluster results yet. POST to /api/cluster/pool to run the pipeline.',
      clusters: [],
      total_items: 0,
      total_relationships: 0,
      pool_stats: { approved: 0, incoming: 0 },
    })
  }

  return NextResponse.json(fileData)
}

// POST /api/cluster/pool — run Python cluster pipeline against Final Pool, optionally chain Story Builder and Writer
export async function POST(req: Request) {
  const url = new URL(req.url)
  const withStoryBuilder = url.searchParams.get('with_story_builder') === '1'
  const withWriter = url.searchParams.get('with_writer') === '1'
  const python = process.env.PYTHON_PATH || 'python'

  try {
    const args = [PYTHON_SCRIPT, '--limit', '100', '--output', RESULTS_FILE]
    if (withStoryBuilder || withWriter) args.push('--with-story-builder')
    if (withWriter) args.push('--with-writer')

    await execFileAsync(
      python,
      args,
      {
        cwd: AI_ROOT,
        timeout: 90_000,
        env: { ...process.env, PYTHONPATH: AI_ROOT },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Python pipeline failed'
    console.error('[cluster/pool] Python error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const data = readJson(RESULTS_FILE)
  if (!data) {
    return NextResponse.json({ error: 'Pipeline ran but results file not found' }, { status: 500 })
  }

  return NextResponse.json(
    withStoryBuilder || withWriter
      ? {
          ...data,
          pipeline: {
            story_builder: readJson(STORY_RESULTS_FILE),
            writer: readJson(WRITER_RESULTS_FILE),
          },
        }
      : data
  )
}
