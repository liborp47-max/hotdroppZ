import { NextResponse } from 'next/server'
import {
  createBrainstormingPrompt,
  getImprovementDashboard,
  listPrompts,
} from '@/lib/improvement-system/store'

export async function GET() {
  try {
    return NextResponse.json(listPrompts())
  } catch (error) {
    console.error('[brainstorming] prompts GET:', error)
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
    const selectedPointIds = Array.isArray(body?.selectedPointIds)
      ? body.selectedPointIds.filter((id: unknown): id is string => typeof id === 'string')
      : []
    const targetMode = typeof body?.targetMode === 'string' ? body.targetMode : undefined

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    if (selectedPointIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one brainstorming point' }, { status: 400 })
    }

    const prompt = createBrainstormingPrompt(itemId, selectedPointIds, targetMode)
    if (!prompt) {
      return NextResponse.json({ error: 'Brainstorming item not found' }, { status: 404 })
    }

    return NextResponse.json({ prompt, dashboard: getImprovementDashboard() }, { status: 201 })
  } catch (error) {
    console.error('[brainstorming] prompts POST:', error)
    return NextResponse.json({ error: 'Failed to create brainstorming prompt' }, { status: 500 })
  }
}
