-- Editorial Centrum schema additions
-- Run: node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/schema-editorial.sql

-- 1. Enrichment columns on story_clusters (idempotent)
ALTER TABLE public.story_clusters
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL;

-- Index for enrichment pipeline queries
CREATE INDEX IF NOT EXISTS idx_story_clusters_enrichment_status
  ON public.story_clusters (enrichment_status);

-- 2. cluster_id on posts (links editorial back to cluster for context)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES public.story_clusters(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_cluster_id
  ON public.posts (cluster_id);

-- 3. Media assets table — own uploads for use as enrichment fallbacks
CREATE TABLE IF NOT EXISTS public.media_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('image', 'video', 'audio', 'logo', 'graphic')),
  url         TEXT NOT NULL,
  storage_key TEXT DEFAULT NULL,         -- Supabase Storage key (null = external URL)
  mime_type   TEXT DEFAULT NULL,
  size_bytes  BIGINT DEFAULT NULL,
  width       INTEGER DEFAULT NULL,
  height      INTEGER DEFAULT NULL,
  duration_s  INTEGER DEFAULT NULL,      -- for video/audio
  tags        TEXT[] DEFAULT '{}',
  artist_hint TEXT DEFAULT NULL,         -- artist this asset belongs to (for auto-match)
  category    TEXT DEFAULT NULL,         -- pipeline category for auto-match
  language    TEXT DEFAULT NULL,         -- language restriction (null = all)
  use_rules   JSONB DEFAULT NULL,        -- auto-use rules: { categories: [], languages: [], min_score: 0 }
  is_active   BOOLEAN DEFAULT TRUE,
  uploaded_by TEXT DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read + write
CREATE POLICY IF NOT EXISTS "media_assets_auth_all" ON public.media_assets
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_media_assets_type    ON public.media_assets (type);
CREATE INDEX IF NOT EXISTS idx_media_assets_tags    ON public.media_assets USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_media_assets_active  ON public.media_assets (is_active);

-- 4. AI editorial rewrite log (tracks AI usage in editorial UI)
CREATE TABLE IF NOT EXISTS public.editorial_operations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  operation    TEXT NOT NULL CHECK (operation IN ('rewrite', 'translate', 'enrich', 'quality_check')),
  provider     TEXT NOT NULL,
  model        TEXT DEFAULT NULL,
  tone         TEXT DEFAULT NULL,
  length_target TEXT DEFAULT NULL,
  prompt_tokens    INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd     NUMERIC(10, 6) DEFAULT 0,
  latency_ms   INTEGER DEFAULT NULL,
  status       TEXT DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error        TEXT DEFAULT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editorial_ops_post ON public.editorial_operations (post_id);
CREATE INDEX IF NOT EXISTS idx_editorial_ops_op   ON public.editorial_operations (operation);
