-- ══════════════════════════════════════════════════════════════════════
-- NEXUS: Session & Hook Event Tables
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- Sessions table — tracks Claude Code sessions
CREATE TABLE IF NOT EXISTS nexus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  project_name TEXT,
  workspace_path TEXT,
  model TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'idle', 'completed')),
  started_at TIMESTAMPTZ DEFAULT now(),
  last_activity TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  tool_count INTEGER DEFAULT 0,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  cache_write_tokens BIGINT DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  current_tool TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hook events table — individual tool use events
CREATE TABLE IF NOT EXISTS nexus_hook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  project_name TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_status ON nexus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_project ON nexus_sessions(project_name);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_last_activity ON nexus_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_hook_events_session ON nexus_hook_events(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_hook_events_created ON nexus_hook_events(created_at DESC);

-- Enable Realtime on sessions so dashboard updates live
ALTER PUBLICATION supabase_realtime ADD TABLE nexus_sessions;

-- RLS: allow all operations for anon key (single-user app)
ALTER TABLE nexus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_hook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on nexus_sessions" ON nexus_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on nexus_hook_events" ON nexus_hook_events
  FOR ALL USING (true) WITH CHECK (true);
