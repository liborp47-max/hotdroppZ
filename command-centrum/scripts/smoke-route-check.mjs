import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const raw = fs.readFileSync(filePath, 'utf8')

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, initialValue] = match
    if (process.env[key] !== undefined) continue

    let value = initialValue.trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

for (const fileName of ['.env.local', '.env']) {
  loadEnvFile(path.join(process.cwd(), fileName))
}

const baseUrl = process.env.CC_URL ?? 'http://localhost:3000'

const checks = [
  { label: 'HD CENTRAL page', url: '/hd-central', expect: 200 },
  { label: 'Writer page', url: '/writer', expect: 200 },
  { label: 'Creator page', url: '/creator', expect: 200 },
  { label: 'Creator facts page', url: '/creator-facts', expect: 200 },
  { label: 'Distribution page', url: '/distribution', expect: 200 },
  { label: 'Writer API', url: '/api/writer/articles', expect: 200 },
  { label: 'Distribution queue guard', url: '/api/distribution/queue', expect: 401 },
  { label: 'Distribution live guard', url: '/api/distribution/live', expect: 401 },
  { label: 'Search guard', url: '/api/search?q=rap', expect: 401 },
]

async function main() {
  console.log(`Smoke testing routes against ${baseUrl}`)
  let failures = 0

  for (const check of checks) {
    try {
      const response = await fetch(`${baseUrl}${check.url}`, { signal: AbortSignal.timeout(10000) })
      if (response.status === check.expect) {
        console.log(`✓ ${check.label}: ${response.status}`)
      } else {
        failures += 1
        console.error(`✗ ${check.label}: expected ${check.expect}, got ${response.status}`)
      }
    } catch (error) {
      failures += 1
      console.error(`✗ ${check.label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (failures > 0) {
    process.exitCode = 1
  } else {
    console.log('All smoke route checks passed.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})