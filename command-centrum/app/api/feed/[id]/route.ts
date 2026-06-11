import { NextResponse, NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import { updateFeedPost, getFeedPost } from '@/lib/supabase/feed-admin'
import { deriveScheduledAt } from '@/lib/feed/calendar'

const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const WRITER_RESULTS_FILE = path.join(AI_ROOT, 'scout_hq', 'writer_results.json')
const CREATOR_QUEUE_FILE = path.join(AI_ROOT, 'scout_hq', 'creator_queue.json')

function readJsonFile(filePath: string): any {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function findPostInJsonFiles(id: string): any {
  // Check writer results
  const writerData = readJsonFile(WRITER_RESULTS_FILE)
  if (writerData?.articles) {
    for (let i = 0; i < writerData.articles.length; i++) {
      const article = writerData.articles[i]
      const postId = `writer-${article.story_package_id}`
      if (postId === id) {
        return {
          id: postId,
          story_id: article.story_package_id,
          artist_name: 'Article',
          headline: article.formats[0]?.title || '',
          content: article.formats[0]?.body || '',
          platforms: ['blog', 'newsletter'],
          status: 'draft',
          languages: ['en', 'cs', 'de'],
          priority: 100 - i * 5,
          created_at: article.generated_at,
          source: 'writer' as const,
        }
      }
    }
  }

  // Check creator queue
  const creatorData = readJsonFile(CREATOR_QUEUE_FILE)
  if (creatorData?.posts) {
    for (let i = 0; i < creatorData.posts.length; i++) {
      const post = creatorData.posts[i]
      const postId = `creator-${post.package_id}`
      if (postId === id) {
        return {
          id: postId,
          story_id: post.package_id,
          artist_name: post.artist_name,
          headline: post.caption_variants[0]?.headline || '',
          content: post.caption_variants[0]?.caption || '',
          platforms: ['instagram', 'tiktok', 'twitter'],
          status: 'draft',
          languages: post.caption_variants.map((v: any) => v.language),
          priority: 90 - i * 5,
          created_at: post.generate_at,
          source: 'creator' as const,
        }
      }
    }
  }

  return null
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Get current post first - try database
    let current = await getFeedPost(id)
    
    // Fallback to JSON files if not found in database
    if (!current) {
      current = findPostInJsonFiles(id)
    }
    
    if (!current) {
      return NextResponse.json(
        { status: 'error', message: 'Post not found' },
        { status: 404 }
      )
    }

    // Update only provided fields
    const updates = {
      ...(body.headline && { headline: body.headline }),
      ...(body.content && { content: body.content }),
      ...(body.platforms && { platforms: body.platforms }),
      ...(body.languages && { languages: body.languages }),
      ...(body.artist_name && { artist_name: body.artist_name }),
      ...(body.status && { status: body.status }),
      ...(body.category && { category: body.category }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.image_url && { image_url: body.image_url }),
      ...(body.metadata && { metadata: { ...current.metadata, ...body.metadata } }),
      // Calendar stage: persist the per-platform schedule + derive a single
      // ISO scheduled_at the auto-publish cron can query against.
      ...(body.schedule_data && {
        schedule_data: body.schedule_data,
        scheduled_at: deriveScheduledAt(body.schedule_data),
      }),
    }

    // If post was from database, update it there
    if (current.id?.startsWith?.('db-')) {
      const updated = await updateFeedPost(id, updates)
      if (!updated) {
        return NextResponse.json(
          { status: 'error', message: 'Failed to update post' },
          { status: 500 }
        )
      }
      return NextResponse.json({
        status: 'ok',
        post: updated,
      })
    }

    // For JSON-sourced posts, return mock update with merged data
    const updated = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      status: 'ok',
      post: updated,
      source: 'json_fallback',
    })
  } catch (error) {
    console.error('PUT /api/feed/[id] error:', error)
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
