-- Migration: DroppZ Detector — AI confidence persistence + P0 accuracy tracking
-- Mission: UM-DROPPZ_DETECTOR (sub-missions 02 + 05)
-- Adds columns to scout_items so editors can rate P0 detections and the
-- detector can persist AI confidence for monthly precision/recall reporting.

alter table public.scout_items
  add column if not exists droppz_ai_confidence numeric(4,3),
  add column if not exists droppz_editor_rating text,
  add column if not exists droppz_rated_at timestamptz;

-- Constrain editor verdict to the three allowed ratings.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scout_items_droppz_editor_rating_check'
  ) then
    alter table public.scout_items
      add constraint scout_items_droppz_editor_rating_check
      check (
        droppz_editor_rating is null
        or droppz_editor_rating in ('on_time', 'late', 'false_positive')
      );
  end if;
end $$;

comment on column public.scout_items.droppz_ai_confidence
  is 'DroppZ Detector AI confidence 0-1 from scoreDropConfidence (SM2)';
comment on column public.scout_items.droppz_editor_rating
  is 'Editor verdict on the P0 detection: on_time | late | false_positive (SM5)';
comment on column public.scout_items.droppz_rated_at
  is 'Timestamp the editor recorded the P0 rating (SM5)';

-- Partial index — only rated rows are scanned for monthly accuracy reports.
create index if not exists idx_scout_items_droppz_rating
  on public.scout_items (droppz_editor_rating)
  where droppz_editor_rating is not null;
