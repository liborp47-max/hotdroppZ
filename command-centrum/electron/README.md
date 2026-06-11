# HDCC Desktop (Electron)

Thin Electron wrapper around the existing **command-centrum** Next.js app. The web
app, API contracts, business logic, and Vercel deployment are unchanged — this
layer only boots the Next server locally and shows it in a native window.

## How it works

```
launch.cjs (node)  → strips ELECTRON_RUN_AS_NODE, spawns Electron
Electron main (electron/main.cjs)
  └─ server-manager.cjs  spawns the Next server, waits for the port
        ├─ dev        → next dev   (HMR, from source)
        ├─ prod src   → next start (after `npm run build`)
        └─ packaged   → resources/server/server.js  (standalone, via Electron-as-Node)
  └─ BrowserWindow → http://127.0.0.1:3000
        └─ preload.cjs exposes window.hdccDesktop (contextIsolation + sandbox)
```

## Commands

```bash
npm install                 # picks up electron, electron-builder, cross-env

npm run desktop:dev         # dev: Electron + next dev (hot reload)

npm run build               # standard prod build
npm run desktop:start       # run the desktop app against the prod server (no installer)

npm run desktop:build       # standalone build + assemble + Windows installer
                            # → dist-desktop/HotDroppZ Command Center-Setup-<ver>.exe
```

## Environment / secrets

The server reads the same `.env.local` as the web app (Supabase, Groq, Anthropic,
etc.). `server-manager.cjs` also injects it into the child process explicitly.

- **dev / desktop:start** — uses `command-centrum/.env.local` directly. Nothing to do.
- **packaged installer** — `prepare-server.mjs` copies `.env.local` into the bundle.
  ⚠ **This embeds your secrets in the .exe.** Only distribute to trusted machines.

To opt out of bundled secrets: delete `.env.local` before `npm run desktop:build`,
then place a `.env.local` next to the installed `resources/server/server.js`, or set
the variables in the machine/user environment before launching.

## Optional config (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `HDCC_DESKTOP_PORT` | `3000` | Server port. If you change it, also set `DESKTOP_SERVER_ACTION_ORIGIN` at build time. |
| `DESKTOP_SERVER_ACTION_ORIGIN` | – | Extra Server Actions origin, e.g. `localhost:3100`. |
| `HDCC_DESKTOP_BOOT_TIMEOUT` | `90000` | ms to wait for the server before showing an error. |

## Troubleshooting (seen on this machine)

- **`npm install` → `UNABLE_TO_VERIFY_LEAF_SIGNATURE`** — antivirus HTTPS scanning
  (Avast/AVG) intercepts TLS with its own root CA. Install using the Windows cert
  store: `cross-env NODE_OPTIONS=--use-system-ca npm install` (Node 22+/24).
- **`TypeError: Cannot read properties of undefined (reading 'isPackaged')`** — the
  environment has `ELECTRON_RUN_AS_NODE` set globally, which makes Electron run as
  plain Node so `require('electron')` returns a path string. `electron/launch.cjs`
  deletes the variable before starting Electron, so the `desktop:*` scripts work
  regardless. (Note: Electron keys off the variable's *presence*, not its value.)
- **Runtime: Supabase/Groq HTTPS calls fail under the same antivirus** — handled
  automatically now, on two paths:
  - **Web dev (`npm run dev` / `npm start`)** — the scripts set
    `NODE_OPTIONS=--use-system-ca`, so Node trusts the live Windows store directly
    (Node 22+/24). This is what fixed the bare *Internal Server Error* on
    `localhost:3000`: every request hits the auth middleware, whose Supabase fetch
    failed `UNABLE_TO_VERIFY_LEAF_SIGNATURE` → 500/hang on every route.
  - **Electron launcher (`desktop:*` / packaged)** — Electron's bundled Node (20.x)
    has no `--use-system-ca`, so `server-manager.cjs` re-exports the live
    machine+user root/intermediate cert stores to a fresh PEM in `%TEMP%` on each
    launch and passes it as `NODE_EXTRA_CA_CERTS`. This stays correct even when the
    AV root CA rotates (the build-time `electron/certs/system-ca.pem` is only a
    fallback now). To override, set `NODE_EXTRA_CA_CERTS` yourself before launching.

## Rollback

This layer is fully additive. To remove it: delete `electron/`, `electron-builder.yml`,
`dist-desktop/`, the `desktop:*` scripts + `main` field + 3 devDeps from `package.json`,
and revert the `DESKTOP_BUILD`/`DESKTOP_SERVER_ACTION_ORIGIN` guards in `next.config.ts`.
The web app is untouched.
```
