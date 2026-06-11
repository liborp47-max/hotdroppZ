-- Enrichment layer: adds media + artist fields to story_clusters
-- Safe to run multiple times (idempotent)

-- Add enrichment columns to story_clusters
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS artist_name        text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS spotify_url        text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS youtube_url        text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS genius_url         text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_url          text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS enrichment_status  text DEFAULT 'pending';
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS enriched_at        timestamptz;

-- AI Image Selection columns (Image Enrichment Engine)
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS selected_image_url text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_source        text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_score        numeric(4,3);
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_author       text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_license      text;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_selected_at  timestamptz;
ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS image_alternatives jsonb DEFAULT '[]'::jsonb;

-- Add image_url to posts table (used by CMS / feed)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;

-- Backfill enrichment_status for existing rows
UPDATE story_clusters
SET enrichment_status = 'pending'
WHERE enrichment_status IS NULL;

-- Index for enrichment pipeline query
CREATE INDEX IF NOT EXISTS idx_story_clusters_enrichment_status
  ON story_clusters (enrichment_status, status, created_at DESC);

-- Required env variables (add to .env.local):
-- SPOTIFY_CLIENT_ID=
-- SPOTIFY_CLIENT_SECRET=
-- YOUTUBE_API_KEY=
-- GENIUS_ACCESS_TOKEN=
-- UNSPLASH_ACCESS_KEY=
-- PEXELS_API_KEY=
-- PIXABAY_API_KEY=
