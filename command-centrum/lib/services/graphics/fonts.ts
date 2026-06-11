import type { FontConfig } from './types'

// In-memory font cache: googleName → base64 data URI
const fontCache = new Map<string, string>()

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2?family='
const FONT_URL_RE = /url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/

async function fetchFontBase64(fontConfig: FontConfig): Promise<string | null> {
  const cacheKey = fontConfig.googleName
  if (fontCache.has(cacheKey)) return fontCache.get(cacheKey)!

  try {
    // 1. Fetch CSS from Google Fonts — forces latin subset, static format
    const cssUrl = `${GOOGLE_FONTS_CSS}${fontConfig.googleName}&display=swap`
    const cssRes = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotDroppZ/1.0)' },
    })
    if (!cssRes.ok) return null
    const css = await cssRes.text()

    // 2. Extract the first woff2/woff URL from the CSS
    const match = css.match(FONT_URL_RE)
    if (!match) return null
    const fontUrl = match[1]

    // 3. Fetch the binary font
    const fontRes = await fetch(fontUrl)
    if (!fontRes.ok) return null
    const buffer = await fontRes.arrayBuffer()

    // 4. Encode as base64 data URI
    const base64 = Buffer.from(buffer).toString('base64')
    const mime = fontUrl.includes('.woff2') ? 'font/woff2' : 'font/woff'
    const dataUri = `data:${mime};base64,${base64}`

    fontCache.set(cacheKey, dataUri)
    return dataUri
  } catch {
    return null
  }
}

// Returns an SVG @font-face declaration with embedded base64 font, or null on failure
export async function getFontFaceDeclaration(fontConfig: FontConfig): Promise<string | null> {
  const dataUri = await fetchFontBase64(fontConfig)
  if (!dataUri) return null

  return `@font-face {
    font-family: '${fontConfig.family}';
    src: url('${dataUri}') format('woff2');
    font-weight: ${fontConfig.weight};
    font-style: ${fontConfig.style};
  }`
}
