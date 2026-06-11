-- Graphics editorial config on posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS graphic_headline TEXT;

-- Index for editorial page (list posts by graphic status)
CREATE INDEX IF NOT EXISTS idx_posts_graphic_editorial
  ON posts (graphic_status, status, created_at DESC);
