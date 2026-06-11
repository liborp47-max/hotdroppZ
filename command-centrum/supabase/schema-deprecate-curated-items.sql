-- ── curated_items deprecation ──────────────────────────────────────────────────
-- curated_items was a mirror table written by syncLegacyCuratedItems() in
-- curator.ts. No pipeline gate ever read from it — all stages use scout_items
-- with status guards. The mirror caused two bugs:
--   1. sendCuratedToWriter() only updated the mirror, not scout_items.status
--      → writer picked up all CURATED items regardless of editor action
--   2. skipCuratedItem() only updated the mirror, not scout_items.status
--      → skipped items still got written on next writer run
--
-- Resolution: curator.ts now writes attention_score + status to scout_items only.
-- Editor actions now update scout_items directly.
-- Apply with:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/schema-deprecate-curated-items.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Rename to _deprecated (preserves historical data, removes from active schema)
ALTER TABLE IF EXISTS curated_items RENAME TO _curated_items_deprecated;

-- Step 2: Remove from realtime publication (no longer live-synced)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE _curated_items_deprecated;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Optional cleanup (run when confident historical data is not needed) ────────
-- DROP TABLE IF EXISTS _curated_items_deprecated;
