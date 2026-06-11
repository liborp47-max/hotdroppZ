// Canvas dimensions — 1200×630 (standard OG image size, HD)
export const CANVAS_W = 1200
export const CANVAS_H = 630

// Logo area at top-right
export const LOGO_W = 120
export const LOGO_H = 40
export const LOGO_MARGIN = 32

// Text area: left side, bottom 40% of canvas
export const TEXT_X = 48
export const TEXT_MAX_W = 720  // headline stays in left ≈60% of image
export const PILL_Y = CANVAS_H - 48 - 28  // category pill baseline
export const HEADLINE_BOTTOM_Y = PILL_Y - 16  // headline sits above pill

// Font size range
const FONT_MAX = 88
const FONT_MIN = 40
const CHARS_PER_LINE = 22  // approx chars that fit at FONT_MAX

export function calcFontSize(title: string): number {
  const len = title.length
  if (len <= 30) return FONT_MAX
  if (len <= 50) return Math.round(FONT_MAX - ((len - 30) / 20) * 20)
  if (len <= 80) return Math.round(68 - ((len - 50) / 30) * 20)
  return FONT_MIN
}

// Wrap title into lines that fit TEXT_MAX_W at given font size
// Returns array of line strings
export function wrapText(title: string, fontSize: number): string[] {
  const charsPerLine = Math.round(CHARS_PER_LINE * (FONT_MAX / fontSize) * 0.9)
  const words = title.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > charsPerLine && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
    if (lines.length >= 3) break  // max 3 lines
  }
  if (current && lines.length < 3) lines.push(current)

  return lines
}

// Returns the y-start of the first headline line given total line count and font size
export function headlineStartY(lineCount: number, fontSize: number): number {
  const lineHeight = fontSize * 1.15
  const totalHeight = lineCount * lineHeight
  const endY = HEADLINE_BOTTOM_Y
  return endY - totalHeight
}
