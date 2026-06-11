// electron/scripts/prepare-server.mjs
// Assembles a self-contained Next.js standalone server into
// electron/.server-dist/, which electron-builder ships as resources/server.
//
// Next's standalone output omits static assets and public/ by design, so we
// copy them in. Run AFTER `next build` (with DESKTOP_BUILD=1 so next.config
// emits output:'standalone'). Pure Node, no dependencies.

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..', '..')        // command-centrum/
const STANDALONE = path.join(APP_ROOT, '.next', 'standalone')
const STATIC_SRC = path.join(APP_ROOT, '.next', 'static')
const PUBLIC_SRC = path.join(APP_ROOT, 'public')
const ENV_SRC = path.join(APP_ROOT, '.env.local')
const DEST = path.join(APP_ROOT, 'electron', '.server-dist')

async function main() {
  if (!existsSync(STANDALONE) || !existsSync(path.join(STANDALONE, 'server.js'))) {
    console.error(
      '✗ .next/standalone/server.js not found.\n' +
        '  Run a standalone build first:  cross-env DESKTOP_BUILD=1 next build',
    )
    process.exit(1)
  }

  console.log('• Cleaning', path.relative(APP_ROOT, DEST))
  await fs.rm(DEST, { recursive: true, force: true })
  await fs.mkdir(DEST, { recursive: true })

  console.log('• Copying standalone server (incl. traced node_modules)')
  await fs.cp(STANDALONE, DEST, { recursive: true })

  console.log('• Copying .next/static → .next/static')
  await fs.cp(STATIC_SRC, path.join(DEST, '.next', 'static'), { recursive: true })

  if (existsSync(PUBLIC_SRC)) {
    console.log('• Copying public/')
    await fs.cp(PUBLIC_SRC, path.join(DEST, 'public'), { recursive: true })
  }

  const CA_SRC = path.join(APP_ROOT, 'electron', 'certs', 'system-ca.pem')
  if (existsSync(CA_SRC)) {
    console.log('• Copying system-ca.pem (TLS trust for AV-intercepted HTTPS)')
    await fs.cp(CA_SRC, path.join(DEST, 'system-ca.pem'))
  } else {
    console.log('• No system-ca.pem found — server may fail TLS behind an AV proxy (see README)')
  }

  if (existsSync(ENV_SRC)) {
    // SECURITY: this embeds your runtime secrets into the installer. Only ship
    // builds to trusted machines. To opt out, delete .env.local before building
    // and provide env another way (see electron/README.md).
    console.log('• Copying .env.local  (⚠ bundles secrets — see README)')
    await fs.cp(ENV_SRC, path.join(DEST, '.env.local'))
  } else {
    console.log('• No .env.local found — server will rely on machine env at runtime')
  }

  console.log('✓ Server bundle ready at', path.relative(APP_ROOT, DEST))
}

main().catch((err) => {
  console.error('✗ prepare-server failed:', err)
  process.exit(1)
})
