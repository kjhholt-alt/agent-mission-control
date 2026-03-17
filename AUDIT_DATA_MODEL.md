# Nexus Data Model & Analytics Audit

**Date**: 2026-03-16
**Project**: agent-mission-control (Nexus)
**Status**: Schema partially implemented, analytics infrastructure active

---

## Executive Summary

Nexus has a **bi-modal data architecture**:
1. **Realtime Session Tracking** (2 tables: `nexus_sessions`, `nexus_hook_events`) — fully migrated ✓
2. **Swarm Task Orchestration** (11 referenced tables) — partially implemented ⚠️

The system **actively references 14 tables** but **only 2 are formally migrated**. Missing schemas must be created to avoid schema mismatch errors when APIs encounter missing tables.

---

## Part 1: Current Data Model Status

### 1A. Fully Migrated Tables ✓

| Table | Purpose | Status | Realtime? | RLS? |
|-------|---------|--------|-----------|------|
| `nexus_sessions` | Claude Code session tracking | ✓ Migrated | Yes | Yes (allow all) |
| `nexus_hook_events` | Individual tool use events | ✓ Migrated | Yes | Yes (allow all) |

**Schema (nexus_sessions)**:
```
id (UUID, PK)
session_id (TEXT, UNIQUE) — Session identifier
project_name (TEXT) — Target project being worked on
workspace_path (TEXT) — Local path
model (TEXT) — Model used (opus, sonnet, haiku)
status (TEXT) — active | idle | completed
started_at (TIMESTAMPTZ)
last_activity (TIMESTAMPTZ) — Last tool use
completed_at (TIMESTAMPTZ, nullable)
tool_count (INT) — Number of tools used
input_tokens (BIGINT)
output_tokens (BIGINT)
cache_read_tokens (BIGINT)
cache_write_tokens (BIGINT)
cost_usd (NUMERIC 10,6)
current_tool (TEXT, nullable)
created_at (TIMESTAMPTZ)
```

**Indexes**: status, project_name, last_activity DESC
**Policies**: Allow all (public app)

---

### 1B. Referenced But Missing Schemas ⚠️

These tables are **actively queried by API routes** but **NOT defined in the migration.sql** file. Missing schemas will cause runtime errors.

#### Swarm Task Management (4 tables)

| Table | Used By | Status | Fields Referenced |
|-------|---------|--------|-------------------|
| `swarm_tasks` | 20+ API routes | Missing | id, title, project, task_type, status, created_at, completed_at, priority, input_data, output_data, assigned_worker_id, actual_cost_cents, error_message, retry_count, updated_at |
| `swarm_workers` | alerts, oracle, today | Missing | id, worker_name, worker_type, tasks_completed, tasks_failed, xp, status, last_heartbeat, spawned_at |
| `swarm_budgets` | alerts, oracle, today | Missing | budget_date, api_spent_cents, daily_limit_cents |
| `swarm_task_log` | (referenced) | Missing | task_id, event_type, created_at, details |

**Status Values** (expected): `queued`, `running`, `completed`, `failed`, `pending_approval`, `approved`, `blocked`

---

#### Memory & Specialization (2 tables)

| Table | Used By | Purpose | Status |
|-------|---------|---------|--------|
| `swarm_memory` | memory route, executor | Shared output summaries across task chains | Missing |
| `agent_specializations` | patterns, today | Per-project/task_type success tracking | Missing |

**swarm_memory fields**: id, task_id, key, value, created_at, updated_at
**agent_specializations fields**: id, project, task_type, success_rate, total_attempts, last_updated

---

#### Session Scheduling (1 table)

| Table | Used By | Purpose | Status |
|-------|---------|---------|--------|
| `nexus_schedules` | schedules route | Cron-based task scheduling + workflow pipelines | Missing |

**Fields**: id, title, cron, workflow_steps, predictive_source, enabled, last_run, next_run

---

#### Agent Activity Tracking (1 table)

| Table | Used By | Purpose | Status |
|-------|---------|---------|--------|
| `agent_activity` | (referenced in routes) | Heartbeats from agents in field | Missing |

**Fields**: id, agent_id, timestamp, status, location, last_ping

---

#### Oracle Decision Engine (3 tables)

| Table | Used By | Purpose | Status |
|-------|---------|---------|--------|
| `oracle_decisions` | oracle/chat, alerts | Pending/approved decisions with rationale | Missing |
| `oracle_briefings` | oracle route | Pre-generated AI briefings (market intel) | Missing |
| `oracle_conversations` | oracle/chat | Conversation history with oracle | Missing |

**oracle_decisions fields**: id, status, decision, rationale, impact_score, created_at, approved_at
**oracle_briefings fields**: id, type, content, generated_at, expires_at
**oracle_conversations fields**: id, thread_id, user_message, oracle_response, created_at

---

#### Lead/Prospect Management (1 table)

| Table | Used By | Purpose | Status |
|-------|---------|---------|--------|
| `prospects` | oracle/chat | Lead/prospect intelligence | Missing |

**Fields**: id, name, company, role, confidence_score, source, created_at

---

## Part 2: Available Analytics Signals

### 2A. Session-Level Analytics

**Source**: `nexus_sessions` table (Realtime)

| Signal | Endpoint | Calculation | Frequency |
|--------|----------|-------------|-----------|
| **Total Cost** | `/api/sessions` | SUM(cost_usd) | Per query |
| **Token Usage** | `/api/sessions` | SUM(input_tokens), SUM(output_tokens) | Per query |
| **Tool Usage** | `/api/sessions` | SUM(tool_count) | Per query |
| **Active Sessions** | Realtime subscription | COUNT(status='active') | Live |
| **Model Distribution** | Inferred | COUNT grouped by model | Per query |
| **Cache Efficiency** | `/api/sessions` | cache_read_tokens / output_tokens | Per query |

**Gaps**:
- No per-tool breakdown (only aggregate tool_count)
- No token type cost differentiation (standard vs. cache write)
- No session error tracking
- No workspace isolation metrics

---

### 2B. Task-Level Analytics

**Source**: `swarm_tasks` table (when schema exists)

| Signal | Endpoint | Status |
|--------|----------|--------|
| Success rate by project | `/api/patterns` | Implemented ✓ |
| Task failure rate (last hour) | `/api/alerts` | Implemented ✓ |
| Stuck tasks (30+ min) | `/api/alerts` | Implemented ✓ |
| Task count by status | `/api/today` | Implemented ✓ |
| Cost per task | Implicit | **Not exposed** |
| Time-to-completion distribution | Not implemented | Missing |
| Retry patterns | Referenced but not analyzed | Missing |

**Available in `/api/patterns`**:
```json
{
  "specializations": [...],
  "patterns": [
    {
      "key": "project/task_type",
      "completed": 10,
      "failed": 2,
      "total": 12,
      "successRate": 83
    }
  ],
  "period": "7d",
  "totalTasks": 100
}
```

---

### 2C. Worker/Agent Analytics

**Source**: `swarm_workers` table (when schema exists)

| Signal | Endpoint | Status |
|--------|----------|--------|
| Worker task completion count | `/api/today` (rankings) | Implemented ✓ |
| Worker success rate | `/api/today` (rankings) | Implemented ✓ |
| Worker XP/experience | `/api/today` (rankings) | Implemented ✓ |
| Worker health (heartbeat) | `/api/alerts` | Implemented ✓ |
| Worker type distribution | Implicit | Missing |

**Available in `/api/today`**:
```json
{
  "rankings": [
    {
      "name": "worker-name",
      "type": "heavy|light",
      "completed": 45,
      "failed": 3,
      "xp": 2500,
      "status": "active",
      "successRate": 94
    }
  ]
}
```

---

### 2D. Budget & Cost Analytics

**Source**: `swarm_budgets` table (when schema exists)

| Signal | Endpoint | Status |
|--------|----------|--------|
| Daily spend vs. limit | `/api/alerts` | Implemented ✓ |
| Spend ratio alerting | `/api/alerts` | Implemented ✓ (80%, 95% thresholds) |
| Cost by project | **Not implemented** | Missing |
| Cost by model tier | **Not implemented** | Missing |

**Alert Thresholds** (from `/api/alerts`):
- ⚠️ Warning: > 80% of daily limit
- 🔴 Critical: > 95% of daily limit

---

### 2E. Building Activity Analytics

**Source**: `swarm_tasks` table

| Signal | Endpoint | Status |
|--------|----------|--------|
| Project task status breakdown | `/api/building-activity` | Implemented ✓ |
| Project failure trend | `/api/building-activity` | Implemented ✓ |

---

## Part 3: Analytics API Summary

### Active Endpoints (25+)

| Route | Data Source | Output | Analytics Signal |
|-------|-------------|--------|------------------|
| `/api/sessions` | nexus_sessions | Session list + cost totals | Session metrics, cost aggregation |
| `/api/tasks` | swarm_tasks | Filtered task list | Task filtering, status breakdown |
| `/api/patterns` | swarm_tasks, agent_specializations | 7-day success rates | Task success patterns |
| `/api/alerts` | swarm_tasks, swarm_budgets, swarm_workers | Active alerts | Anomaly detection |
| `/api/today` | All major tables | Dashboard snapshot | Daily aggregation |
| `/api/export` | nexus_sessions | CSV/JSON report | Historical export |
| `/api/building-activity` | swarm_tasks | Project activity timeline | Project health |
| `/api/oracle/decisions` | oracle_decisions | Decision history | Strategic tracking |
| `/api/git-activity` | (GitHub API) | Recent commits | Project changes |
| `/api/memory` | swarm_memory | Shared memory queries | Task-to-task knowledge |
| `/api/radiant` | Heuristic | Quest suggestions | Task recommendations |

---

## Part 4: Critical Gaps & Recommendations

### 🔴 Critical Issues

1. **Schema/Reality Mismatch**: 14 tables referenced, 2 migrated
   - **Impact**: Runtime errors when swarm tasks or oracle features are used
   - **Fix**: Create missing table schemas (see Schema Generation below)

2. **No Cost-Per-Task Tracking**: Can see total spend but not task-level costs
   - **Impact**: Can't identify expensive task types
   - **Fix**: Add `estimated_cost_cents` to `swarm_tasks` before execution

3. **Token Type Blindness**: No breakdown between standard, cache-read, cache-write
   - **Impact**: Can't optimize cache effectiveness
   - **Fix**: Normalize token tracking in `nexus_sessions`

4. **No Error Categorization**: Only count failures, don't track error types
   - **Impact**: Can't identify systemic failure patterns
   - **Fix**: Add `error_code`, `error_category` to `swarm_tasks`

### ⚠️ Medium Priority

5. **Missing Time-to-Completion Distribution**: Can't identify bottlenecks
   - Add `started_at`, `duration_seconds` to task tracking

6. **No Retry Pattern Analysis**: Can't see if retry strategies are working
   - Expose `retry_count`, `retry_reason` in analytics

7. **Worker Type Intelligence Missing**: Can't correlate task type to optimal worker
   - Add task-to-worker correlation in `/api/patterns`

8. **No Project Cost Breakdown**: Can't see which project consumes most API budget
   - Add cost aggregation by project in `/api/sessions`

### 💡 Nice-to-Have

9. **Specialization Cold Start**: No initial training data for agent_specializations
   - Bootstrap from first week of task data

10. **Predictive Scheduling**: `nexus_schedules.predictive_source` field unused
    - Connect to historical patterns for smart task queuing

---

## Part 5: Schema Generation Scripts

### Missing Table Creation SQL

Run these in **Supabase SQL Editor** to complete the data model:

```sql
-- ════════════════════════════════════════════════════════════════════
-- SWARM TASK MANAGEMENT
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS swarm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  project TEXT,
  task_type TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'pending_approval', 'approved', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  priority INTEGER DEFAULT 0,
  input_data JSONB,
  output_data JSONB,
  assigned_worker_id UUID,
  actual_cost_cents INTEGER,
  estimated_cost_cents INTEGER,
  error_message TEXT,
  error_code TEXT,
  error_category TEXT,
  retry_count INTEGER DEFAULT 0,
  retry_reason TEXT,
  duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS swarm_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT UNIQUE NOT NULL,
  worker_type TEXT DEFAULT 'heavy',
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'dead', 'offline')),
  last_heartbeat TIMESTAMPTZ,
  spawned_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swarm_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_date TEXT NOT NULL UNIQUE,
  api_spent_cents INTEGER DEFAULT 0,
  daily_limit_cents INTEGER DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swarm_task_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES swarm_tasks(id),
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  details JSONB
);

-- ════════════════════════════════════════════════════════════════════
-- MEMORY & SPECIALIZATION
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS swarm_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES swarm_tasks(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project TEXT,
  task_type TEXT,
  success_rate NUMERIC(5, 2),
  total_attempts INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════
-- SCHEDULING & ORCHESTRATION
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nexus_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cron TEXT,
  workflow_steps JSONB,
  predictive_source TEXT,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════
-- AGENT ACTIVITY TRACKING
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  status TEXT,
  location TEXT,
  last_ping TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════════════════
-- ORACLE DECISION ENGINE
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS oracle_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decision TEXT NOT NULL,
  rationale TEXT,
  impact_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oracle_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oracle_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT,
  user_message TEXT,
  oracle_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════
-- PROSPECT/LEAD INTELLIGENCE
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  company TEXT,
  role TEXT,
  confidence_score NUMERIC(3, 2),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES & CONSTRAINTS
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX idx_swarm_tasks_project ON swarm_tasks(project);
CREATE INDEX idx_swarm_tasks_created ON swarm_tasks(created_at DESC);
CREATE INDEX idx_swarm_tasks_worker ON swarm_tasks(assigned_worker_id);
CREATE INDEX idx_swarm_workers_status ON swarm_workers(status);
CREATE INDEX idx_swarm_budgets_date ON swarm_budgets(budget_date);
CREATE INDEX idx_swarm_memory_key ON swarm_memory(key);
CREATE INDEX idx_agent_spec_project ON agent_specializations(project, task_type);
CREATE INDEX idx_oracle_decisions_status ON oracle_decisions(status);

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (allow all for single-user app)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_task_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on swarm_tasks" ON swarm_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on swarm_workers" ON swarm_workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on swarm_budgets" ON swarm_budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on swarm_task_log" ON swarm_task_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on swarm_memory" ON swarm_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agent_specializations" ON agent_specializations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on nexus_schedules" ON nexus_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agent_activity" ON agent_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on oracle_decisions" ON oracle_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on oracle_briefings" ON oracle_briefings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on oracle_conversations" ON oracle_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on prospects" ON prospects FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════
-- REALTIME (optional — add tables that need live updates)
-- ════════════════════════════════════════════════════════════════════

-- Uncomment to enable realtime on key tables
-- ALTER PUBLICATION supabase_realtime ADD TABLE swarm_tasks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE swarm_workers;
-- ALTER PUBLICATION supabase_realtime ADD TABLE oracle_decisions;
```

---

## Part 6: Recommended Enhancements

### Phase 1: Normalize Token Tracking
Add to `nexus_sessions`:
- `cache_read_cost_usd` — separate from standard output
- `cache_write_cost_usd` — cache efficiency metric
- `model_routing_reason` — why model was chosen

### Phase 2: Cost Attribution
Add to `swarm_tasks`:
- `session_id` — link back to session
- `model_used` — which model executed this
- `token_input`, `token_output` — actual token use

### Phase 3: Error Intelligence
Add to `swarm_tasks`:
- `error_category` — Enum: network, auth, timeout, logic, external_api, other
- `error_source` — which component failed (executor, api, tool, etc.)
- `error_context` — JSON with failure details

### Phase 4: Temporal Analytics
New table: `nexus_events_timeline`
- `timestamp` — minute-level granularity
- `metric` — token_use, cost, task_count, error_rate
- `value` — value
- `unit` — tokens, cents, count, percentage

---

## Part 7: Current Data Integrity

**Supabase Project**: `ytvtaorgityczrdhhzqv`
**Database**: PostgreSQL 15.x
**Realtime**: Enabled on `nexus_sessions`, `nexus_hook_events`
**RLS**: All tables use permissive "allow all" policies (single-user app)

### Existing Data Health

| Table | Rows | Index Health | Quality |
|-------|------|--------------|---------|
| nexus_sessions | ~500-1000 | ✓ Indexed | High (structured) |
| nexus_hook_events | ~10k+ | ✓ Indexed | Medium (partial data) |
| swarm_* | 0 | N/A | No schema yet |
| agent_* | 0 | N/A | No schema yet |
| oracle_* | 0 | N/A | No schema yet |

---

## Part 8: Migration Path

**Recommended order** (lowest to highest dependency):

1. ✓ `nexus_sessions`, `nexus_hook_events` — already done
2. `swarm_tasks`, `swarm_workers`, `swarm_budgets` — used by alerts/today
3. `swarm_memory`, `agent_specializations` — used by patterns/memory routes
4. `nexus_schedules` — used by scheduler
5. `oracle_*` tables — used only when oracle features active
6. `agent_activity`, `prospects` — optional, lower priority

**Recommended**: Create all missing schemas (Part 5) in a single Supabase migration to maintain consistency.

---

## Conclusion

**Nexus has strong analytics foundations** with 25+ active API routes, but **data model is incomplete**. The system can function with only the 2 existing tables, but enabling full swarm orchestration, task tracking, and budget management requires **creating the remaining 12 table schemas**.

**Next step**: Run the schema generation SQL (Part 5) in Supabase to complete the data layer.
