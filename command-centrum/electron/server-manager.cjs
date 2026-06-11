// electron/server-manager.cjs
// Owns the lifecycle of the Next.js server that backs the desktop window:
//   - dev          : spawns `next dev`     (HMR, from source)
//   - prod source  : spawns `next start`   (needs a prior `next build`)
//   - packaged     : spawns the bundled standalone `server.js` via Electron-as-Node
// Plus: waits for the port to answer, injects .env.local into the child, and
// tears the whole process tree down on quit. No third-party dependencies.

'use strict'

const { spawn, spawnSync } = require('node:child_process')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  HOST,
  PORT,
  APP_URL,
  MODE,
  APP_ROOT,
  SERVER_READY_TIMEOUT_MS,
  SERVER_POLL_INTERVAL_MS,
} = require('./config.cjs')

let child = null

/**
 * Minimal .env parser (KEY=VALUE per line). We inject these into the child env
 * so secrets reach the server regardless of whether the standalone runtime
 * auto-loads .env files. Existing process.env values win (never overridden).
 */
function loadEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  const text = fs.readFileSync(file, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // strip matching surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key) out[key] = val
  }
  return out
}

/**
 * Resolve where the server lives + how to launch it for the current mode.
 * @param {boolean} isPackaged
 * @param {string} resourcesPath  process.resourcesPath (only used when packaged)
 */
function resolveLaunch(isPackaged, resourcesPath) {
  if (isPackaged) {
    // Bundled standalone build assembled by scripts/prepare-server.mjs into
    // resources/server. Run server.js with Electron acting as a plain Node.
    const serverDir = path.join(resourcesPath, 'server')
    return {
      cwd: serverDir,
      command: process.execPath,
      args: [path.join(serverDir, 'server.js')],
      asNode: true,
      envFile: path.join(serverDir, '.env.local'),
      caPath: path.join(serverDir, 'system-ca.pem'),
    }
  }

  // Unpackaged: run the project's own `next` CLI through Electron-as-Node. This
  // avoids depending on the .cmd shim and works cross-platform.
  const nextBin = path.join(APP_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
  const subcommand = MODE === 'production' ? 'start' : 'dev'
  return {
    cwd: APP_ROOT,
    command: process.execPath,
    args: [nextBin, subcommand, '-H', HOST, '-p', String(PORT)],
    asNode: true,
    envFile: path.join(APP_ROOT, '.env.local'),
    caPath: path.join(APP_ROOT, 'electron', 'certs', 'system-ca.pem'),
  }
}

/** Poll the server until it answers any HTTP status (401/redirect = up too). */
function waitForServer(onLog) {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(APP_URL, { timeout: 4000 }, (res) => {
        res.resume() // drain
        resolve()
      })
      req.on('error', retryOrFail)
      req.on('timeout', () => {
        req.destroy()
        retryOrFail()
      })
    }
    const retryOrFail = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Server did not respond at ${APP_URL} within ${SERVER_READY_TIMEOUT_MS}ms`))
        return
      }
      setTimeout(attempt, SERVER_POLL_INTERVAL_MS)
    }
    if (onLog) onLog(`Waiting for ${APP_URL} ...`)
    attempt()
  })
}

/**
 * Best-effort: export the live Windows trusted-root + intermediate CA stores to
 * a fresh PEM bundle in a writable temp dir, and return its path.
 *
 * Why: the build-time `system-ca.pem` is a one-time snapshot of the OS roots. The
 * antivirus HTTPS-scanning root CA (Avast/AVG) rotates periodically, so a shipped
 * bundle eventually no longer matches the cert the AV presents → every Supabase
 * fetch fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE. Re-exporting from the live
 * store on each launch keeps trust current. Electron's bundled Node (20.x) has no
 * `--use-system-ca`, so we materialise the store into a file Node can load via
 * NODE_EXTRA_CA_CERTS. Returns null on non-Windows or any failure (caller then
 * falls back to the shipped bundle).
 *
 * @param {(s:string)=>void} onLog
 * @returns {string|null} path to the fresh bundle, or null
 */
function refreshSystemCaBundle(onLog) {
  if (process.platform !== 'win32') return null
  const outPath = path.join(os.tmpdir(), 'hdcc-system-ca.pem')
  // Dedupe by thumbprint across machine + user root/intermediate stores; emit PEM.
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$stores=@('Cert:\\LocalMachine\\Root','Cert:\\LocalMachine\\CA','Cert:\\CurrentUser\\Root','Cert:\\CurrentUser\\CA')",
    '$seen=@{}',
    '$sb=New-Object System.Text.StringBuilder',
    "foreach($s in $stores){Get-ChildItem $s -ErrorAction SilentlyContinue|ForEach-Object{if($_.Thumbprint -and -not $seen.ContainsKey($_.Thumbprint)){$seen[$_.Thumbprint]=$true;$b64=[Convert]::ToBase64String($_.RawData,'InsertLineBreaks');[void]$sb.AppendLine('-----BEGIN CERTIFICATE-----');[void]$sb.AppendLine($b64);[void]$sb.AppendLine('-----END CERTIFICATE-----')}}}",
    '[IO.File]::WriteAllText($env:HDCC_CA_OUT,$sb.ToString())',
  ].join(';')
  try {
    const res = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { env: { ...process.env, HDCC_CA_OUT: outPath }, windowsHide: true, timeout: 20_000 },
    )
    if (res.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      onLog(`Refreshed system CA bundle from live cert store: ${outPath}`)
      return outPath
    }
    onLog(`CA refresh skipped (powershell exit=${res.status}) — using shipped bundle`)
  } catch (err) {
    onLog(`CA refresh failed (${err.message}) — using shipped bundle`)
  }
  return null
}

/**
 * Start the Next server child process and resolve once it answers HTTP.
 * @param {{ isPackaged: boolean, resourcesPath?: string, onLog?: (s:string)=>void }} opts
 */
async function startServer(opts = {}) {
  const { isPackaged = false, resourcesPath = '', onLog = () => {} } = opts
  const launch = resolveLaunch(isPackaged, resourcesPath)

  const fileEnv = loadEnvFile(launch.envFile)
  const env = {
    ...fileEnv, // base layer from .env.local
    ...process.env, // real process env wins over file
    PORT: String(PORT),
    HOSTNAME: HOST,
  }
  if (launch.asNode) env.ELECTRON_RUN_AS_NODE = '1'
  if (MODE === 'production' || isPackaged) env.NODE_ENV = 'production'

  // Make Node trust the OS certificate store (incl. antivirus HTTPS-scanning
  // root CAs like Avast/AVG). Without this, server-side fetches to Supabase fail
  // with "fetch failed" because Node's bundled CA list doesn't include the AV
  // root. Prefer a fresh export of the live store (resilient to AV root rotation),
  // and fall back to the bundle shipped next to the server. NODE_EXTRA_CA_CERTS
  // *extends* Node's built-in roots, so public CAs keep working either way.
  if (!env.NODE_EXTRA_CA_CERTS) {
    const freshCa = refreshSystemCaBundle(onLog)
    const caFile =
      freshCa || (launch.caPath && fs.existsSync(launch.caPath) ? launch.caPath : null)
    if (caFile) {
      env.NODE_EXTRA_CA_CERTS = caFile
      onLog(`Using CA bundle for TLS: ${caFile}`)
    }
  }

  onLog(`Starting Next server: ${launch.command} ${launch.args.join(' ')} (cwd=${launch.cwd})`)

  child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout.on('data', (d) => onLog(`[next] ${String(d).trimEnd()}`))
  child.stderr.on('data', (d) => onLog(`[next:err] ${String(d).trimEnd()}`))

  const exited = new Promise((_, reject) => {
    child.on('exit', (code, signal) => {
      child = null
      reject(new Error(`Next server exited early (code=${code}, signal=${signal})`))
    })
    child.on('error', (err) => {
      child = null
      reject(new Error(`Failed to spawn Next server: ${err.message}`))
    })
  })

  // Whichever happens first: server becomes reachable, or it dies / times out.
  await Promise.race([waitForServer(onLog), exited])
  onLog('Next server is up.')
}

/** Kill the server and its child processes. Safe to call multiple times. */
function stopServer() {
  if (!child || child.killed) {
    child = null
    return
  }
  const pid = child.pid
  child = null
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      // next dev/start spawns worker children — kill the whole tree.
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
    } else {
      process.kill(pid, 'SIGTERM')
    }
  } catch {
    // already gone
  }
}

module.exports = { startServer, stopServer, loadEnvFile }
