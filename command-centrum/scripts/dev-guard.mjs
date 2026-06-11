// dev-guard — cross-platform dispatcher run by the npm `predev` hook before
// every `npm run dev`. Ensures a single clean `next dev` instance so two servers
// can't fight over `.next` (the cause of "404 on own chunks" / unstyled pages).
// Windows: delegates to dev-guard.ps1. POSIX: inline ps/lsof equivalent.

import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..') // command-centrum
const PORT = process.env.PORT || '3000'
const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

if (process.platform === 'win32') {
  const ps1 = path.join(__dirname, 'dev-guard.ps1')
  try {
    const out = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}" -Port ${PORT}`,
      { encoding: 'utf8' },
    )
    process.stdout.write(out)
  } catch (e) {
    console.log('[dev-guard] guard skipped:', e.message)
  }
} else {
  // POSIX: kill other next-dev for this project + free the port.
  let killed = 0
  const pids = new Set()
  const procs = sh(`ps -eo pid,args`)
  for (const line of procs.split('\n')) {
    if (line.includes(ROOT) && line.includes('next') && !line.includes('dev-guard')) {
      const pid = parseInt(line.trim())
      if (pid && pid !== process.pid) pids.add(pid)
    }
  }
  for (const pid of sh(`lsof -ti tcp:${PORT} -sTCP:LISTEN`).split('\n')) {
    const p = parseInt(pid.trim())
    if (p) pids.add(p)
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
      killed++
    } catch {
      /* already gone */
    }
  }
  if (killed > 0) {
    const next = path.join(ROOT, '.next')
    if (existsSync(next)) rmSync(next, { recursive: true, force: true })
    console.log(`[dev-guard] cleared ${killed} stale dev process(es) + reset .next`)
  } else {
    console.log('[dev-guard] clean - no existing dev server')
  }
}
