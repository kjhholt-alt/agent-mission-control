-- Swarm Teams table: coordinates multi-agent teams working on shared goals.
-- Each team has a leader task, member tasks, and tracks progress/cost.

CREATE TABLE IF NOT EXISTS swarm_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    project TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'completed', 'failed')),
    leader_task_id UUID REFERENCES swarm_tasks(id) ON DELETE SET NULL,
    member_task_ids UUID[] DEFAULT '{}',
    max_workers INTEGER DEFAULT 3,
    use_worktrees BOOLEAN DEFAULT TRUE,
    worktree_paths JSONB DEFAULT '{}',
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for active team queries
CREATE INDEX IF NOT EXISTS idx_swarm_teams_status ON swarm_teams(status);
CREATE INDEX IF NOT EXISTS idx_swarm_teams_project ON swarm_teams(project);

-- Enable Realtime for dashboard visibility
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_teams;

-- Add team_id to swarm_tasks for team membership tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'swarm_tasks' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE swarm_tasks ADD COLUMN team_id UUID REFERENCES swarm_teams(id) ON DELETE SET NULL;
        CREATE INDEX idx_swarm_tasks_team_id ON swarm_tasks(team_id);
    END IF;
END $$;
