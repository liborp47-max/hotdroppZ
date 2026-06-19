# HDUA — UI System

The "venom" design language — aligned to the HotDroppZ Command Centrum (HDCC):
pure-black surfaces, neon-emerald accent, glassy panels, sharp (near-square) edges,
tasteful glows. **Single source of truth: `src/styles/theme.ts`. Never hardcode hex
values in components** — pull from tokens.

## Color tokens (`theme.ts` → `colors`)

| Token | Value | Use |
|-------|-------|-----|
| `bg` / surfaces | `#0A0A0B` (app bg), pure black | screen backgrounds |
| `glass` / `glassHi` | `rgba(255,255,255,0.035 / 0.06)` | translucent panels |
| `text` / `textMuted` / `textFaint` | `#E8E8E8` / `#A8A8A8` / `#6A6A6A` | text scale |
| **`accent`** | **`#00EC88`** | venom neon-emerald — primary accent |
| `accentBright/Dim/Deep` | `#2BFFA0` / `#00C878` / `#009C5A` | accent ramp |
| `accentGlow` | `rgba(0,236,136,0.32)` | glow color |
| `violet` | `#5B3BFF` | secondary (drop-post) |
| `success/warning/danger/live` | `#00EC88` / `#FFB84D` / `#FF5A5A` / `#FF3B3B` | semantic |
| `spotify/appleMusic/youtube` | `#1DB954` / `#FA2D48` / `#FF0000` | source brand chips |

> Note: HDUA's accent is `#00EC88` (a touch more saturated than HDCC's `#00E085`).
> The web scrollbar gradient in `global.css` stays HDCC-matched on purpose.

## Spacing · radius · typography (`theme.ts`)

- **spacing** `xs:4 sm:8 md:12 lg:16 xl:24 xxl:32`
- **radius** `sm:2 md:4 lg:6 xl:10 pill:999` — deliberately sharp (HDCC uses 0px;
  HDUA keeps a hair of softness on touch targets). `pill` only for the few round chips.
- **typography** sizes `display:28 title:22 headline:18 body:15 label:13 caption:11`;
  weights `regular:400 … bold:700`.
- **layout** `tabBarHeight:64 miniPlayerHeight:56 screenPadding:16`.

## Glows (`theme.ts` → `glows`)

`soft` / `cta` / `strong` — venom box-shadow on web, colored shadow + elevation on
native (`Platform.OS` split). Use sparingly on active tabs, CTAs, brand mark.

## Components (`src/components/`)

`auth` · `brand` (wordmark, flame raster) · `cards` (FeedCard) · `media` (embeds,
source pills) · `post` (PostView reader body) · `share` (ShareSheet, share-card
template) · `shared` (ScreenScaffold, EmptyState, **GlobalScrollbar**).

## Navigation

expo-router. Root `app/_layout.tsx` mounts providers + the persistent
`GlobalScrollbar`. `(tabs)/_layout.tsx` is the bottom tab bar — **Home / Search /
Create / Alerts / Profile**, outline icons, minimal, mini-player slot above the bar.
`post/[id]` is a pushed reader; back returns to the feed with scroll intact.

## Global scrollbar

A single venom rail rendered once in the root layout, above every screen
(`components/shared/GlobalScrollbar.tsx` + `stores/scrollbarShared.ts`). The active
scroll surface registers a `Scroller` and writes `sbProgress`/`sbThumbFraction`
(Reanimated mutables, UI thread); the rail's drag gesture drives the surface back via
`driveScroll`. (Extending ownership to the reader is mission HDUA-18.)

## Conventions

- `'use client'`-style RN components; import tokens, never raw hex.
- Platform colors (Spotify green, Genius gold `#FFD000`, YouTube red) are intentional
  brand colors, not venom misses.
- Modals/sheets get Esc/focus where applicable on web.

Related: [HDUA_ARCHITECTURE.md](HDUA_ARCHITECTURE.md).
