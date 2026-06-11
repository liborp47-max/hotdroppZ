import sharp from 'sharp'
import { CANVAS_W, CANVAS_H } from './layout'
import { buildOverlaySvg } from './overlay'
import { getCategoryDesign } from './design'

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotDroppZ/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    if (ab.byteLength < 1000) return null  // reject tiny/corrupt responses
    return Buffer.from(ab)
  } catch {
    return null
  }
}

// Rich gradient background when no photo available
async function buildFallbackBackground(primaryColor: string, secondaryColor: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${secondaryColor}"/>
        <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0.8"/>
      </linearGradient>
      <!-- Diagonal texture lines -->
      <pattern id="lines" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="40" stroke="${primaryColor}" stroke-width="1" opacity="0.12"/>
      </pattern>
    </defs>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${secondaryColor}"/>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)"/>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#lines)"/>
    <!-- subtle center glow -->
    <radialGradient id="glow" cx="35%" cy="60%" r="55%">
      <stop offset="0%"   stop-color="${primaryColor}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
    </radialGradient>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#glow)"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function generateGraphicBuffer(
  title: string,
  category: string | null,
  imageUrl: string | null,
  customHeadline?: string,
): Promise<Buffer> {
  const design = getCategoryDesign(category)
  const headline = (customHeadline?.trim() || title).trim()

  // ── Step 1: Build base image ─────────────────────────────────────────────────
  let base: Buffer
  if (imageUrl) {
    const raw = await fetchImage(imageUrl)
    if (raw) {
      try {
        base = await sharp(raw)
          .resize(CANVAS_W, CANVAS_H, { fit: 'cover', position: 'attention' })
          // Sharpen the photo — unsharp mask equivalent
          .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
          // Slight contrast boost so text pops against photo
          .modulate({ brightness: 0.95, saturation: 1.15 })
          .jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: '4:4:4' })
          .toBuffer()
      } catch {
        base = await buildFallbackBackground(design.primaryColor, design.secondaryColor)
      }
    } else {
      base = await buildFallbackBackground(design.primaryColor, design.secondaryColor)
    }
  } else {
    base = await buildFallbackBackground(design.primaryColor, design.secondaryColor)
  }

  // ── Step 2: Build SVG overlay ────────────────────────────────────────────────
  const overlaySvg = await buildOverlaySvg(headline, design)

  // ── Step 3: Composite + final output ─────────────────────────────────────────
  const result = await sharp(base)
    .composite([{ input: overlaySvg, blend: 'over' }])
    // Final sharpen pass so text edges are crisp after composite
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer()

  return result
}
