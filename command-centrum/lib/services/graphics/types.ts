export type CategoryStyle =
  | 'droppz'
  | 'usa_rap'
  | 'uk_rap'
  | 'eu_rap'
  | 'ru_rap'
  | 'balkan_rap'
  | 'rnb'
  | 'fashion'
  | 'culture'
  | 'fun'
  | 'news'
  | 'default'

export interface FontConfig {
  family: string
  googleName: string       // name used in Google Fonts API
  weight: 700 | 800 | 900
  style: 'normal' | 'italic'
}

export interface CategoryDesign {
  primaryColor: string    // hex — gradient start / accent
  secondaryColor: string  // hex — gradient end
  textColor: string       // hex — headline text
  pillBg: string          // hex — category pill background
  pillText: string        // hex — category pill text
  font: FontConfig
  categoryLabel: string
}

export interface GraphicInput {
  postId: string
  title: string
  category: string | null
  imageUrl: string | null   // source image to use as background
}

export interface GraphicOutput {
  postId: string
  graphicUrl: string        // URL in Supabase Storage
  status: 'done' | 'error'
  error?: string
  durationMs: number
}

export interface GraphicRunResult {
  processed: number
  generated: number
  skipped: number
  errors: number
}
