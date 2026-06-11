import { NextRequest, NextResponse } from 'next/server'
import { generateGraphicBuffer } from '@/lib/services/graphics'

// GET /api/graphics/preview?title=...&category=...&headline=...
// Returns a JPEG image — open directly in browser to preview
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const title    = searchParams.get('title')    ?? 'Drake Just Dropped His Most Personal Album Yet — And It Hits Different'
  const category = searchParams.get('category') ?? 'usa_rap'
  const headline = searchParams.get('headline') ?? undefined
  const imageUrl = searchParams.get('image')    ?? null

  try {
    const buffer = await generateGraphicBuffer(title, category, imageUrl, headline)
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
