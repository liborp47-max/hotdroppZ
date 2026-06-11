import { NextResponse } from 'next/server'
import { analyzeBrainstormingItem, getImprovementDashboard } from '@/lib/improvement-system/store'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const itemId = typeof body?.itemId === 'string' ? body.itemId : ''

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    const analysis = analyzeBrainstormingItem(itemId)
    if (!analysis) {
      return NextResponse.json({ error: 'Brainstorming item not found' }, { status: 404 })
    }

    return NextResponse.json({ analysis, dashboard: getImprovementDashboard() })
  } catch (error) {
    console.error('[brainstorming] analyze:', error)
    return NextResponse.json({ error: 'Failed to analyze brainstorming item' }, { status: 500 })
  }
}
