# HDUA — Deployment

Expo app, built and shipped with **EAS** (Expo Application Services). Targets iOS,
Android, and a web export.

## App identity (`app.json`)

| Field | Value |
|-------|-------|
| name | `HotDroppZ` |
| slug | `hdua` |
| version | `0.1.0` |
| scheme (deep link) | `hdua://` |
| iOS bundle id | `com.hotdroppz.app` |
| Android package | `com.hotdroppz.app` |
| UI style / bg | dark / `#0A0A0B` |
| New Architecture | enabled (`newArchEnabled: true`) |
| plugins | `expo-router`, `expo-av` (mic off), `expo-asset`, `expo-font` |
| web | metro bundler, single output |

## Environment

Public config is injected via **`EXPO_PUBLIC_*`** env vars (bundled into the client —
public by design; never put secrets here):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Read in `src/lib/supabase.ts`. If unset, the app boots with auth disabled and logs a
**dev-only** warning (guarded by `__DEV__`). The anon key is the only key the client
ever holds; the Supabase **service role stays server-side in HDCC**.

## Local development

```bash
cd HDUA
npm install
npm run start        # expo start (dev server, QR for Expo Go / dev client)
npm run ios          # / android / web
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm test             # tsx --test tests/*.test.ts (mappers/text/embeds — HDUA-20)
```

## EAS build + submission (intended pipeline)

> **TODO:** `eas.json` is not yet committed — create it before the first cloud build.

```bash
npm i -g eas-cli && eas login
eas build:configure                 # generates eas.json (development / preview / production profiles)
# Builds (cloud):
eas build --platform ios --profile production
eas build --platform android --profile production
# Store submission:
eas submit --platform ios           # → App Store Connect (needs Apple team + ASC API key)
eas submit --platform android       # → Google Play (needs service-account JSON)
```

Recommended `eas.json` profiles: `development` (dev client, internal dist),
`preview` (internal/ad-hoc), `production` (store, autoIncrement build number).
Store secrets (Apple ASC key, Google service account) live in EAS secrets / CI — not
in the repo.

## OTA updates

With `expo-router` + EAS Update, JS-only changes can ship over-the-air without a new
store build:

```bash
eas update --branch production --message "…"
```

Keep the runtime version policy in `app.json`/`eas.json` aligned so OTA payloads only
land on compatible native builds. Native changes (new permissions, SDK bumps, the
player's background-audio modes in HDUA-08) require a fresh `eas build` + submission.

## Pre-release checklist

- [ ] `eas.json` committed with the three profiles
- [ ] `EXPO_PUBLIC_*` set in the build environment / EAS secrets
- [ ] `npm run typecheck` + `npm test` green
- [ ] app icons / splash present in `src/assets`
- [ ] store metadata (screenshots, description) prepared

Related: [HDUA_ARCHITECTURE.md](HDUA_ARCHITECTURE.md).
