-- AI Usage Logs — tracks every AI provider call in the pipeline
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now() NOT NULL,
  step             text NOT NULL,            -- translation|curator|cluster|writer|final_editor
  provider         text NOT NULL,            -- groq|ollama_mistral|rules|jaccard|etc.
  model            text,
  prompt_tokens    int  DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens     int  DEFAULT 0,
  requests         int  DEFAULT 1,
  latency_ms       int,
  cost_usd         numeric(10,6) DEFAULT 0,
  status           text DEFAULT 'success',  -- success|error|timeout
  error            text,
  run_id           text
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_step_idx       ON ai_usage_logs (step);
CREATE INDEX IF NOT EXISTS ai_usage_logs_provider_idx   ON ai_usage_logs (provider);
CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx ON ai_usage_logs (created_at DESC);

-- AI Settings — persists user choices (selected provider per step, etc.)
CREATE TABLE IF NOT EXISTS ai_settings (
  key        text PRIMARY KEY,               -- e.g. "provider:translation"
  value      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS with service role bypass
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_ai_usage" ON ai_usage_logs
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_ai_settings" ON ai_settings
  USING (auth.role() = 'service_role');
