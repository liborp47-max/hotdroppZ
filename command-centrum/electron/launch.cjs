// electron/launch.cjs
// Tiny bootstrap run by plain Node. Electron decides "run as a normal app" vs
// "run as Node" by the *presence* of ELECTRON_RUN_AS_NODE (not its value), so an
// empty value can't disable it — it must be deleted before Electron starts.
// Some environments export it globally; this guarantees a clean launch anyway.
//
// Run via: node electron/launch.cjs   (see desktop:dev / desktop:start scripts)

'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')

delete process.env.ELECTRON_RUN_AS_NODE

// Under plain Node, require('electron') resolves to the path of the Electron
// executable — exactly what we want to spawn.
const electronPath = require('electron')

const child = spawn(electronPath, [path.join(__dirname, 'main.cjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env, // ELECTRON_RUN_AS_NODE already removed above
})

child.on('close', (code) => process.exit(code ?? 0))
