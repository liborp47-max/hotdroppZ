# HotDroppZ — Social Share Card

`share-card-template.svg` is a 1080×1080 (square, Instagram/social) branded card.
The app renders a final card by **string-replacing tokens** in the SVG, then
**rasterizing** the result to PNG/JPEG.

## Tokens

| Token | Type | Where it appears | Notes |
|---|---|---|---|
| `{{COVER_URL}}` | image href | Cover block, top ~60% (0–648px) | Data-URI (`data:image/...;base64,...`) recommended for self-contained output; a remote URL also works if your rasterizer allows network fetch. `preserveAspectRatio="xMidYMid slice"` crops to fill — no letterboxing. Set on **both** `href` and `xlink:href`. |
| `{{CATEGORY}}` | text | Top-left, small uppercase | Short label, e.g. `INTERVIEW`, `MIXTAPE`, `NEWS`. Keep ≤ ~18 chars; pre-uppercase it. |
| `{{BADGE}}` | text | Top-right neon-green pill | e.g. `NEW DROP`, `EXCLUSIVE`. Keep ≤ ~12 chars; the pill is fixed-width (244px). Pre-uppercase it. |
| `{{ARTIST}}` | text | Accent-green line above title | Artist / source name. Keep ≤ ~28 chars to avoid clipping the right edge. |
| `{{TITLE_LINE_1}}` | text | Headline line 1 (required) | Large bold white. |
| `{{TITLE_LINE_2}}` | text | Headline line 2 (optional) | Pass empty string `""` if unused. |
| `{{TITLE_LINE_3}}` | text | Headline line 3 (optional) | Pass empty string `""` if unused. |

### `{{TITLE}}` handling
SVG `<text>` does not auto-wrap, so the headline is split into up to **3 lines**
(`{{TITLE_LINE_1..3}}`). Wrap on the app side:

- Target ~16–18 characters per line at the 76px weight-900 face.
- Always fill `{{TITLE_LINE_1}}`. Replace unused lines with an empty string.
- Empty `tspan`s collapse visually but the line slot still reserves vertical
  rhythm — for a clean 1-line title, set lines 2 and 3 to `""`.

If you prefer a single `{{TITLE}}` token, run a wrap pass first that produces the
three line strings, then replace.

## Brand colors used
- Background `#000000` · White text `#E8E8E8` · Muted gray `#A8A8A8`
- Venom neon-green accent `#00EC88` (badge, waveform, wordmark "DroppZ", flame, rule)
- Violet `#5B3BFF` is available in the system but kept off this card for restraint.

## Design notes
- **Hierarchy (top → bottom):** cover image → category/badge row → neon waveform
  accent → artist (green) → title (white, 900) → neon rule → `HotDroppZ`
  wordmark + flame.
- Two stacked gradients over the cover (`topScrim`, `coverFade`) keep top labels
  and the lower text legible over any cover brightness.
- Wordmark is live text: `Hot` white + `DroppZ` neon-green.
- All gradients/filters are inline; only generic `system-ui/Arial` fonts are used,
  so no external assets are required.

## Rendering

### 1. Escape, then replace
Always XML-escape dynamic strings before injecting (`&` → `&amp;`, `<` → `&lt;`,
`>` → `&gt;`, `"` → `&quot;`).

```js
import { readFileSync } from "node:fs";

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderCard(tpl, data) {
  return tpl
    .replaceAll("{{COVER_URL}}", data.coverUrl)            // data-URI or URL, not escaped the same way
    .replaceAll("{{CATEGORY}}", esc(data.category))
    .replaceAll("{{BADGE}}", esc(data.badge))
    .replaceAll("{{ARTIST}}", esc(data.artist))
    .replaceAll("{{TITLE_LINE_1}}", esc(data.titleLines[0] ?? ""))
    .replaceAll("{{TITLE_LINE_2}}", esc(data.titleLines[1] ?? ""))
    .replaceAll("{{TITLE_LINE_3}}", esc(data.titleLines[2] ?? ""));
}

const tpl = readFileSync("src/assets/share-card-template.svg", "utf8");
const svg = renderCard(tpl, {
  coverUrl: "data:image/jpeg;base64,...",
  category: "MIXTAPE",
  badge: "NEW DROP",
  artist: "Travis Scott",
  titleLines: ["UTOPIA DELUXE", "DROPS FRIDAY", ""],
});
```
> For `{{COVER_URL}}`, escape only `&` → `&amp;` and `"` → `&quot;` (it sits inside
> an attribute). Base64 data-URIs need no escaping.

### 2. Rasterize to PNG (1080×1080)
- **Server (Node):** [`sharp`](https://sharp.pixelplumbing.com) —
  `sharp(Buffer.from(svg)).png().toBuffer()`. Embed the cover as a data-URI so
  `sharp` doesn't need network access. Or [`resvg`](https://github.com/yisibl/resvg-js).
- **Browser/React Native:** draw the SVG to a canvas / `react-native-svg` +
  `captureRef`, then export PNG.
- **CLI:** `rsvg-convert -w 1080 -h 1080 card.svg -o card.png` or
  `inkscape card.svg --export-type=png -w 1080`.

### Tips
- Keep the cover embedded as a data-URI for fully self-contained, deterministic output.
- Output PNG for transparency-safe sharp edges; JPEG (quality ~85) is fine and
  smaller for IG since the card is fully opaque.
- Open Graph / Twitter cards: also export a 1200×630 variant by re-cropping —
  this template is square-only.
