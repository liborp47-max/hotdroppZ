-- ── Cross-run URL deduplication table ────────────────────────────────────────
-- Purpose: Python Pipeline A checks this table before sending sources to Claude.
--          URLs seen within 72h are skipped — prevents the same article being
--          evaluated by Claude 192× over its 48h RSS lifetime.
--
-- Apply:
--   node command-centrum/scripts/apply-sql.mjs command-centrum/supabase/schema-processed-urls.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS processed_urls (
  url_hash      TEXT        NOT NULL PRIMARY KEY,   -- SHA-256 of URL, safe for query strings
  url           TEXT        NOT NULL,               -- original URL (readable, not indexed)
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  process_count INT         NOT NULL DEFAULT 1
);

-- Only index last_seen — used for the 72h window filter in every lookup
CREATE INDEX IF NOT EXISTS idx_processed_urls_last_seen ON processed_urls (last_seen DESC);

-- ── RPC: atomic upsert with process_count increment ──────────────────────────
-- Called from Python url_dedup.py after every source batch.
-- Correct increment requires SQL — PostgREST PATCH cannot do arithmetic.

CREATE OR REPLACE FUNCTION upsert_seen_urls(p_urls jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec jsonb;
BEGIN
  FOR rec IN SELECT value FROM jsonb_array_elements(p_urls)
  LOOP
    INSERT INTO processed_urls (url_hash, url, first_seen, last_seen, process_count)
    VALUES (
      rec->>'url_hash',
      rec->>'url',
      NOW(),
      NOW(),
      1
    )
    ON CONFLICT (url_hash) DO UPDATE
      SET last_seen     = NOW(),
          process_count = processed_urls.process_count + 1;
  END LOOP;
END;
$$;

-- ── Cleanup: remove records older than 7 days ─────────────────────────────────
-- Run manually or via a pg_cron job:
--   SELECT cron.schedule('cleanup-processed-urls', '0 4 * * *',
--     'DELETE FROM processed_urls WHERE last_seen < NOW() - INTERVAL ''7 days''');
-- Manual:
--   DELETE FROM processed_urls WHERE last_seen < NOW() - INTERVAL '7 days';
