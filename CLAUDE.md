# Nexus

AI agent swarm platform with real-time factory visualization. Monitors, spawns, and orchestrates Claude Code agents across all projects.

## Stack
- Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Framer Motion, React Three Fiber
- Supabase Realtime for live updates (no polling)
- Python executor + scheduler for task processing
- Tauri v2 desktop app for persistent daemon
- Python SDK for agent integration

## Architecture
- **Frontend**: 15 pages at `src/app/*/page.tsx`
- **API Routes**: 18 endpoints at `src/app/api/*/route.ts`
- **Supabase**: 9 tables on `ytvtaorgityczrdhhzqv`
- **Executor**: `executor.py` — polls queue, runs tasks via Claude Code CLI
- **Scheduler**: `scheduler.py` — cron-based task spawning
- **Desktop**: `src-tauri/` — Tauri v2 with daemon watchdog
- **Swarm**: `swarm/` — full orchestrator with workers, scouts, oracle, supervisor
- **Scripts**: `scripts/` — 46 operational scripts

## Pages
| Route | Purpose |
|-------|---------|
| `/` | Main dashboard with live agents, sessions, radiant quests |
| `/command` | Work logs + mini kanban |
| `/command-center` | Bloomberg-terminal overview |
| `/ops` | Task kanban + worker fleet |
| `/game` | 3D isometric factory (Three.js) |
| `/oracle` | AI decision engine |
| `/oracle/chat` | Conversational oracle |
| `/sessions` | Session history with CSV export |
| `/templates` | Mission template library |
| `/workflows` | Multi-step pipeline builder |
| `/fusion` | Cross-project intelligence |
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
| `/api/spawn` | POST | API Key | Create mission |
| `/api/deploy` | GET/POST | API Key | Deploy management |
| `/api/heartbeat` | POST | Public | Agent heartbeat |
| `/api/radiant` | GET | Public | Auto-generated quest suggestions |
| `/api/webhook` | POST | API Key | External triggers |
| `/api/oracle` | GET | Public | Oracle briefings |
| `/api/oracle/chat` | POST | Public | Oracle conversation |
| `/api/oracle/decisions` | GET/POST | Public | Decision management |
| `/api/discord/notify` | POST | API Key | Discord notifications |
| `/api/workflows` | POST | API Key | Execute workflow pipeline |
| `/api/tasks/approve` | POST | API Key | Approve/reject pending tasks |
| `/api/git-activity` | GET | Public | Recent GitHub commits |
| `/api/schedules` | GET/POST/DELETE | Public | Schedule management |
| `/api/building-activity` | GET | Public | Building stats |

## Supabase Tables
- `nexus_sessions` — Claude Code session tracking (Realtime enabled)
- `nexus_hook_events` — Individual tool use events
- `nexus_schedules` — Cron-based scheduled tasks
- `swarm_tasks` — Task queue
- `swarm_workers` — Worker registry
- `swarm_budgets` — Daily budget tracking
- `swarm_task_log` — Task event log
- `agent_activity` — Agent heartbeats
- `oracle_decisions` — Decision history

## Key Commands
```bash
npm run dev              # Start dev server
npm run build            # Production build
python executor.py --loop    # Start task executor daemon
python scheduler.py --loop   # Start scheduler daemon
python -m pytest tests/ -v   # Run 18-test suite
python scripts/run.py        # List all 46 scripts
python scripts/run.py smoke-test  # Quick health check
nexus.bat start          # Launch desktop app
nexus.bat status         # Check app + daemon status
```

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `ANTHROPIC_API_KEY` — For executor + oracle
- `NEXUS_API_KEY` — API auth (default: nexus-hive-2026)
- `DISCORD_WEBHOOK_URL` — Notification webhook

## Design
- Background: #0a0a0f
- Font: JetBrains Mono
- Primary: #06b6d4 (cyan)
- Success: #10b981 (emerald)
- Warning: #e8a019 (amber)
- Error: #ef4444 (red)
- Effects: Scanline overlay, particle network, Framer Motion animations
