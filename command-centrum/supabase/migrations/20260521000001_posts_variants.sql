-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260521000001_posts_variants
-- UM-WRITER — store the 4 Writer variants per post.
-- variants jsonb: { full, news, social, thread } produced by the Writer stage.
-- Idempotent.
-- ──────────────────────────────────────────────────────────────────────────────

alter table posts add column if not exists variants jsonb not null default '{}'::jsonb;
