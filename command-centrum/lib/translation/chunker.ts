// Semantic chunker for long articles.
// Splits on paragraph boundaries — never mid-sentence.
// Recombine preserves original structure.

const MAX_CHUNK_CHARS = 4000   // safe for most LLM context windows
const MIN_CHUNK_CHARS = 200    // avoid tiny orphan chunks

export function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text]

  // Split on double-newline (paragraph boundary)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())

  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para

    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate
    } else {
      if (current.length >= MIN_CHUNK_CHARS) {
        chunks.push(current)
      }
      // If a single paragraph is too long, split on sentence boundaries
      current = para.length > MAX_CHUNK_CHARS
        ? splitLongParagraph(para, chunks)
        : para
    }
  }

  if (current.length >= MIN_CHUNK_CHARS) {
    chunks.push(current)
  }

  return chunks.length ? chunks : [text]
}

function splitLongParagraph(para: string, chunks: string[]): string {
  // Split on sentence-ending punctuation
  const sentences = para.split(/(?<=[.!?])\s+/)
  let current = ''

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence
    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate
    } else {
      if (current.length >= MIN_CHUNK_CHARS) chunks.push(current)
      current = sentence
    }
  }

  return current
}

export function recombineChunks(translatedChunks: string[]): string {
  return translatedChunks.join('\n\n')
}
