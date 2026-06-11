-- Graphics pipeline columns on posts table
-- Run: node scripts/apply-sql.mjs supabase/schema-graphics.sql

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS graphic_url          TEXT,
  ADD COLUMN IF NOT EXISTS graphic_status       TEXT DEFAULT 'pending'
    CHECK (graphic_status IN ('pending', 'processing', 'done', 'error')),
  ADD COLUMN IF NOT EXISTS graphic_generated_at TIMESTAMPTZ;

-- Index for the graphics pipeline query (find posts without graphics)
CREATE INDEX IF NOT EXISTS idx_posts_graphic_status
  ON posts (graphic_status, status, created_at DESC);

-- Supabase Storage bucket for graphics (run once in dashboard or via CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('post-graphics', 'post-graphics', true)
-- ON CONFLICT DO NOTHING;
