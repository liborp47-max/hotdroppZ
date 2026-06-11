-- ═══════════════════════════════════════════════════════════════
-- HDCC — Multilingual Pipeline Migration
-- Run AFTER schema-pipeline.sql
-- ═══════════════════════════════════════════════════════════════

-- scout_items: store original language + EN master
alter table scout_items add column if not exists language_detected text;
alter table scout_items add column if not exists english_master    text;

-- feed_posts: store EN master + localized cache
alter table feed_posts add column if not exists english_master      text;
alter table feed_posts add column if not exists localized_versions  jsonb not null default '{}';

-- posts (legacy): same
alter table posts add column if not exists english_master      text;
alter table posts add column if not exists localized_versions  jsonb not null default '{}';

-- Index for language filtering
create index if not exists idx_scout_items_language on scout_items(language_detected);
