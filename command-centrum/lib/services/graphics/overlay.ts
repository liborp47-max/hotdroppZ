import type { CategoryDesign } from './types'
import { getFontFaceDeclaration } from './fonts'
import {
  CANVAS_W, CANVAS_H,
  LOGO_W, LOGO_H, LOGO_MARGIN,
  TEXT_X, PILL_Y,
  calcFontSize, wrapText, headlineStartY,
} from './layout'
import * as fs from 'fs'
import * as path from 'path'

let logoBase64: string | null = null
function getLogoBase64(): string | null {
  if (logoBase64 !== null) return logoBase64
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo', 'logo.png')
    const buf = fs.readFileSync(logoPath)
    logoBase64 = `data:image/png;base64,${buf.toString('base64')}`
    return logoBase64
  } catch {
    return null
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function buildOverlaySvg(
  title: string,
  design: CategoryDesign,
): Promise<Buffer> {
  const fontSize = calcFontSize(title)
  const lines = wrapText(title.toUpperCase(), fontSize)
  const startY = headlineStartY(lines.length, fontSize)
  const lineHeight = Math.round(fontSize * 1.18)

  const fontFace = await getFontFaceDeclaration(design.font)
  // Robust font stack: loaded font → heavy system fallbacks that render well in SVG
  const fontFamily = fontFace
    ? `'${design.font.family}', Impact, 'Arial Black', Arial, sans-serif`
    : `Impact, 'Arial Black', Arial, sans-serif`
  const fontStyle = design.font.style === 'italic' ? 'italic' : 'normal'

  const logo = getLogoBase64()
  const logoX = CANVAS_W - LOGO_W - LOGO_MARGIN
  const logoY = LOGO_MARGIN

  // Pill dimensions
  const pillLabel = design.categoryLabel || ''
  const pillW = pillLabel.length * 12 + 32
  const pillH = 30
  const pillRadius = 4

  // Accent bar left of headline
  const barX = TEXT_X - 18
  const barY = startY
  const barH = lines.length * lineHeight + lineHeight * 0.3
  const barW = 5

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">

  <defs>
    ${fontFace ? `<style>${fontFace}</style>` : ''}

    <!-- Deep bottom gradient — full image stays visible in top 50%, heavy shadow below -->
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0"/>
      <stop offset="38%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="62%"  stop-color="#000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.93"/>
    </linearGradient>

    <!-- Left vignette — eases photo into text zone -->
    <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="#000" stop-opacity="0.45"/>
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
    </linearGradient>

    <!-- Category pill gradient -->
    <linearGradient id="pillGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${design.primaryColor}"/>
      <stop offset="100%" stop-color="${design.secondaryColor}"/>
    </linearGradient>

    <!-- Accent bar gradient (top transparent → solid → bottom fade) -->
    <linearGradient id="accentBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${design.primaryColor}" stop-opacity="0"/>
      <stop offset="30%"  stop-color="${design.primaryColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${design.primaryColor}" stop-opacity="0.6"/>
    </linearGradient>

    <!-- Brand bar at very bottom -->
    <linearGradient id="brandBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${design.primaryColor}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${design.secondaryColor}" stop-opacity="0.6"/>
    </linearGradient>

    <!-- Text glow / blur for shadow effect -->
    <filter id="textShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <!-- Bottom gradient (main legibility layer) -->
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bottomFade)"/>

  <!-- Left vignette (only bottom half) -->
  <rect x="0" y="${Math.round(CANVAS_H * 0.4)}"
    width="${Math.round(CANVAS_W * 0.65)}" height="${Math.round(CANVAS_H * 0.6)}"
    fill="url(#leftFade)"/>

  <!-- Bottom brand bar (6px) -->
  <rect x="0" y="${CANVAS_H - 6}" width="${CANVAS_W}" height="6" fill="url(#brandBar)"/>

  <!-- Left accent bar -->
  <rect x="${barX}" y="${barY}" width="${barW}" height="${Math.round(barH)}"
    fill="url(#accentBar)" rx="2"/>

  <!-- Headline text — shadow pass -->
  ${lines.map((line, i) => {
    const y = startY + i * lineHeight + fontSize
    const escaped = escapeXml(line)
    return `<text x="${TEXT_X + 3}" y="${y + 4}"
      font-family="${fontFamily}" font-size="${fontSize}" font-weight="${design.font.weight}"
      font-style="${fontStyle}" fill="#000" opacity="0.7"
      letter-spacing="-0.5" text-rendering="geometricPrecision">${escaped}</text>`
  }).join('\n  ')}

  <!-- Headline text — main pass -->
  ${lines.map((line, i) => {
    const y = startY + i * lineHeight + fontSize
    const escaped = escapeXml(line)
    return `<text x="${TEXT_X}" y="${y}"
      font-family="${fontFamily}" font-size="${fontSize}" font-weight="${design.font.weight}"
      font-style="${fontStyle}" fill="${design.textColor}"
      letter-spacing="-0.5" text-rendering="geometricPrecision">${escaped}</text>`
  }).join('\n  ')}

  ${pillLabel ? `
  <!-- Category pill -->
  <rect x="${TEXT_X}" y="${PILL_Y}" width="${pillW}" height="${pillH}" rx="${pillRadius}"
    fill="url(#pillGrad)"/>
  <text x="${TEXT_X + 14}" y="${PILL_Y + 20}"
    font-family="'Inter', 'Helvetica Neue', Arial, sans-serif"
    font-size="11" font-weight="800" fill="${design.pillText}"
    letter-spacing="2" text-rendering="geometricPrecision">${escapeXml(pillLabel)}</text>
  ` : ''}

  ${logo ? `
  <!-- Logo top-right -->
  <image href="${logo}" x="${logoX}" y="${logoY}"
    width="${LOGO_W}" height="${LOGO_H}"
    opacity="0.90" preserveAspectRatio="xMidYMid meet"/>
  ` : `
  <!-- Text fallback brand mark -->
  <text x="${logoX}" y="${logoY + 26}"
    font-family="Impact, 'Arial Black', sans-serif"
    font-size="20" font-weight="900"
    fill="${design.primaryColor}" opacity="0.95" letter-spacing="3">HOTDROPPZ</text>
  `}
</svg>`

  return Buffer.from(svg, 'utf8')
}
