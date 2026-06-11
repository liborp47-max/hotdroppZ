import { NextResponse, NextRequest } from 'next/server'
import path from 'path'
import fs from 'fs'
import {
  getFeedPosts,
  createFeedPost,
  FeedPostRow,
} from '@/lib/supabase/feed-admin'
import { normalizeFeedPriority, DEFAULT_FEED_PRIORITY } from '@/lib/feed/priority'
import crypto from 'crypto'

const PROJECT_ROOT = path.resolve(process.cwd(), '..')
const AI_ROOT = path.join(PROJECT_ROOT, 'ai')
const WRITER_RESULTS_FILE = path.join(AI_ROOT, 'scout_hq', 'writer_results.json')
const CREATOR_QUEUE_FILE = path.join(AI_ROOT, 'scout_hq', 'creator_queue.json')

interface WriterArticle {
  story_package_id: string
  formats: Array<{
    format: string
    title: string
    body: string
    summary: string
  }>
  hashtags: string[]
  predicted_engagement: number
  generated_at: string
}

interface CreatorPost {
  package_id: string
  artist_name: string
  template: string
  caption_variants: Array<{
    language: string
    headline: string
    caption: string
  }>
  generate_at: string
}

interface FeedPost {
  id: string
  story_id: string
  artist_name: string
  headline: string
  content: string
  platforms: string[]
  status: 'draft' | 'scheduled' | 'published'
  languages: string[]
  image_url?: string
  priority: number
  created_at: string
  source: 'writer' | 'creator'
}

function readJsonFile(filePath: string): any {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function generateId(): string {
  return crypto.randomUUID()
}

export async function GET() {
  try {
    // First try to get from database
    const dbPosts = await getFeedPosts()
    
    if (dbPosts.length > 0) {
      return NextResponse.json({
        status: 'ok',
        posts: dbPosts,
        total_posts: dbPosts.length,
        source: 'database',
      })
    }

    // If database is empty, load from JSON files (bootstrap)
    const writerData = readJsonFile(WRITER_RESULTS_FILE)
    const creatorData = readJsonFile(CREATOR_QUEUE_FILE)

    const feedPosts: FeedPost[] = []

    // Convert Writer articles to feed posts
    if (writerData?.articles) {
      writerData.articles.forEach((article: WriterArticle, index: number) => {
        const mainFormat = article.formats?.[0]
        if (mainFormat) {
          feedPosts.push({
            id: `writer-${article.story_package_id}`,
            story_id: article.story_package_id,
            artist_name: 'Article',
            headline: mainFormat.title || 'Untitled',
            content: mainFormat.body || mainFormat.summary || '',
            platforms: ['blog', 'newsletter'],
            status: 'draft',
            languages: ['en', 'cs', 'de'],
            priority: 100 - index * 5,
            created_at: article.generated_at || new Date().toISOString(),
            source: 'writer',
          })
        }
      })
    }

    // Convert Creator posts to feed posts
    if (creatorData?.posts) {
      creatorData.posts.forEach((post: CreatorPost, index: number) => {
        const mainCaption = post.caption_variants?.[0]
        if (mainCaption) {
          feedPosts.push({
            id: `creator-${post.package_id}`,
            story_id: post.package_id,
            artist_name: post.artist_name || 'Artist',
            headline: mainCaption.headline || 'Did you know',
            content: mainCaption.caption || '',
            platforms: ['instagram', 'tiktok', 'twitter'],
            status: 'draft',
            languages: post.caption_variants.map(c => c.language),
            priority: 90 - index * 5,
            created_at: post.generate_at || new Date().toISOString(),
            source: 'creator',
          })
        }
      })
    }

    // Sort by priority descending
    feedPosts.sort((a, b) => b.priority - a.priority)

    return NextResponse.json({
      status: feedPosts.length > 0 ? 'ok' : 'empty',
      posts: feedPosts,
      total_posts: feedPosts.length,
      message: feedPosts.length === 0 ? 'No posts yet. Run Writer or Creator engines.' : undefined,
      source: 'json_files',
    })
  } catch (error) {
    console.error('GET /api/feed/posts error:', error)
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const newPost: Partial<FeedPostRow> = {
      id: generateId(),
      headline: body.headline || 'Untitled',
      content: body.content || '',
      artist_name: body.artist_name || 'Artist',
      status: 'draft',
      source: body.source || 'creator',
      category: body.category || null,
      region: body.region || null,
      priority: body.priority !== undefined ? normalizeFeedPriority(body.priority) : DEFAULT_FEED_PRIORITY,
      language: body.language || 'en',
      platforms: body.platforms || [],
      languages: body.languages || ['en'],
      story_package_id: body.story_package_id || null,
      image_url: body.image_url || null,
      metadata: body.metadata || {},
    }

    const saved = await createFeedPost(newPost)

    if (!saved) {
      return NextResponse.json(
        { status: 'error', message: 'Failed to create post' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { status: 'ok', post: saved },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/feed/posts error:', error)
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
