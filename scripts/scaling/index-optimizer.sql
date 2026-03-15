-- Script 19: Analyze and add missing indexes for Nexus tables
-- Run in Supabase SQL Editor

-- Check for missing indexes on frequently filtered columns
-- These should already exist from migration, but verify:

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_status ON nexus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_project ON nexus_sessions(project_name);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_last_activity ON nexus_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_model ON nexus_sessions(model);

-- Hook events indexes
CREATE INDEX IF NOT EXISTS idx_nexus_hook_events_session ON nexus_hook_events(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_hook_events_created ON nexus_hook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_hook_events_type ON nexus_hook_events(event_type);

-- Swarm task indexes
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_project ON swarm_tasks(project);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_cost_tier ON swarm_tasks(cost_tier);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_priority ON swarm_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status_priority ON swarm_tasks(status, priority);

-- Composite index for the executor query pattern (queued + priority sort)
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_queue_pull ON swarm_tasks(status, priority ASC, created_at ASC)
  WHERE status = 'queued';

-- Worker indexes
CREATE INDEX IF NOT EXISTS idx_swarm_workers_status ON swarm_workers(status);
CREATE INDEX IF NOT EXISTS idx_swarm_workers_heartbeat ON swarm_workers(last_heartbeat DESC);

-- Agent activity indexes
CREATE INDEX IF NOT EXISTS idx_agent_activity_status ON agent_activity(status);
CREATE INDEX IF NOT EXISTS idx_agent_activity_updated ON agent_activity(updated_at DESC);

-- Analyze tables to update statistics
ANALYZE nexus_sessions;
ANALYZE nexus_hook_events;
ANALYZE swarm_tasks;
ANALYZE swarm_workers;
ANALYZE agent_activity;
