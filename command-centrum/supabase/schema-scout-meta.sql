-- Migration: add_scout_meta_and_fix_language
-- Adds scout_meta JSONB to preserve Scout AI output that had no dedicated column.
-- Also fixes the `language` column default (was 'cs', now NULL — the writer
-- sets it correctly via region→ISO-639-1 mapping in supabase_writer.py).

ALTER TABLE scout_items
  ADD COLUMN IF NOT EXISTS scout_meta JSONB DEFAULT NULL;

-- GIN index for curator/writer filtering on scout_meta fields.
CREATE INDEX IF NOT EXISTS idx_scout_items_scout_meta_urgency
  ON scout_items USING gin (scout_meta)
  WHERE scout_meta IS NOT NULL;

-- Fix bad default ('cs' made every un-touched row appear Czech).
ALTER TABLE scout_items
  ALTER COLUMN language SET DEFAULT NULL;

COMMENT ON COLUMN scout_items.scout_meta IS
  'JSONB blob written by the Python Scout pipeline. Keys: suggested_angle, why_it_matters, urgency, virality_score, region, source_type. Read by curator/writer stages.';
