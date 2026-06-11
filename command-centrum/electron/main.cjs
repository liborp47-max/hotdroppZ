// electron/main.cjs
// Electron entry point. Boots the Next.js server, then shows a secure
// BrowserWindow pointed at it. Owns window lifecycle, graceful shutdown,
// external-link safety, and a minimal IPC surface.

'use strict'

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron')
const path = require('node:path')
const { APP_URL, MODE } = require('./config.cjs')
const { startServer, stopServer } = require('./server-manager.cjs')

const isDev = MODE !== 'production' && !app.isPackaged
let mainWindow = null
const logBuffer = []

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`
  logBuffer.push(stamped)
  if (logBuffer.length > 500) logBuffer.shift()
  // eslint-disable-next-line no-console
  console.log(stamped)
}

// Inline splash so the user gets instant feedback while the server boots.
function splashDataUrl(message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
       font-family:Segoe UI,system-ui,sans-serif;background:#0b0b0f;color:#fafafa;gap:18px}
  .spin{width:42px;height:42px;border:3px solid #2a2a35;border-top-color:#ff5722;
        border-radius:50%;animation:s .8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  .t{font-size:15px;opacity:.85}.s{font-size:12px;opacity:.45}
</style></head><body>
  <div class="spin"></div>
  <div class="t">HotDroppZ Command Center</div>
  <div class="s">${message}</div>
</body></html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0b0f',
    show: false,
    autoHideMenuBar: !isDev,
    icon: path.join(__dirname, '..', 'public', 'icons', 'ICON.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.loadURL(splashDataUrl('Starting local server…'))

  // External links open in the real browser; never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('data:')) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showErrorScreen(err) {
  log(`BOOT ERROR: ${err && err.message ? err.message : err}`)
  if (!mainWindow) return
  const tail = logBuffer.slice(-25).join('\n')
  const html = `<!doctype html><meta charset="utf-8"/>
<body style="font-family:Segoe UI,system-ui,sans-serif;background:#0b0b0f;color:#fafafa;padding:40px">
  <h2 style="color:#ff5722">Failed to start the local server</h2>
  <p>${(err && err.message) || err}</p>
  <pre style="white-space:pre-wrap;background:#14141c;padding:16px;border-radius:8px;
       max-height:340px;overflow:auto;font-size:12px;color:#bbb">${tail.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
  <button onclick="hdccDesktop.reload()"
    style="margin-top:16px;padding:10px 18px;background:#ff5722;color:#fff;border:0;border-radius:6px;cursor:pointer">
    Retry
  </button>
</body>`
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  mainWindow.show()
}

async function boot() {
  try {
    await startServer({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      onLog: log,
    })
    if (mainWindow) await mainWindow.loadURL(APP_URL)
  } catch (err) {
    showErrorScreen(err)
  }
}

// ── IPC (allow-listed, minimal) ────────────────────────────────────────────
ipcMain.handle('hdcc:get-version', () => app.getVersion())
ipcMain.handle('hdcc:open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url)
  return false
})
ipcMain.handle('hdcc:reload', async () => {
  if (!mainWindow) return
  mainWindow.loadURL(splashDataUrl('Retrying…'))
  await boot()
})

// ── App lifecycle ───────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    if (!isDev) Menu.setApplicationMenu(null)
    createWindow()
    boot()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        boot()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Graceful shutdown of the Next server in every exit path.
  app.on('before-quit', stopServer)
  app.on('will-quit', stopServer)
  process.on('exit', stopServer)
  process.on('SIGINT', () => {
    stopServer()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    stopServer()
    process.exit(0)
  })
}
