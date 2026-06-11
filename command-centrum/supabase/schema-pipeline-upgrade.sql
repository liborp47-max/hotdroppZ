-- Pipeline upgrade: short/long text, media_hint, droppz_type on posts
-- Run after schema-enrichment.sql

-- feed_posts: media_hint column
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS media_hint text DEFAULT 'image';

-- posts: short_text, media_hint, droppz_type
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS short_text  text,
  ADD COLUMN IF NOT EXISTS media_hint  text DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS droppz_type text;

-- Index for feed engine backfill queries
CREATE INDEX IF NOT EXISTS idx_feed_posts_media_hint_null
  ON feed_posts (created_at DESC)
  WHERE media_hint IS NULL;
