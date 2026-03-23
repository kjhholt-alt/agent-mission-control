# The Terminal -- Architecture Plan

**Domain**: `theterminal.buildkit.store`
**Repo**: `kjhholt-alt/the-terminal`
**Purpose**: Web companion dashboard for the Discord-based Claude Code command center. Read-only ops visibility across all 20+ projects, automations, and agent activity.

---

## 1. Page Structure (Routes & Layouts)

```
src/app/
  layout.tsx                    # Root: Geist Sans/Mono fonts, dark theme, StatusRibbon, sidebar nav
  page.tsx                      # "/" -- Overview: Project Grid + key metrics
  projects/
    page.tsx                    # "/projects" -- Full project grid with filters
    [slug]/page.tsx             # "/projects/nexus" -- Single project deep-dive
  deploys/
    page.tsx                    # "/deploys" -- Deploy timeline (Vercel + Railway)
  automations/
    page.tsx                    # "/automations" -- n8n workflow health
  git/
    page.tsx                    # "/git" -- Commit heatmap + timeline
  activity/
    page.tsx                    # "/activity" -- Discord activity feed
  digest/
    page.tsx                    # "/digest" -- Morning digest view
    [date]/page.tsx             # "/digest/2026-03-23" -- Historical digest
  swarm/
    page.tsx                    # "/swarm" -- Swarm monitor (workers/tasks)
  api/
    projects/route.ts           # GET -- Aggregated project status (GitHub + Vercel + Supabase)
    deploys/route.ts            # GET -- Unified deploy feed (Vercel API + Railway)
    automations/route.ts        # GET -- n8n workflow status (proxied)
    git/route.ts                # GET -- Commit data for heatmap + timeline
    git/heatmap/route.ts        # GET -- 365-day contribution grid data
    activity/route.ts           # GET -- Discord activity from Supabase
    digest/route.ts             # GET -- Today's digest; GET ?date=YYYY-MM-DD for historical
    digest/generate/route.ts    # POST -- Trigger digest generation (calls Claude)
    swarm/route.ts              # GET -- Live swarm status (workers, tasks, budget)
    health/route.ts             # GET -- Aggregate health check for uptime monitoring
    cron/collect/route.ts       # GET -- Vercel Cron: periodic data collection into Supabase
```

### Layout Hierarchy

```
RootLayout (layout.tsx)
  +-- StatusRibbon (top bar: clock, system status, key metrics)
  +-- Sidebar (left: nav links, project quick-list, system health dot)
  +-- Main content area (children)
  +-- CommandPalette (Ctrl+K overlay)
```

**No auth required.** This is a single-user personal dashboard. The domain itself provides access control (only you know it exists). If desired later, add a simple `TERMINAL_ACCESS_TOKEN` cookie check in middleware.

---

## 2. Component Tree Per Page

### 2a. Overview (`/`)

```
OverviewPage (Server Component -- fetches all data in parallel)
  +-- MetricsRibbon
  |     +-- StatCard (active projects)
  |     +-- StatCard (deploys today)
  |     +-- StatCard (automation health %)
  |     +-- StatCard (commits this week)
  |     +-- StatCard (swarm workers active)
  +-- ProjectGridCompact (top 8 projects by recent activity)
  |     +-- ProjectCard[] (compact: name, status dot, last commit, deploy state)
  +-- RecentActivityFeed (last 10 events across all sources)
  |     +-- ActivityRow[] (icon, timestamp, message, source badge)
  +-- DeployMiniTimeline (last 5 deploys)
  |     +-- DeployRow[] (project, status, time ago, commit message)
  +-- SwarmStatusBadge (if orchestrator running: worker count + active tasks)
```

### 2b. Project Grid (`/projects`)

```
ProjectsPage (Server Component)
  +-- FilterBar (Client)
  |     +-- SearchInput
  |     +-- StatusFilter (all/active/idle/error)
  |     +-- CategoryFilter (MVP/client/infra/personal/archive)
  |     +-- SortSelect (last activity/name/deploy status)
  +-- ProjectGrid (Client -- for filter interactivity)
        +-- ProjectCard[] (20+ cards)
              +-- StatusIndicator (deploy state dot)
              +-- ProjectName + framework badge
              +-- LastCommitLine (message, time ago)
              +-- DeployStateLine (Vercel/Railway status, URL)
              +-- TestHealthBar (if test data available)
              +-- QuickLinks (GitHub, live URL, Vercel dashboard)
```

### 2c. Single Project (`/projects/[slug]`)

```
ProjectDetailPage (Server Component)
  +-- ProjectHeader (name, description, links, status)
  +-- DeployHistory (last 10 deploys for this project)
  |     +-- DeployRow[]
  +-- CommitTimeline (last 20 commits)
  |     +-- CommitRow[]
  +-- TestHealth (if available: last test run, pass/fail counts)
  +-- SessionHistory (recent Claude Code sessions on this project)
  |     +-- SessionRow[]
  +-- SwarmTasks (recent swarm tasks for this project)
        +-- TaskRow[]
```

### 2d. Deploy Timeline (`/deploys`)

```
DeploysPage (Server Component -- initial fetch)
  +-- DeployFilters (Client)
  |     +-- PlatformToggle (all/Vercel/Railway)
  |     +-- StatusFilter (all/success/error/building)
  |     +-- DateRange (today/week/month)
  +-- DeployTimeline (Client -- auto-refresh)
        +-- DeployTimelineGroup[] (grouped by date)
              +-- DateHeader
              +-- DeployCard[] (project, status, commit, duration, URL)
```

### 2e. Automation Status (`/automations`)

```
AutomationsPage (Server Component)
  +-- WorkflowGrid
        +-- WorkflowCard[] (7 active workflows)
              +-- WorkflowName + schedule badge
              +-- StatusIndicator (active/inactive/error)
              +-- LastExecution (time, duration, status)
              +-- ExecutionHistory (mini sparkline of last 10 runs)
              +-- NextRunCountdown
```

### 2f. Git Activity (`/git`)

```
GitPage (Server Component)
  +-- ContributionHeatmap (Client)
  |     +-- HeatmapGrid (365-day GitHub-style grid)
  |     +-- HeatmapLegend
  |     +-- HeatmapTooltip
  +-- CommitTimeline (Client -- auto-refresh)
  |     +-- CommitGroup[] (grouped by repo)
  |           +-- RepoHeader (name, commit count)
  |           +-- CommitRow[] (sha, message, author, time)
  +-- RepoActivityRanking
        +-- RepoRankRow[] (sorted by commits this week)
```

### 2g. Discord Activity Feed (`/activity`)

```
ActivityPage (Server Component -- initial load)
  +-- ActivityFeed (Client -- Supabase Realtime subscription)
        +-- ActivityRow[]
              +-- TimestampCol
              +-- SourceBadge (discord channel name)
              +-- MessageContent (markdown rendered)
              +-- MetadataPills (project, command type, duration)
```

### 2h. Morning Digest (`/digest`)

```
DigestPage (Server Component)
  +-- DigestHeader (date, generation status)
  +-- DigestNav (prev/next date arrows)
  +-- DigestContent
  |     +-- SectionCard ("Projects Updated")
  |     +-- SectionCard ("Deploys")
  |     +-- SectionCard ("Automation Runs")
  |     +-- SectionCard ("Git Activity Summary")
  |     +-- SectionCard ("Swarm Activity")
  |     +-- SectionCard ("Notable Events")
  +-- GenerateButton (trigger manual generation)
```

### 2i. Swarm Monitor (`/swarm`)

```
SwarmPage (Server Component -- initial load)
  +-- SwarmStatusBar (orchestrator status, budget, total tasks)
  +-- WorkerFleet (Client -- Realtime)
  |     +-- WorkerCard[] (name, type, status, current task, XP)
  +-- TaskKanban (Client -- Realtime)
  |     +-- KanbanColumn[] (queued/running/blocked/complete)
  |           +-- TaskCard[] (title, project, priority, worker, duration)
  +-- BudgetGauge (daily spend vs limit)
  +-- TaskEventLog (scrolling log of recent task events)
```

---

## 3. Data Fetching Strategy

### Principle: Server Components for initial load, Client Components only for interactivity and live updates.

| Data Source | Fetch Method | Cache / Revalidation | Rationale |
|-------------|-------------|---------------------|-----------|
| **Supabase (sessions, tasks, workers)** | Server Component `fetch` for initial; Client `useEffect` + Supabase Realtime for live | ISR 60s for server; Realtime for client | Sessions/workers change frequently |
| **GitHub API (commits, events)** | Server Component `fetch` with `next: { revalidate: 300 }` | 5-minute ISR | GitHub has rate limits (60/hr unauthenticated, 5000/hr with token) |
| **Vercel API (deploys)** | Server Component `fetch` with `next: { revalidate: 120 }` | 2-minute ISR | Deploy status doesn't change every second |
| **n8n API (workflows)** | API route proxy with `next: { revalidate: 300 }` | 5-minute ISR | Workflow status is checked on schedule anyway |
| **Discord activity** | Supabase query (already logged) | ISR 60s server; Realtime for `/activity` page | Discord data is stored in Supabase, not fetched from Discord API |
| **Morning digest** | Supabase query | Static until regenerated | Generated once per day |
| **Heatmap (365 days)** | API route that queries Supabase cache | Vercel Cron refreshes 1x/day | Too expensive to compute on every page load |

### Client-Side Patterns

- **Supabase Realtime**: Used on `/swarm`, `/activity`, and overview page for live-updating data. Subscribe to `swarm_tasks`, `swarm_workers`, `nexus_sessions` tables.
- **No SWR/React Query**: Not needed. Server Components handle initial data. Supabase Realtime handles live updates. This keeps the bundle small and avoids redundant caching layers.
- **Polling fallback**: For Vercel deploy status on the `/deploys` page, use `setInterval` every 30s calling the API route. Vercel doesn't offer webhooks to Supabase directly.

### API Route Auth

All API routes are public (single-user app). The `/api/cron/collect` route uses `CRON_SECRET` env var verified against `Authorization: Bearer <secret>` header, matching Vercel Cron conventions.

---

## 4. Supabase Schema Additions

Existing tables that will be reused as-is (already on `ytvtaorgityczrdhhzqv`):
- `nexus_sessions` -- Claude Code session tracking
- `nexus_hook_events` -- Tool use events
- `swarm_tasks` -- Task queue
- `swarm_workers` -- Worker registry
- `swarm_budgets` -- Budget tracking
- `swarm_task_log` -- Task event log
- `swarm_memory` -- Shared agent memory
- `cost_tracking` -- API usage costs

### New Tables

```sql
-- ══════════════════════════════════════════════════════════════════════
-- THE TERMINAL: New tables for dashboard data
-- Prefix: terminal_   (avoids collision with nexus_ and swarm_ tables)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Project registry -- single source of truth for all projects
CREATE TABLE IF NOT EXISTS terminal_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- "nexus", "ai-finance-brief"
  name TEXT NOT NULL,                     -- Display name
  description TEXT,
  category TEXT NOT NULL DEFAULT 'infra'  -- "mvp", "client", "infra", "personal", "archive"
    CHECK (category IN ('mvp', 'client', 'infra', 'personal', 'archive')),
  stack TEXT[] DEFAULT '{}',              -- ["Next.js 16", "TypeScript", "Supabase"]
  github_repo TEXT,                       -- "kjhholt-alt/nexus"
  vercel_project TEXT,                    -- Vercel project name (if deployed there)
  railway_service TEXT,                   -- Railway service ID (if deployed there)
  live_url TEXT,                          -- "https://nexus.buildkit.store"
  deploy_target TEXT DEFAULT 'vercel'     -- "vercel", "railway", "both", "none"
    CHECK (deploy_target IN ('vercel', 'railway', 'both', 'none')),
  color TEXT DEFAULT '#6b7280',           -- Project accent color for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Deploy events -- unified deploy log across Vercel + Railway
CREATE TABLE IF NOT EXISTS terminal_deploys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug TEXT NOT NULL REFERENCES terminal_projects(slug),
  platform TEXT NOT NULL CHECK (platform IN ('vercel', 'railway')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'building', 'ready', 'error', 'canceled')),
  deploy_url TEXT,
  commit_sha TEXT,
  commit_message TEXT,
  branch TEXT DEFAULT 'main',
  duration_ms INTEGER,                    -- Build duration
  error_message TEXT,
  external_id TEXT,                       -- Vercel deployment ID or Railway deploy ID
  created_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_terminal_deploys_project ON terminal_deploys(project_slug);
CREATE INDEX idx_terminal_deploys_created ON terminal_deploys(created_at DESC);
CREATE INDEX idx_terminal_deploys_status ON terminal_deploys(status);

-- 3. Git activity cache -- stores commit data to avoid hammering GitHub API
CREATE TABLE IF NOT EXISTS terminal_git_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug TEXT NOT NULL REFERENCES terminal_projects(slug),
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  committed_at TIMESTAMPTZ NOT NULL,
  url TEXT,
  UNIQUE(project_slug, sha)
);

CREATE INDEX idx_terminal_git_committed ON terminal_git_activity(committed_at DESC);

-- 4. Git heatmap cache -- daily commit counts per project for the 365-day grid
CREATE TABLE IF NOT EXISTS terminal_git_heatmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug TEXT NOT NULL REFERENCES terminal_projects(slug),
  date DATE NOT NULL,
  commit_count INTEGER DEFAULT 0,
  UNIQUE(project_slug, date)
);

CREATE INDEX idx_terminal_heatmap_date ON terminal_git_heatmap(date DESC);

-- 5. Automation status -- n8n workflow execution snapshots
CREATE TABLE IF NOT EXISTS terminal_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT UNIQUE NOT NULL,       -- n8n workflow ID
  workflow_name TEXT NOT NULL,
  schedule TEXT,                          -- Cron expression or description
  is_active BOOLEAN DEFAULT true,
  last_execution_at TIMESTAMPTZ,
  last_execution_status TEXT              -- "success", "error", "running"
    CHECK (last_execution_status IN ('success', 'error', 'running')),
  last_execution_duration_ms INTEGER,
  last_error_message TEXT,
  execution_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Discord activity log -- Terminal interactions logged from webhook/bot
CREATE TABLE IF NOT EXISTS terminal_discord_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,             -- "#general", "#automations"
  channel_id TEXT,
  author TEXT NOT NULL,                   -- "ClawBot", "Kruz"
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'message'     -- "message", "command", "webhook", "bot_response"
    CHECK (message_type IN ('message', 'command', 'webhook', 'bot_response')),
  metadata JSONB DEFAULT '{}',            -- Project, duration, command type, etc.
  discord_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_terminal_discord_created ON terminal_discord_log(created_at DESC);
CREATE INDEX idx_terminal_discord_channel ON terminal_discord_log(channel_name);

-- 7. Morning digest -- cached digest content
CREATE TABLE IF NOT EXISTS terminal_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  content JSONB NOT NULL,                 -- Structured digest sections
  summary TEXT,                           -- One-line summary
  generated_at TIMESTAMPTZ DEFAULT now(),
  generation_model TEXT                   -- Which model generated it
);

CREATE INDEX idx_terminal_digests_date ON terminal_digests(date DESC);

-- ── Enable Realtime on key tables ──────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE terminal_deploys;
ALTER PUBLICATION supabase_realtime ADD TABLE terminal_discord_log;

-- ── RLS (single-user, allow all) ──────────────────────────────────
ALTER TABLE terminal_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_deploys ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_git_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_git_heatmap ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_discord_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON terminal_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON terminal_deploys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON terminal_git_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON terminal_git_heatmap FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON terminal_automations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON terminal_discord_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON terminal_digests FOR ALL USING (true) WITH CHECK (true);
```

### Seed Data for Project Registry

```sql
INSERT INTO terminal_projects (slug, name, category, github_repo, vercel_project, live_url, deploy_target, color, stack) VALUES
  ('nexus', 'Nexus', 'infra', 'kjhholt-alt/nexus', 'nexus', 'https://nexus.buildkit.store', 'vercel', '#06b6d4', ARRAY['Next.js 16','TypeScript','Supabase','Tauri']),
  ('ai-finance-brief', 'AI Finance Brief', 'mvp', 'kjhholt-alt/ai-finance-brief', 'ai-finance-brief', 'https://aifinancebrief.com', 'vercel', '#14b8a6', ARRAY['Next.js 14','Claude API','NextAuth']),
  ('trade-journal', 'Trade Journal', 'mvp', 'kjhholt-alt/trade-journal', 'trade-journal', NULL, 'both', '#8b5cf6', ARRAY['Next.js 14','Python FastAPI','Recharts']),
  ('ai-chess-coach', 'AI Chess Coach', 'mvp', 'kjhholt-alt/ai-chess-coach', 'ai-chess-coach', NULL, 'vercel', '#a855f7', ARRAY['Next.js 14','chess.js','Lichess API']),
  ('outdoor-crm', 'Outdoor CRM (AATOS)', 'client', 'kjhholt-alt/outdoor-crm', 'outdoor-crm', NULL, 'both', '#3b82f6', ARRAY['React 19','Django 5','DRF']),
  ('n16-soccer', 'N16 Soccer Training', 'client', 'kjhholt-alt/n16-soccer', 'n16-soccer', NULL, 'vercel', '#22c55e', ARRAY['Next.js 14','Tailwind','shadcn/ui']),
  ('BarrelHouseCRM', 'BarrelHouse CRM', 'client', 'kjhholt-alt/BarrelHouseCRM', 'barrelhouse-crm', 'https://barrelhouse-crm.vercel.app', 'both', '#ef4444', ARRAY['React 19','Django 6']),
  ('admin-dashboard', 'Admin Dashboard', 'infra', 'kjhholt-alt/admin-dashboard', 'admin-dashboard', 'https://admin.buildkit.store', 'vercel', '#f59e0b', ARRAY['Next.js 15','Supabase']),
  ('buildkit-services', 'BuildKit Services', 'infra', 'kjhholt-alt/buildkit-services', 'buildkit-services', 'https://services.buildkit.store', 'vercel', '#f59e0b', ARRAY['Next.js 16','Supabase']),
  ('pc-bottleneck-analyzer', 'PC Bottleneck Analyzer', 'infra', 'kjhholt-alt/pc-bottleneck-analyzer', 'pc-bottleneck-analyzer', 'https://pcbottleneck.buildkit.store', 'vercel', '#10b981', ARRAY['Next.js 16','Python']),
  ('email-finder-app', 'Email Finder', 'infra', 'kjhholt-alt/email-finder-app', 'email-finder-app', 'https://emailfinder.buildkit.store', 'vercel', '#ec4899', ARRAY['Next.js 16','Supabase']),
  ('mcp-servers', 'MCP Servers', 'infra', 'kjhholt-alt/mcp-servers', NULL, NULL, 'none', '#6366f1', ARRAY['TypeScript','MCP SDK']),
  ('MoneyPrinter', 'MoneyPrinter', 'personal', 'kjhholt-alt/MoneyPrinter', NULL, NULL, 'railway', '#f97316', ARRAY['Python','Polymarket']),
  ('autopilot', 'AUTOPILOT SEO', 'infra', 'kjhholt-alt/autopilot', NULL, NULL, 'railway', '#84cc16', ARRAY['Python','Claude API','GitHub API']),
  ('autopilot-finance', 'AUTOPILOT Finance', 'infra', 'kjhholt-alt/autopilot-finance', NULL, NULL, 'railway', '#14b8a6', ARRAY['Python','Claude API','GitHub API']),
  ('automation-playground', 'Automation Playground', 'infra', 'kjhholt-alt/automation-playground', NULL, 'https://automation-playground-production.up.railway.app', 'railway', '#f97316', ARRAY['n8n','Docker']),
  ('ag-market-pulse', 'Ag Market Pulse', 'personal', 'kjhholt-alt/ag-market-pulse', NULL, NULL, 'none', '#367C2B', ARRAY['Python','Claude API','PPTX']),
  ('nexus-trade', 'Nexus Trade', 'personal', 'kjhholt-alt/nexus-trade', NULL, NULL, 'both', '#eab308', ARRAY['Python FastAPI','discord.py','Next.js 16']),
  ('the-terminal', 'The Terminal', 'infra', 'kjhholt-alt/the-terminal', 'the-terminal', 'https://theterminal.buildkit.store', 'vercel', '#22d3ee', ARRAY['Next.js 16','TypeScript','Supabase']),
  ('jarvis-dashboard', 'Jarvis Dashboard', 'infra', NULL, NULL, NULL, 'none', '#a855f7', ARRAY['Next.js 15','xterm.js']),
  ('portfolio', 'Developer Portfolio', 'personal', NULL, 'portfolio', NULL, 'vercel', '#64748b', ARRAY['Next.js 15','Framer Motion']),
  ('stock-breakout-alerts', 'Stock Breakout Alerts', 'personal', NULL, NULL, NULL, 'none', '#ef4444', ARRAY['Django 5','React 18','Celery']),
  ('municipal-crm', 'Municipal Lead CRM', 'personal', NULL, NULL, NULL, 'none', '#3b82f6', ARRAY['Django 5','React 19','Supabase']),
  ('wavefront', 'Wavefront', 'personal', NULL, NULL, NULL, 'none', '#8b5cf6', ARRAY['React 18','Three.js','Django'])
ON CONFLICT (slug) DO NOTHING;
```

### Useful Views

```sql
-- View: Latest deploy per project
CREATE OR REPLACE VIEW terminal_latest_deploys AS
SELECT DISTINCT ON (project_slug)
  project_slug, platform, status, deploy_url, commit_sha, commit_message,
  branch, duration_ms, created_at, finished_at
FROM terminal_deploys
ORDER BY project_slug, created_at DESC;

-- View: Daily commit counts across all projects (for heatmap)
CREATE OR REPLACE VIEW terminal_daily_commits AS
SELECT date, SUM(commit_count) AS total_commits
FROM terminal_git_heatmap
GROUP BY date
ORDER BY date DESC;
```

---

## 5. API Routes Detail

### `GET /api/projects`

Aggregates data from multiple sources into a single response for the project grid.

```
Response: {
  projects: [{
    slug, name, category, stack, color, live_url,
    github: { last_commit_message, last_commit_date, open_prs },
    deploy: { status, platform, url, last_deploy_date },
    sessions: { active_count, last_session_date },
    swarm: { queued_tasks, running_tasks }
  }]
}
```

**Implementation**: Server-side parallel fetch:
1. `terminal_projects` from Supabase (all rows)
2. `terminal_latest_deploys` view from Supabase
3. `terminal_git_activity` -- latest commit per project_slug (using DISTINCT ON)
4. `nexus_sessions` -- count active sessions grouped by project_name
5. `swarm_tasks` -- count queued/running grouped by project

Merge all five result sets into a single array keyed by slug. Cache with `revalidate: 120`.

### `GET /api/deploys`

```
Query params: ?platform=vercel|railway&status=ready|error|building&days=7
Response: {
  deploys: [{ project_slug, platform, status, commit_message, commit_sha,
              deploy_url, duration_ms, created_at }],
  stats: { total, success_rate, avg_duration_ms }
}
```

**Implementation**: Query `terminal_deploys` with filters. Fallback: if table is empty, call Vercel API directly for initial population.

### `GET /api/automations`

```
Response: {
  workflows: [{
    workflow_id, workflow_name, schedule, is_active,
    last_execution: { status, at, duration_ms, error },
    stats: { total_runs, failure_rate }
  }]
}
```

**Implementation**: Query `terminal_automations` from Supabase. The cron collector populates this by calling the n8n API (`GET /api/v1/workflows` and `GET /api/v1/executions`).

### `GET /api/git`

```
Query params: ?days=30&repo=nexus
Response: {
  commits: [{ project_slug, sha, message, author, committed_at, url }],
  repos: [{ slug, commit_count_7d, last_commit }]
}
```

### `GET /api/git/heatmap`

```
Response: {
  days: [{ date: "2026-03-23", count: 5 }, ...],  // 365 entries
  max: 12,  // max commits in a single day (for color scale)
  total: 847
}
```

**Implementation**: Query `terminal_daily_commits` view. Cron job backfills from GitHub API once per day.

### `GET /api/activity`

```
Query params: ?channel=automations&limit=50
Response: {
  events: [{ id, channel_name, author, content, message_type, metadata, created_at }]
}
```

### `GET /api/digest`

```
Query params: ?date=2026-03-23  (defaults to today)
Response: {
  date, summary,
  sections: {
    projects_updated: [...],
    deploys: [...],
    automations: [...],
    git_summary: { total_commits, top_repos },
    swarm: { tasks_completed, tasks_failed },
    notable: [...]
  },
  generated_at
}
```

### `GET /api/swarm`

```
Response: {
  orchestrator: { status, uptime },
  workers: [{ id, name, type, status, current_task, xp, tasks_completed }],
  tasks: { queued, running, blocked, completed_today, failed_today },
  budget: { daily_limit, spent_today, remaining }
}
```

**Implementation**: Queries existing Nexus tables directly: `swarm_workers`, `swarm_tasks`, `swarm_budgets`.

### `GET /api/cron/collect` (Vercel Cron)

Runs every 15 minutes. Collects:
1. Vercel deploys for all tracked projects -> upserts into `terminal_deploys`
2. GitHub commits for all tracked repos -> upserts into `terminal_git_activity` + `terminal_git_heatmap`
3. n8n workflow status -> upserts into `terminal_automations`

**Vercel Cron config** (in `vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/collect",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Auth**: Vercel injects `CRON_SECRET` which the route verifies via `Authorization: Bearer <secret>`.

---

## 6. Estimated File Count and Build Order

### File Count Estimate

| Category | Count |
|----------|-------|
| Pages (`src/app/**/page.tsx`) | 10 |
| Layouts (`src/app/**/layout.tsx`) | 2 |
| API Routes (`src/app/api/**/route.ts`) | 10 |
| Shared UI components (`src/components/ui/`) | 12 |
| Feature components (`src/components/`) | 25 |
| Lib files (`src/lib/`) | 10 |
| Config files (root) | 8 |
| Supabase migration | 1 |
| **Total** | **~78 files** |

### Build Order (4 Phases)

#### Phase 1: Foundation (Day 1)
Skeleton app, data layer, and one working page.

1. `npx create-next-app@latest the-terminal` (Next.js 16, TypeScript, Tailwind v4, App Router)
2. Install deps: `@supabase/supabase-js`, `lucide-react`, `class-variance-authority`, `clsx`
3. Init shadcn/ui: `npx shadcn@latest init` -> add card, badge, button, tooltip, skeleton, separator, scroll-area, table
4. Set up `src/lib/supabase.ts` (server + client), `src/lib/types.ts`, `src/lib/constants.ts`
5. Run Supabase migration (new tables + seed data)
6. Build root layout with Geist fonts, dark theme, StatusRibbon, Sidebar
7. Build `GET /api/projects` route
8. Build Overview page (`/`) with ProjectGridCompact + MetricsRibbon
9. Deploy to Vercel, configure `theterminal.buildkit.store` DNS via Cloudflare

**Deliverable**: Live site with project grid showing real data.

#### Phase 2: Core Pages (Days 2-3)
The three most-used pages.

10. Build `GET /api/deploys` + `GET /api/cron/collect` (Vercel deploy collector)
11. Build Deploy Timeline page (`/deploys`)
12. Build `GET /api/git` + `GET /api/git/heatmap`
13. Build Git Activity page (`/git`) with ContributionHeatmap + CommitTimeline
14. Build full Projects page (`/projects`) with FilterBar + ProjectGrid
15. Build Project Detail page (`/projects/[slug]`)

**Deliverable**: Full project visibility, deploy history, git heatmap.

#### Phase 3: Automation & Activity (Days 4-5)
n8n integration, Discord feed, swarm monitor.

16. Build `GET /api/automations` + n8n data collection in cron
17. Build Automations page (`/automations`)
18. Build `GET /api/activity` + Discord log ingestion (webhook endpoint)
19. Build Activity page (`/activity`) with Realtime subscription
20. Build `GET /api/swarm` (reuses Nexus Supabase tables directly)
21. Build Swarm Monitor page (`/swarm`) with WorkerFleet + TaskKanban + BudgetGauge

**Deliverable**: Full operational visibility.

#### Phase 4: Digest & Polish (Day 6)
Morning digest, command palette, responsive design.

22. Build `GET /api/digest` + `POST /api/digest/generate`
23. Build Digest page (`/digest`) + historical navigation
24. Add CommandPalette (Ctrl+K) for quick navigation
25. Mobile responsive pass on all pages
26. Add `GET /api/health` for uptime monitoring
27. Add loading skeletons for all pages
28. Performance audit: verify <100KB JS per page, <2s LCP

**Deliverable**: Complete dashboard, polished and performant.

---

## 7. What Can Be Reused From Existing Projects

### From Nexus (`C:/Users/Kruz/Desktop/Projects/nexus/`)

| Artifact | Path | Reuse Strategy | Notes |
|----------|------|---------------|-------|
| Supabase client | `src/lib/supabase.ts` | Copy + adapt | Same pattern, same Supabase instance |
| Ops types | `src/lib/ops-types.ts` | Copy directly | `OpsTask`, `OpsWorker`, `OpsBudget`, `OpsEvent`, plus all utility functions: `formatTimeAgo`, `formatDuration`, `getProjectColor`, `PROJECT_COLORS`, `workerDisplayName`, `xpToLevel` |
| Collector types | `src/lib/collector-types.ts` | Copy `NexusSession` type | Needed for session display |
| Agent types | `src/lib/types.ts` | Copy `AgentActivity` type | For swarm monitor |
| StatusRibbon | `src/components/ops-center/StatusRibbon.tsx` | Fork + rebrand | Change "NEXUS" to "THE TERMINAL", same Palantir aesthetic. Keep metric cells, clock, command hint. ~215 lines |
| IntelFeed | `src/components/ops-center/IntelFeed.tsx` | Fork for ActivityFeed | Event synthesis pattern is perfect for Discord activity feed. Replace agent/session events with Discord log events. ~470 lines, significant adaptation needed |
| WorkerFleet | `src/components/ops/WorkerFleet.tsx` | Copy directly | Swarm page worker display |
| KanbanBoard | `src/components/ops/KanbanBoard.tsx` | Copy directly | Swarm page task kanban |
| Sparkline | `src/components/sparkline.tsx` | Copy directly | Mini charts for automation execution history |
| Dashboard charts | `src/components/charts/dashboard-charts.tsx` | Copy chart components | Task trend and cost trend charts |
| Loading states | `src/components/loading-states.tsx` | Fork | Skeleton patterns for each page type |
| UI primitives | `src/components/ui/*` | Copy all 12 files | badge, button, card, progress, scroll-area, separator, sheet, skeleton, table, toast, tooltip. Already styled for dark theme |
| Git activity route | `src/app/api/git-activity/route.ts` | Fork + enhance | Add GitHub token auth, expand tracked repos list, store results in Supabase instead of returning directly. ~100 lines |
| Deploy route | `src/app/api/deploy/route.ts` | Reference | `DEPLOY_CONFIG` mapping is useful for project-platform associations |
| Today route | `src/app/api/today/route.ts` | Reference pattern | Parallel Supabase queries + aggregation in a single API call |

### From Admin Dashboard (`C:/Users/Kruz/Desktop/Projects/admin-dashboard/`)

| Artifact | Path | Reuse Strategy | Notes |
|----------|------|---------------|-------|
| GitHub client | `src/lib/github.ts` | Copy + adapt | `githubFetch` helper with token auth, `getRecentEvents` function. Better than Nexus version because it supports `GITHUB_TOKEN`. ~70 lines |
| Vercel client | `src/lib/vercel.ts` | Copy directly | `vercelFetch`, `getDeployments`, `getProject`, `getProjects`. Exactly what we need, no changes required. ~93 lines |
| Types | `src/lib/types.ts` | Copy `DeploymentInfo`, `ProjectInfo`, `GitEvent` types | Core data shapes for deploy + git display |
| Constants | `src/lib/constants.ts` | Fork | `GITHUB_USERNAME`, `VERCEL_PROJECT_IDS` -- expand the project ID map |
| ProjectStatusPanel | `src/components/ProjectStatusPanel.tsx` | Fork for ProjectCard | Deploy status dots, state-to-color mapping, timeAgo formatting. Adapt to match Palantir design |
| GitActivityPanel | `src/components/GitActivityPanel.tsx` | Fork for CommitTimeline | Timeline UI with icons, repo grouping, commit messages. ~93 lines, convert to dark theme |
| Supabase lib | `src/lib/supabase.ts` | Reference | Realtime subscription pattern with channel cleanup. The `subscribeTo*` factory pattern is worth copying |

### From Neither (Must Build New)

| Component | Reason |
|-----------|--------|
| **ContributionHeatmap** | Nexus has an ASCII heatmap (`ActivityHeatmap.tsx`), but The Terminal needs a proper GitHub-style 365-day SVG/CSS grid. New component, ~150-200 lines |
| **n8n API client** (`src/lib/n8n.ts`) | No existing integration anywhere. Build a client that calls `GET /api/v1/workflows`, `GET /api/v1/executions` with API key auth. ~60 lines |
| **Digest generator** | New feature. API route that aggregates all data sources and optionally calls Claude for natural-language summary. ~150 lines |
| **Cron collector** (`/api/cron/collect`) | New feature. Periodic data aggregation into Supabase cache tables. The heart of the cache-first architecture. ~200 lines |
| **Sidebar navigation** | Nexus uses a top navbar. The Terminal needs a narrow left sidebar (48-56px collapsed, 200px expanded) for the ops-center feel. ~100 lines |
| **CommandPalette** | Nexus has one but it's tightly coupled to spawn/task functionality. Build a simpler nav-focused version with search. ~120 lines |
| **BudgetGauge** | Circular or bar gauge showing daily spend vs limit. New visual component. ~80 lines |

---

## Design Tokens

Carried from user's established Palantir/DoD aesthetic (documented in Nexus overhaul memory):

```
Background root:    #080b12
Background panels:  #0c1018
Background alt:     #0a0a0f
Borders:            #1a2235
Text primary:       #e2e8f0
Text secondary:     #94a3b8
Text muted:         #64748b
Text dim:           #334155

Cyan (primary):     #22d3ee / #06b6d4
Emerald (success):  #34d399 / #10b981
Amber (warning):    #fbbf24 / #e8a019
Red (error):        #f87171 / #ef4444
Purple (accent):    #a78bfa / #8b5cf6

Font heading:       Geist Sans
Font mono/data:     Geist Mono
Font size data:     11px
Font size labels:   10px (uppercase, letter-spacing: 0.08-0.12em)
Font size metadata: 9px
```

---

## Environment Variables

```env
# Supabase (same instance as Nexus -- ytvtaorgityczrdhhzqv)
NEXT_PUBLIC_SUPABASE_URL=https://ytvtaorgityczrdhhzqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# GitHub (for 5000 req/hr rate limit instead of 60)
GITHUB_TOKEN=<personal-access-token>

# Vercel (for deploy status)
VERCEL_API_TOKEN=<vercel-token>
VERCEL_TEAM_ID=<optional>

# n8n (for workflow status)
N8N_API_URL=https://automation-playground-production.up.railway.app
N8N_API_KEY=<from automation-playground .env>

# Cron security (Vercel injects this for cron routes)
CRON_SECRET=<random-secret>
```

---

## Key Decisions Summary

1. **Separate project, shared Supabase.** The Terminal is its own repo and Vercel deploy, but reads from the same Supabase instance (`ytvtaorgityczrdhhzqv`) as Nexus. New tables are prefixed with `terminal_` to avoid collision with `nexus_` and `swarm_` tables.

2. **Cache-first architecture.** External APIs (GitHub, Vercel, n8n) are polled by a Vercel Cron job every 15 minutes, results stored in Supabase. Pages read from Supabase, never directly from external APIs on page load. This means pages load fast, rate limits are never hit, and the cron job is the single point of external API contact.

3. **No client-side data fetching library.** Server Components for initial data, Supabase Realtime for live updates on pages that need it (`/swarm`, `/activity`). No SWR, no React Query, no axios. Keeps the JS bundle lean.

4. **Read-only dashboard.** The Terminal does not trigger deploys, spawn tasks, or modify anything. It is purely observational. Actions continue to be taken through Discord/Terminal or through Nexus directly.

5. **Progressive enhancement.** Phase 1 delivers a useful project grid in a single day. Each subsequent phase adds a complete feature set. The site is useful from the very first deploy.

6. **Heavy reuse from Nexus + Admin Dashboard.** Approximately 40% of the code can be copied or forked from existing projects. The Palantir design language is already established. The Supabase schema already covers swarm/session data. The main new work is the cron collector, the n8n client, the contribution heatmap, and the digest system.
