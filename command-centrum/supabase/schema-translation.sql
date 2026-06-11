-- ═══════════════════════════════════════════════════════════════
-- HDCC — Translation Pipeline Migration
-- Run AFTER schema-pipeline.sql
-- Adds EN translation columns and TRANSLATED status to scout_items
-- ═══════════════════════════════════════════════════════════════

-- EN translation fields (title/content remain as originals)
alter table scout_items add column if not exists title_en      text;
alter table scout_items add column if not exists content_en    text;
alter table scout_items add column if not exists lang_detected text;

-- Expand status constraint to include TRANSLATED
-- (recreate the check so we can add the new value)
alter table scout_items drop constraint if exists scout_items_status_check;
alter table scout_items add constraint scout_items_status_check
  check (status in ('SCOUTED','TRANSLATED','CURATED','CLUSTERED','WRITTEN','discarded'));

-- Useful indexes
create index if not exists idx_scout_items_status_translated
  on scout_items (status) where status = 'TRANSLATED';

-- Migrate existing SCOUTED items that already have english_master:
-- copy english_master → content_en so old data flows correctly
update scout_items
   set content_en = english_master
 where content_en is null
   and english_master is not null;

update scout_items
   set title_en = title
 where title_en is null
   and (language = 'en' or lang_detected = 'en');
