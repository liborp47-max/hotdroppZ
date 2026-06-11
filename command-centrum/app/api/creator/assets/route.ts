import { NextResponse } from 'next/server'

// Fun Facts pool - sourced from MEDIA
const FUN_FACTS = [
  {
    id: 'fact-001',
    title: 'Artist milestone discovery',
    fact: 'Use one verified artist milestone to open a Did you know post.',
    artist: 'Example artist',
    useCase: 'feed_hook',
    tags: ['trivia', 'milestone', 'engagement'],
    confidence: 94,
  },
  {
    id: 'fact-002',
    title: 'Music industry fact',
    fact: 'First artists to achieve this milestone in their genre.',
    artist: 'Example artist',
    useCase: 'carousel_cover',
    tags: ['industry', 'record', 'achievement'],
    confidence: 87,
  },
  {
    id: 'fact-003',
    title: 'Collaboration history',
    fact: 'Rare collaboration moment that changed the sound.',
    artist: 'Example artist',
    useCase: 'story_context',
    tags: ['collaboration', 'history', 'influence'],
    confidence: 92,
  },
]

// Quotes pool - sourced from MEDIA
const QUOTES = [
  {
    id: 'quote-001',
    author: 'Artist Quote',
    quote: 'Short quotes carry sharp emotion and visual reason.',
    source: 'Public interview',
    context: 'Use on overlays and carousel slides.',
    tags: ['overlay', 'caption', 'emotion'],
    confidence: 91,
  },
  {
    id: 'quote-002',
    author: 'Artist Insight',
    quote: 'The journey is more important than the destination.',
    source: 'Editorial piece',
    context: 'Best for story context and reflection.',
    tags: ['wisdom', 'reflection', 'story'],
    confidence: 88,
  },
  {
    id: 'quote-003',
    author: 'Artist Philosophy',
    quote: 'Stay authentic in a world demanding conformity.',
    source: 'Interview archive',
    context: 'Powerful for engagement and relatability.',
    tags: ['authenticity', 'values', 'engagement'],
    confidence: 95,
  },
]

// Pictures pool - sourced from gallery (free sources + artist gallery)
const PICTURES = [
  {
    id: 'pic-001',
    title: 'Artist portrait high-end',
    source: 'Artist gallery',
    url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    license: 'artist-approved',
    platform: 'feed_card',
    aspectRatio: '1:1',
    tags: ['portrait', 'professional', 'high-quality'],
    creatorSafe: true,
  },
  {
    id: 'pic-002',
    title: 'Performance moment',
    source: 'Unsplash (CC0)',
    url: 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=800',
    license: 'cc0',
    platform: 'story_card',
    aspectRatio: '9:16',
    tags: ['performance', 'action', 'energy'],
    creatorSafe: true,
  },
  {
    id: 'pic-003',
    title: 'Studio creative space',
    source: 'Pexels (free)',
    url: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?w=800',
    license: 'free',
    platform: 'feed_card',
    aspectRatio: '16:9',
    tags: ['studio', 'creative', 'workspace'],
    creatorSafe: true,
  },
]

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    assets: {
      fun_facts: FUN_FACTS,
      quotes: QUOTES,
      pictures: PICTURES,
    },
    total: {
      facts: FUN_FACTS.length,
      quotes: QUOTES.length,
      pictures: PICTURES.length,
    },
  })
}
