-- Distribution layer: explicit HDCC → HDUA push control
-- Run: apply via Supabase MCP or supabase db push

-- ─── 1. Add distribution tracking columns to feed_posts ─────────────────────

ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS hdua_distributed_at timestamptz,
  ADD COLUMN IF NOT EXISTS distribution_priority text NOT NULL DEFAULT 'normal'
    CHECK (distribution_priority IN ('urgent', 'high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS retracted_at timestamptz;

-- Index for Distribution queue (approved, not yet pushed)
CREATE INDEX IF NOT EXISTS idx_feed_posts_dist_queue
  ON feed_posts (created_at DESC)
  WHERE published_at IS NOT NULL AND hdua_distributed_at IS NULL AND retracted_at IS NULL;

-- Index for live in HDUA
CREATE INDEX IF NOT EXISTS idx_feed_posts_dist_live
  ON feed_posts (hdua_distributed_at DESC)
  WHERE hdua_distributed_at IS NOT NULL AND retracted_at IS NULL;

-- ─── 2. Update HDUA RLS to use hdua_distributed_at ──────────────────────────
-- HDUA now only sees posts explicitly pushed via Distribution module

DROP POLICY IF EXISTS "Public can read published feed_posts" ON feed_posts;

CREATE POLICY "Public can read distributed feed_posts"
  ON feed_posts FOR SELECT
  USING (hdua_distributed_at IS NOT NULL AND retracted_at IS NULL);

-- Service role still has full access
-- (policy "Service role can manage feed_posts" already exists from schema-hdua-user-layer.sql)
