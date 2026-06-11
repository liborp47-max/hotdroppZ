/**
 * markdown-lite — minimal, safe Markdown subset renderer (UM-FEED_UI / #02).
 *
 * Used by the feed Editor live preview. Input is HTML-escaped FIRST, so the
 * output never contains user-injected markup — safe for dangerouslySetInnerHTML.
 * Pure module — no I/O, no framework imports — unit-testable in isolation.
 *
 * Supported: ## / ### headings, **bold**, *italic*, `code`, - / * bullet
 * lists, [text](http-url) links, blank-line paragraphs.
 */

/** Escapes the five HTML-significant characters. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Applies inline formatting to an already-escaped line. */
function renderInline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
}

/**
 * Renders a minimal Markdown subset to a safe HTML string.
 * The input is escaped before any formatting is applied, so no user content
 * can inject HTML — only the tags this function emits appear in the output.
 */
export function markdownLiteToHtml(text: string | null | undefined): string {
  if (!text) return ''
  const lines = escapeHtml(text).split(/\r?\n/)
  const out: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    if (/^###\s+/.test(line)) {
      closeList()
      out.push(`<h3>${renderInline(line.replace(/^###\s+/, ''))}</h3>`)
    } else if (/^##\s+/.test(line)) {
      closeList()
      out.push(`<h2>${renderInline(line.replace(/^##\s+/, ''))}</h2>`)
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`)
    } else if (line.trim() === '') {
      closeList()
    } else {
      closeList()
      out.push(`<p>${renderInline(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}

/** Reverses the five HTML-significant entities back to characters (+ nbsp). */
export function unescapeHtml(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * Inverse of markdownLiteToHtml (UM-FEED_RICH_EDITOR / SM1).
 *
 * Serialises the WYSIWYG contentEditable surface back to markdown-lite so the
 * stored format never changes (feed renderer + live preview keep working).
 * Tolerant of contentEditable noise — `<div>`/`<br>` line wrapping, `<b>`/`<i>`
 * from execCommand. The markdown -> html -> markdown round-trip is stable.
 */
export function htmlToMarkdownLite(html: string | null | undefined): string {
  if (!html) return ''
  let s = html

  // Line/block boundaries produced by contentEditable.
  s = s.replace(/<br\s*\/?>/gi, '\n')
  // Block elements -> markdown line prefixes (inner kept for the inline pass).
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, c: string) => `\n## ${c}\n`)
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, c: string) => `\n### ${c}\n`)
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, c: string) => `\n- ${c}`)
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, c: string) => `\n${c}\n`)
  s = s.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_m, c: string) => `\n${c}\n`)

  // Inline elements -> markdown markers (single global pass).
  s = s
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_m, c: string) => `**${c}**`)
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_m, c: string) => `*${c}*`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, c: string) => '`' + c + '`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, txt: string) => `[${txt}](${href})`)

  // Drop any residual tags, unescape entities, normalise whitespace.
  s = s.replace(/<[^>]+>/g, '')
  s = unescapeHtml(s)
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

/** Plain-text excerpt of markdown content — for SEO meta description fallback. */
export function markdownToPlainText(text: string | null | undefined, maxLen = 160): string {
  if (!text) return ''
  const stripped = text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen - 1).trimEnd()}…` : stripped
}
