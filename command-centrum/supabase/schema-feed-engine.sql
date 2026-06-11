-- ═══════════════════════════════════════════════════════════════
-- HDCC — Feed Engine Migration (UM-FEED_ENGINE)
-- Run AFTER MASTER_SCHEMA.sql (which creates feed_posts + localized_versions)
-- ═══════════════════════════════════════════════════════════════
--
-- Adds the two columns the new card-generation pipeline needs:
--   * template_id   text         - selected card template (MusicCard / AlbumCard / VideoCard / FeatureCard)
--   * card_metadata jsonb        - bag for subtitle, artist, category, virality_score, validation_status, validation_errors
--
-- Why jsonb instead of individual columns: keeps schema stable while the
-- card-metadata shape evolves (mission may iterate on virality_score formula,
-- add new validation fields, etc.). Single jsonb is one ALTER.
--
-- All operations are idempotent (IF NOT EXISTS / DO blocks).

-- ───────────────────────────────────────────
-- COLUMNS
-- ───────────────────────────────────────────

alter table feed_posts add column if not exists template_id   text;
alter table feed_posts add column if not exists card_metadata jsonb not null default '{}'::jsonb;

-- Allowed template values — soft check (text), validated in app layer; constraint
-- kept inclusive so a new template can be rolled out without a migration.
do $$ begin
  alter table feed_posts add constraint feed_posts_template_id_check
    check (template_id is null or template_id in ('MusicCard','AlbumCard','VideoCard','FeatureCard'));
exception when duplicate_object then null;
end $$;

-- ───────────────────────────────────────────
-- INDEXES
-- ───────────────────────────────────────────

create index if not exists idx_feed_posts_template_id        on feed_posts(template_id);
create index if not exists idx_feed_posts_validation_status  on feed_posts((card_metadata->>'validationStatus'));

-- ───────────────────────────────────────────
-- BACKFILL
-- ───────────────────────────────────────────

-- Populate template_id for existing rows from the feed_posts.type column so
-- legacy cards remain renderable after the migration lands. New rows go through
-- template-picker.ts in the app layer.
update feed_posts
   set template_id = case
     when type = 'track'          then 'MusicCard'
     when type = 'album'          then 'AlbumCard'
     when type = 'video_release'  then 'VideoCard'
     when type = 'event'          then 'FeatureCard'
     else 'FeatureCard'
   end
 where template_id is null;
