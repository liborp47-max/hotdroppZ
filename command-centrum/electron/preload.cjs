// electron/preload.cjs
// Runs in an isolated context (contextIsolation: true, sandbox: true). It is the
// ONLY bridge between the web app and Node/Electron. Exposes a tiny, explicit,
// allow-listed API on window.hdccDesktop — no raw ipcRenderer, no Node globals.

'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hdccDesktop', {
  // True so the web app can feature-detect desktop mode if it ever needs to.
  isDesktop: true,
  platform: process.platform,

  // App version (from package.json), resolved in the main process.
  getVersion: () => ipcRenderer.invoke('hdcc:get-version'),

  // Open an external URL in the user's default browser (validated main-side).
  openExternal: (url) => ipcRenderer.invoke('hdcc:open-external', url),

  // Reload the current window (e.g. a "retry" affordance).
  reload: () => ipcRenderer.invoke('hdcc:reload'),
})
