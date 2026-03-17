-- Cost Tracking Table for API Usage
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  project TEXT NOT NULL,
  task_id UUID REFERENCES swarm_tasks(id) ON DELETE SET NULL,
  model TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  operation_type TEXT, -- e.g., 'task_execution', 'oracle_query', 'chat'
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created_at ON cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_project ON cost_tracking(project);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_task_id ON cost_tracking(task_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_model ON cost_tracking(model);

-- Budget Alerts Table
CREATE TABLE IF NOT EXISTS cost_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  threshold_usd NUMERIC(10, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  project_filter TEXT, -- NULL means all projects
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ
);

-- View for daily cost summaries
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT
  DATE(created_at) as date,
  project,
  model,
  SUM(tokens_in) as total_tokens_in,
  SUM(tokens_out) as total_tokens_out,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as operation_count
FROM cost_tracking
GROUP BY DATE(created_at), project, model
ORDER BY date DESC, total_cost_usd DESC;

-- View for project cost totals
CREATE OR REPLACE VIEW project_cost_summary AS
SELECT
  project,
  SUM(cost_usd) as total_cost_usd,
  SUM(tokens_in) as total_tokens_in,
  SUM(tokens_out) as total_tokens_out,
  COUNT(*) as operation_count,
  MIN(created_at) as first_operation,
  MAX(created_at) as last_operation
FROM cost_tracking
GROUP BY project
ORDER BY total_cost_usd DESC;

COMMENT ON TABLE cost_tracking IS 'Tracks API usage costs across all projects';
COMMENT ON TABLE cost_budget_alerts IS 'Budget threshold alerts for cost monitoring';
