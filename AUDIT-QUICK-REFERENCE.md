# Nexus Quick Reference Guide

## Pages at a Glance

```
/ (main)          → Live agents, cost tracking, mission spawn
/today            → Personal dashboard, daily metrics
/command          → Work logs, mini kanban
/command-center   → System overview, alerts
/ops              → Task kanban, worker fleet
/game             → 3D factory visualization
/oracle           → AI decision engine briefings
/oracle/chat      → Chat with oracle
/sessions         → Session history, CSV export
/templates        → Mission template picker (19 templates)
/workflows        → Pipeline builder (5 presets)
/fusion           → Cross-project intelligence
/achievements     → Trophy gallery (16 achievements)
/setup            → Onboarding wizard
/settings         → API connection manager
/mobile           → ASCII terminal UI
```

## API Routes by Category

### Task Management
- `GET /api/tasks` — Query tasks with filters + aggregates
- `POST /api/tasks/approve` — Approve/reject pending tasks
- `POST /api/spawn` — Create new mission

### Sessions & Tracking
- `GET /api/collector/agents` — Live sessions (last 10 min)
- `GET /api/agents` — All agents
- `POST /api/collector/event` — Hook event ingestion
- `POST /api/heartbeat` — Agent heartbeat

### Workflows & Scheduling
- `POST /api/workflows` — Execute pipeline
- `GET /api/schedules` — List scheduled tasks
- `POST /api/schedules` — Create cron job
- `DELETE /api/schedules/:id` — Remove schedule

### Intelligence
- `GET /api/oracle` — Briefings
- `POST /api/oracle/chat` — Conversational oracle
- `GET /api/oracle/decisions` — Decision history
- `GET /api/patterns` — Success/fail by project+type
- `GET /api/memory` — Shared agent memory

### Integrations
- `GET /api/deploy` — Deployment status
- `POST /api/deploy` — Trigger deploy
- `GET /api/git-activity` — GitHub commits
- `POST /api/discord/notify` — Discord message
- `GET /api/radiant` — Auto-generated quests

### Data Export
- `GET /api/export` — CSV/JSON export
- `GET /api/building-activity` — Factory stats
- `GET /api/today` — Daily aggregates
- `GET /api/alerts` — Anomalies

## Database Tables

### Realtime (Dashboard Updates)
- `nexus_sessions` — Session metadata
- `nexus_hook_events` — Tool use events
- `swarm_tasks` — Task queue
- `agent_activity` — Heartbeats

### Task Orchestration
- `swarm_tasks` — Task queue (main)
- `swarm_workers` — Worker registry
- `swarm_task_log` — Audit trail
- `swarm_budgets` — Daily budgets

### Intelligence
- `swarm_memory` — Shared memory
- `agent_specializations` — Success patterns
- `oracle_decisions` — Decision history
- `nexus_schedules` — Scheduled tasks

## Python Services

```bash
# Executor (task execution engine)
python executor.py --loop                  # Run daemon
python executor.py --loop --workers 3      # 3 parallel

# Scheduler (cron workflows)
python scheduler.py --loop

# Swarm orchestration
python swarm/ orchestrator.py              # Central dispatcher
python swarm/scouts.py                     # Monitoring agents
```

## Key Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-7` | Navigate pages |
| `N` | New mission |
| `R` | Refresh dashboard |
| `Ctrl+K` | Command palette |
| `Esc` | Close dialogs |

## Real-time Subscriptions

```typescript
// Main page subscribes to:
supabase.from('nexus_sessions').on('*')      // Live agent list
supabase.from('nexus_hook_events').on('*')    // Tool use telemetry

// Ops page:
supabase.from('swarm_tasks').on('*')          // Kanban updates

// Workbench:
supabase.from('swarm_tasks').on('UPDATE')     // Task details
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://ytvtaorgityczrdhhzqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXUS_API_KEY=nexus-hive-2026
ANTHROPIC_API_KEY=sk-...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Cost Tracking Formula

```
cost_usd = (input_tokens * $0.001 + output_tokens * $0.003 +
            cache_read * $0.0001 + cache_write * $0.001) / 1000

Example: 1M input + 500K output = $1.00 + $1.50 = $2.50
```

## Task Status Flow

```
queued
   ↓
running
   ↓
[pending_approval] ← Wait for /api/tasks/approve
   ↓
completed  OR  failed  OR  blocked (waiting on dependency)

Special: chain_next in input_data auto-spawns follow-up
```

## Component Dependency Chain

```
Main Page (/)
├── StatsBar              (cost, tokens, tools, agents)
├── LiveFeed              (real-time events)
├── AgentCard × N         (per agent)
├── ActivityTimeline      (event stream)
├── RadiantQuests         (suggested tasks)
├── CommandBar            (global search + hotkeys)
├── SpawnModal            (mission spawner)
└── Workbench             (slide-in task analysis)

Ops Page (/ops)
├── TaskKanban            (drag-drop columns by status)
├── WorkerFleet           (worker status cards)
└── TaskFilter            (project, type, priority)

Game Page (/game)
└── Factory3D             (Three.js + particle effects)
    ├── Building × N      (per task/worker)
    ├── ParticleSystem    (activity visualization)
    └── Interactions      (click to inspect)
```

## File Paths Reference

```
src/
├── app/
│   ├── page.tsx                  (main dashboard)
│   ├── api/                      (26 routes)
│   ├── today/page.tsx            (personal dashboard)
│   ├── ops/page.tsx              (kanban)
│   └── ... (15 more pages)
├── components/
│   ├── live-feed.tsx             (core telemetry)
│   ├── stats-bar.tsx             (metrics)
│   ├── daemon-panel.tsx          (executor status)
│   ├── game3d/                   (Three.js factory)
│   └── ... (30+ more)
├── lib/
│   ├── supabase.ts               (DB client)
│   ├── pricing.ts                (cost calculation)
│   ├── achievements.ts           (trophy system)
│   └── ... (utility hooks)
└── styles/globals.css            (design tokens)

executor.py                        (task engine)
scheduler.py                       (cron + workflows)
swarm/
├── orchestrator.py               (dispatcher)
├── oracle.py                     (AI reasoning)
└── ... (memory, scouts, etc.)
```

## Performance Baseline

| Metric | Target | Status |
|--------|--------|--------|
| API response | <200ms | ✓ (not profiled) |
| Realtime update | <500ms | ✓ |
| Page load | <2s | ? (needs profile) |
| Task execution | 10min timeout | ✓ |

## Critical Gaps to Address

1. **User Authentication** — No multi-user support yet
2. **Error Handling** — Executor needs retry logic
3. **Executor Monitoring** — Health checks incomplete
4. **API Documentation** — No OpenAPI spec
5. **Long-term Metrics** — Only 30-day retention

## Troubleshooting

**Agents not showing on dashboard?**
→ Check `/api/collector/agents` response
→ Verify `nexus_sessions` table has recent records
→ Confirm Realtime subscription active

**Tasks not executing?**
→ Check executor daemon status (`python executor.py --loop`)
→ Verify `ANTHROPIC_API_KEY` in `.env`
→ Check `swarm_tasks` table for queued items

**Realtime updates lagging?**
→ Check Supabase Realtime status (console.cloud.supabase.com)
→ Verify websocket connection in DevTools Network tab
→ Fallback: API polling works but slower

**Deploy integration broken?**
→ Check `/api/deploy` response for error details
→ Verify Vercel API token configured
→ Check CORS headers

## Key Integration Points

| Service | Route | Status |
|---------|-------|--------|
| Anthropic Claude | `/api/oracle`, executor.py | ✓ |
| GitHub | `/api/git-activity` | ✓ |
| Discord | `/api/discord/notify` | ✓ |
| Vercel | `/api/deploy` | ⚠️ Partial |
| Railway | (not integrated) | ✗ |
| Supabase | All endpoints | ✓ |

---

**Last Updated**: 2026-03-16
