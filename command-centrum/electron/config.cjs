// electron/config.cjs
// Single source of truth for desktop runtime constants. Pure CommonJS, no deps
// beyond Node builtins so it loads identically in the Electron main process and
// in helper scripts. Nothing here touches the Next.js app code or web mode.

'use strict'

const path = require('node:path')

// Bind to loopback only — the desktop server must never be reachable from the
// network. Server Actions allowedOrigins in next.config.ts assume localhost:3000.
const HOST = '127.0.0.1'

// Port is fixed by default so it stays in sync with next.config serverActions
// allowedOrigins. Override only if 3000 collides on the target machine; if you
// change it, also set DESKTOP_SERVER_ACTION_ORIGIN before building (see README).
const PORT = Number(process.env.HDCC_DESKTOP_PORT || 3000)

const APP_URL = `http://${HOST}:${PORT}`

// DESKTOP_MODE drives dev vs prod-from-source. When packaged we ignore it and
// always run the bundled standalone server.
const MODE = process.env.DESKTOP_MODE === 'production' ? 'production' : 'development'

// command-centrum project root (one level up from electron/).
const APP_ROOT = path.resolve(__dirname, '..')

// How long to wait for the Next server to answer before we give up and surface
// an error dialog to the user.
const SERVER_READY_TIMEOUT_MS = Number(process.env.HDCC_DESKTOP_BOOT_TIMEOUT || 90_000)
const SERVER_POLL_INTERVAL_MS = 500

module.exports = {
  HOST,
  PORT,
  APP_URL,
  MODE,
  APP_ROOT,
  SERVER_READY_TIMEOUT_MS,
  SERVER_POLL_INTERVAL_MS,
}
