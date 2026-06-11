-- pipeline_costs: daily AI spend log for dashboard visibility
-- Written by flushCostLog() in lib/ai/call.ts after each pipeline run.

CREATE TABLE IF NOT EXISTS pipeline_costs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              text,                             -- pipeline run identifier (optional)
  date                date        NOT NULL,             -- UTC date of the run
  total_calls         integer     NOT NULL DEFAULT 0,
  total_tokens        integer     NOT NULL DEFAULT 0,
  estimated_cost_usd  numeric(10, 6) NOT NULL DEFAULT 0,
  recorded_at         timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard queries (cost by date range)
CREATE INDEX IF NOT EXISTS idx_pipeline_costs_date ON pipeline_costs (date DESC);

-- Enable Row Level Security (read-only for authenticated users)
ALTER TABLE pipeline_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pipeline_costs"
  ON pipeline_costs FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert (pipeline writes via admin client)
CREATE POLICY "Service role can insert pipeline_costs"
  ON pipeline_costs FOR INSERT
  TO service_role
  WITH CHECK (true);
