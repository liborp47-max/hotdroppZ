/**
 * Database schema for storing pipeline runs and scout results
 * 
 * Run this SQL in Supabase to create the tables:
 */

-- ─── Pipeline Runs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Run metadata
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'error' | 'stopped'
  duration_ms INTEGER,
  
  -- Results summary
  scout_items_count INTEGER DEFAULT 0,
  filter_items_count INTEGER DEFAULT 0,
  curated_items_count INTEGER DEFAULT 0,
  clustered_items_count INTEGER DEFAULT 0,
  enriched_items_count INTEGER DEFAULT 0,
  
  -- Performance
  avg_momentum DECIMAL(5,2),
  avg_viral_score DECIMAL(5,2),
  unique_sources INTEGER,
  
  -- Logs (jsonb)
  logs JSONB DEFAULT '[]',
  
  -- Error tracking
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_id ON pipeline_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at ON pipeline_runs(created_at DESC);

-- ─── Scout Items (Results) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_items_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Content
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  category TEXT,
  url TEXT NOT NULL,
  
  -- Scoring
  momentum INTEGER NOT NULL,           -- 0-100: entertainment/shock value
  entities_count INTEGER DEFAULT 0,    -- number of entities found
  cross_references INTEGER DEFAULT 0,  -- links to other items
  relevance INTEGER DEFAULT 0,         -- 0-100: topical relevance
  viral_score INTEGER NOT NULL,        -- 0-100: keep human scrolling
  
  -- Status progression
  status TEXT NOT NULL DEFAULT 'fresh', -- 'fresh' | 'curated' | 'clustered' | 'enriched'
  status_history JSONB DEFAULT '[]',   -- history of status changes
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_items_results_run_id ON scout_items_results(run_id);
CREATE INDEX IF NOT EXISTS idx_scout_items_results_user_id ON scout_items_results(user_id);
CREATE INDEX IF NOT EXISTS idx_scout_items_results_status ON scout_items_results(status);
CREATE INDEX IF NOT EXISTS idx_scout_items_results_viral_score ON scout_items_results(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_scout_items_results_momentum ON scout_items_results(momentum DESC);

-- ─── Run Statistics (Materialized View) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Aggregated stats
  total_items INTEGER,
  avg_momentum DECIMAL(5,2),
  avg_viral_score DECIMAL(5,2),
  avg_relevance DECIMAL(5,2),
  
  -- Distribution
  high_momentum_count INTEGER,    -- >= 75
  high_viral_count INTEGER,       -- >= 80
  quality_score INTEGER,          -- overall quality 0-100
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_stats_run_id ON pipeline_runs_stats(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_stats_user_id ON pipeline_runs_stats(user_id);

-- ─── Triggers for Automatic Updates ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_scout_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scout_items_results_updated_at ON scout_items_results;
CREATE TRIGGER trigger_scout_items_results_updated_at
BEFORE UPDATE ON scout_items_results
FOR EACH ROW
EXECUTE FUNCTION update_scout_items_timestamp();

-- ─── Helper Functions ─────────────────────────────────────────────────────────

-- Get recent runs for user (last N)
CREATE OR REPLACE FUNCTION get_user_recent_runs(p_user_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT,
  duration_ms INTEGER,
  total_items INTEGER,
  avg_momentum DECIMAL,
  avg_viral_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.started_at,
    pr.completed_at,
    pr.status,
    pr.duration_ms,
    COALESCE(prs.total_items, 0)::INTEGER,
    COALESCE(prs.avg_momentum, 0)::DECIMAL,
    COALESCE(prs.avg_viral_score, 0)::DECIMAL
  FROM pipeline_runs pr
  LEFT JOIN pipeline_runs_stats prs ON pr.id = prs.run_id
  WHERE pr.user_id = p_user_id
  ORDER BY pr.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get scout items for a run
CREATE OR REPLACE FUNCTION get_run_scout_items(p_run_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source TEXT,
  momentum INTEGER,
  viral_score INTEGER,
  entities_count INTEGER,
  status TEXT,
  url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sir.id,
    sir.title,
    sir.source,
    sir.momentum,
    sir.viral_score,
    sir.entities_count,
    sir.status,
    sir.url
  FROM scout_items_results sir
  WHERE sir.run_id = p_run_id
  ORDER BY sir.viral_score DESC, sir.momentum DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculate run statistics
CREATE OR REPLACE FUNCTION calculate_run_stats(p_run_id UUID)
RETURNS TABLE (
  total_items INTEGER,
  avg_momentum DECIMAL,
  avg_viral_score DECIMAL,
  avg_relevance DECIMAL,
  high_momentum_count INTEGER,
  high_viral_count INTEGER,
  quality_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    ROUND(AVG(sir.momentum)::NUMERIC, 2),
    ROUND(AVG(sir.viral_score)::NUMERIC, 2),
    ROUND(AVG(sir.relevance)::NUMERIC, 2),
    COUNT(CASE WHEN sir.momentum >= 75 THEN 1 END)::INTEGER,
    COUNT(CASE WHEN sir.viral_score >= 80 THEN 1 END)::INTEGER,
    ROUND((AVG(sir.momentum) * 0.4 + AVG(sir.viral_score) * 0.6)::NUMERIC)::INTEGER
  FROM scout_items_results sir
  WHERE sir.run_id = p_run_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON pipeline_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON scout_items_results TO authenticated;
GRANT SELECT ON pipeline_runs_stats TO authenticated;

-- Enable RLS
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_items_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own runs" ON pipeline_runs;
CREATE POLICY "Users can view their own runs"
  ON pipeline_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own runs" ON pipeline_runs;
CREATE POLICY "Users can insert their own runs"
  ON pipeline_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view scout items from their runs" ON scout_items_results;
CREATE POLICY "Users can view scout items from their runs"
  ON scout_items_results FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert scout items for their runs" ON scout_items_results;
CREATE POLICY "Users can insert scout items for their runs"
  ON scout_items_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own stats" ON pipeline_runs_stats;
CREATE POLICY "Users can view their own stats"
  ON pipeline_runs_stats FOR SELECT
  USING (auth.uid() = user_id);
