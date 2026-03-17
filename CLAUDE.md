# Nexus

AI agent swarm platform with real-time factory visualization. Monitors, spawns, and orchestrates Claude Code agents across all projects.

## Stack
- Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Framer Motion, React Three Fiber
- Supabase Realtime for live updates (no polling)
- Python executor v3 (parallel, handoffs, memory, model routing) + scheduler v2 (predictive)
- Tauri v2 desktop app with smart loader
- Python SDK for agent integration

## Architecture
- **Frontend**: 17 pages at `src/app/*/page.tsx`
- **API Routes**: 26+ endpoints at `src/app/api/*/route.ts`
- **Supabase**: 14 tables on `ytvtaorgityczrdhhzqv`
- **Executor v3**: `executor.py` — legacy standalone executor (DEPRECATED: use swarm package)
- **Swarm Package**: `swarm/` — unified orchestration system:
  - `orchestrator.py` — daemon: worker scaling, health, budgets, scouts, oracle
  - `teams.py` — multi-agent team coordination with shared goals
  - `worktree.py` — git worktree isolation for parallel agent work
  - `workers/base.py` — base worker with memory, persona, quality gate, specialization tracking, chain_next handoffs
  - `workers/light_worker.py` — Haiku API worker (fast, cheap tasks)
  - `workers/cc_light_worker.py` — Claude Code CLI worker with worktree support (strategic tasks)
  - `workers/heavy_worker.py` — Claude Code CLI worker with worktree + auto-merge (code changes)
  - `workers/browser_worker.py` — Playwright browser automation
  - `tasks/task_manager.py` — DAG dependencies, output chaining, failure propagation, priority inheritance, affinity-based assignment
  - `goal_decomposer.py` — breaks goals into structured task DAGs with cycle detection
  - `memory.py` — shared context bank with relevance scoring, cross-project learning
  - `config.py` — project registry, model routing, budget limits
- **Scheduler v2**: `scheduler.py` — cron + workflow pipelines
- **Context Library**: `contexts/` — auto-loaded markdown files
- **Desktop**: `src-tauri/` — Tauri v2 with smart loader, daemon watchdog, devtools
- **Scripts**: `scripts/` — 47+ operational scripts

## Pages
| Route | Purpose |
|-------|---------|
| `/` | Main dashboard with live agents, sessions, radiant quests |
| `/today` | Personal dashboard: today's tasks, costs, rankings, intelligence |
| `/command` | Work logs + mini kanban |
| `/command-center` | Bloomberg-terminal overview |
| `/ops` | Task kanban + worker fleet + pipeline view |
| `/game` | 3D isometric factory (Three.js) |
| `/oracle` | AI decision engine |
| `/oracle/chat` | Conversational oracle |
| `/sessions` | Session history with CSV export |
| `/templates` | Mission template library (6 default + 5 Deere + 8 personal) |
| `/workflows` | Multi-step pipeline builder (5 presets: standup, ship, close, variance, review) |
| `/fusion` | Cross-project intelligence + git activity + export |
| `/costs` | Cost tracking dashboard: daily spend chart, project breakdown, budget alerts |
| `/achievements` | Trophy gallery (16 achievements) |
| `/setup` | Onboarding wizard |
| `/settings` | API connection manager |
| `/mobile` | ASCII terminal view |

## API Routes
| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/agents` | GET | Public | List agents |
| `/api/agents/seed` | POST | Public | Demo data |
| `/api/collector/event` | POST | Public | Hook events from Claude Code |
| `/api/collector/agents` | GET | Public | Live sessions |
| `/api/sessions` | GET | Public | Session history |
| `/api/tasks` | GET | Public | Task query with filters |
| `/api/tasks/approve` | POST | API Key | Approve/reject pending tasks |
| `/api/spawn` | POST | API Key | Create mission |
| `/api/teams` | GET/POST | API Key | Agent team management (create, list, progress) |
| `/api/dag` | GET | Public | DAG topology: nodes, edges, stats, critical path, bottlenecks |
| `/api/metrics` | GET | Public | Live system metrics: throughput, latency, error rates, health score |
| `/api/deploy` | GET/POST | API Key | Deploy management |
| `/api/heartbeat` | POST | Public | Agent heartbeat |
| `/api/radiant` | GET | Public | Auto-generated quest suggestions |
| `/api/webhook` | POST | API Key | External triggers |
| `/api/oracle` | GET | Public | Oracle briefings |
| `/api/oracle/chat` | POST | Public | Oracle conversation |
| `/api/oracle/decisions` | GET/POST | Public | Decision management |
| `/api/discord/notify` | POST | API Key | Discord notifications |
| `/api/workflows` | POST | API Key | Execute workflow pipeline |
| `/api/git-activity` | GET | Public | Recent GitHub commits across repos |
| `/api/today` | GET | Public | Aggregated daily dashboard data |
| `/api/patterns` | GET | Public | Task patterns, worker rankings, failure hotspots, cross-project trends |
| `/api/memory` | GET | Public | Shared agent memory query |
| `/api/alerts` | GET | Public | Real-time anomaly detection |
| `/api/export` | GET | Public | CSV/JSON report export |
| `/api/schedules` | GET/POST/DELETE | Public | Schedule management |
| `/api/building-activity` | GET | Public | Building stats |
| `/api/costs` | GET/POST | Public | Cost tracking: log usage, query costs |
| `/api/costs/alerts` | GET/POST/DELETE | Public | Budget alert management |

## Supabase Tables
- `nexus_sessions` — Claude Code session tracking (Realtime enabled)
- `nexus_hook_events` — Individual tool use events (Realtime enabled)
- `nexus_schedules` — Cron-based scheduled tasks + workflow_steps + predictive source
- `swarm_tasks` — Task queue (queued/running/completed/failed/pending_approval/approved/blocked)
- `swarm_workers` — Worker registry with XP tracking
- `swarm_budgets` — Daily budget tracking
- `swarm_task_log` — Task event log
- `swarm_memory` — Shared agent memory (output summaries across tasks)
- `swarm_budgets` — Daily budget tracking
- `agent_activity` — Agent heartbeats
- `agent_specializations` — Per-project/task_type success patterns + best practices
- `swarm_teams` — Agent team coordination (Realtime enabled)
- `oracle_decisions` — Decision history
- `cost_tracking` — API usage costs: tokens, model, cost_usd per task
- `cost_budget_alerts` — Budget threshold alerts (daily/weekly/monthly)

## Key Commands
```bash
npm run dev                          # Start dev server
npm run build                        # Production build
python executor.py --loop            # Start executor daemon (1 worker)
python executor.py --loop --workers 3  # Start with 3 parallel workers (DEPRECATED)
python -m swarm.orchestrator             # Start swarm orchestrator daemon (preferred)
python scheduler.py --loop           # Start scheduler daemon
python scripts/ops/weekly-retrospective.py  # Generate weekly report
python scripts/ops/morning-briefing.py      # Generate morning brief
python -m pytest tests/ -v           # Run test suite
python scripts/run.py                # List all scripts
nexus.bat start                      # Launch desktop app
```

## Executor v3 Features
- **Parallel execution**: `--workers N` flag (default 3, max 5), ThreadPoolExecutor
- **Agent handoff**: `chain_next` in input_data auto-spawns follow-up tasks
- **Shared memory**: Stores output summaries in swarm_memory, recalls before execution
- **Cost optimization**: Auto-routes to haiku/sonnet/opus based on task keywords
- **Specialization**: Tracks success/fail per project+task_type, loads best practices
- **Approval gates**: Pauses at wait_for_approval steps, notifies Discord
- **File I/O**: Reads xlsx, pdf, csv + saves output to nexus/output/
- **Context library**: Auto-loads from contexts/ based on project and task type
- **Dependency unblocking**: Moves blocked tasks to queued when deps complete

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `NEXT_PUBLIC_NEXUS_API_KEY` — API key for frontend (baked at build time)
- `NEXUS_API_KEY` — API auth (server-side, default: nexus-hive-2026)
- `ANTHROPIC_API_KEY` — For executor + oracle
- `DISCORD_WEBHOOK_URL` — Notification webhook

## Design
- Background: #0a0a0f
- Font: JetBrains Mono
- Primary: #06b6d4 (cyan)
- Success: #10b981 (emerald)
- Warning: #e8a019 (amber)
- Error: #ef4444 (red)
- Effects: Scanline overlay, particle network, Framer Motion animations
