-- ── feed_posts schema extension ────────────────────────────────────────────────
-- Adds columns required by HDUA (frontend-web) to render and filter feed cards.
-- Without these, HDUA's .not('published_at','is',null) returns 0 rows and the
-- feed is permanently empty. Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/schema-feed-posts-extension.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- CRITICAL: feed is empty until published_at exists. HDUA filters:
--   .not('published_at', 'is', null)
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Category v2 (droppz | usa_rap | uk_rap | eu_rap | ru_rap | balkan_rap | rnb | fun | fashion | news)
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Region (us | uk | eu | ru | balkan | global) — derived from category in writer
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS region TEXT;

-- Priority (P0 | P1 | P2 | P3) — drives radar detection and HDUA sort
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS priority TEXT;

-- Language — 'en' for now; multilang posts will use cs/de/pl/fr
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- ── Indexes for HDUA query patterns ──────────────────────────────────────────

-- Feed list query: published DESC (primary sort)
CREATE INDEX IF NOT EXISTS feed_posts_published_at_desc
  ON feed_posts (published_at DESC NULLS LAST);

-- Category filter
CREATE INDEX IF NOT EXISTS feed_posts_category
  ON feed_posts (category)
  WHERE category IS NOT NULL;

-- Region filter
CREATE INDEX IF NOT EXISTS feed_posts_region
  ON feed_posts (region)
  WHERE region IS NOT NULL;

-- Radar query: P0/P1 is_radar posts in last 24h
CREATE INDEX IF NOT EXISTS feed_posts_priority_radar
  ON feed_posts (priority, is_radar, created_at DESC)
  WHERE priority IN ('P0', 'P1');

-- ── Backfill existing rows ────────────────────────────────────────────────────
-- Sets published_at = created_at for rows written before this migration.
-- This makes existing content visible in HDUA immediately.
UPDATE feed_posts
SET published_at = created_at
WHERE published_at IS NULL
  AND created_at IS NOT NULL;

-- Backfill priority from category for existing rows (best-effort)
UPDATE feed_posts
SET priority = CASE category
  WHEN 'droppz'     THEN 'P0'
  WHEN 'usa_rap'    THEN 'P1'
  WHEN 'uk_rap'     THEN 'P1'
  WHEN 'eu_rap'     THEN 'P1'
  WHEN 'ru_rap'     THEN 'P1'
  WHEN 'balkan_rap' THEN 'P1'
  WHEN 'rnb'        THEN 'P2'
  WHEN 'fun'        THEN 'P2'
  WHEN 'fashion'    THEN 'P2'
  WHEN 'news'       THEN 'P2'
  ELSE 'P3'
END
WHERE priority IS NULL
  AND category IS NOT NULL;

-- Backfill region from category for existing rows
UPDATE feed_posts
SET region = CASE category
  WHEN 'droppz'     THEN 'eu'
  WHEN 'usa_rap'    THEN 'us'
  WHEN 'uk_rap'     THEN 'uk'
  WHEN 'eu_rap'     THEN 'eu'
  WHEN 'ru_rap'     THEN 'ru'
  WHEN 'balkan_rap' THEN 'balkan'
  WHEN 'rnb'        THEN 'us'
  WHEN 'fun'        THEN 'global'
  WHEN 'fashion'    THEN 'global'
  WHEN 'news'       THEN 'global'
  ELSE 'global'
END
WHERE region IS NULL
  AND category IS NOT NULL;
