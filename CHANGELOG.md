# Changelog

## March 15, 2026 — Mega Build Session

**Total: ~12,000 lines of code across 80+ files in one session.**

### Tier 1: Core Platform (5 features)
- Hook Event Collector — `/api/collector/event` auto-tracks all Claude Code sessions
- Session History page — `/sessions` with cost, token, duration tracking
- Mission Templates — `/templates` with 6 defaults + CRUD
- Agent Spawner — "New Mission" button + Ctrl+K command bar
- Deploy Integration — `/api/deploy` trigger + tracking

### Tier 2: Force Multipliers (5 features)
- Radiant Quest Engine — `/api/radiant` auto-suggests tasks from project state
- Data Fusion Dashboard — `/fusion` cross-project intelligence view
- Discord Notifications — spawn/deploy/alert events to Discord webhook
- Global Keyboard Shortcuts — 1-7 navigate, N=spawn, R=refresh
- API Connection Manager — `/settings` service status + key management

### Tier 3: Polish (3 features)
- Audio System — procedural sounds via Web Audio API
- Achievement System — 16 achievements, toast notifications, trophies page
- Agent Executor — `executor.py` picks up queued tasks, runs via Claude Code CLI

### Infrastructure
- Claude Code hooks wired — `jarvis-event.sh` sends to both Jarvis + Nexus
- Supabase tables: `nexus_sessions`, `nexus_hook_events`, `nexus_schedules`
- Tauri v2 desktop app — daemon watchdog, system tray, auto-restart
- App icon generated (cyan N on dark hexagon)
- Windows startup scripts for executor + Nexus.exe

### Workflow Engine
- Multi-step pipeline system — chain templates with dependency linking
- Visual workflow builder with step editor
- 3 pre-built workflows: Morning Standup, Code Ship, Monthly Close Prep
- Workflow API creates chained `swarm_tasks` with `depends_on`

### Command Center
- Bloomberg-terminal-style overview page
- 3-column layout: missions + sessions | feed | costs + stats
- Real-time updates via Supabase Realtime

### Scheduler
- `scheduler.py` daemon checks schedules every 60 seconds
- Supabase `nexus_schedules` table
- 3 default schedules: morning briefing, weekly report, end-of-day digest
- `/api/schedules` CRUD endpoint

### Testing & Scripts
- 18-test pytest suite — 18/18 passing
- 46 operational scripts across testing/ops/scaling/features/dx
- Script runner: `python scripts/run.py <name>`

### Executor Enhancements
- File I/O: reads input files, prepends as context to prompts
- Supports: txt, csv, json, md, py, ts, tsx, js, sql, yaml

### Documentation
- SPRINT-PLAN.md — 3-month roadmap
- ROADMAP.md — Palantir phases (paused)
- 10 Deere-specific mission templates
- Workbench deep-dive panel for task inspection

### Pages Built
| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Main agent monitoring |
| Command | `/command` | Work logs + kanban |
| Ops Center | `/ops` | Task management |
| Factory | `/game` | 3D isometric view |
| Oracle | `/oracle` | AI decision engine |
| Oracle Chat | `/oracle/chat` | Conversational AI |
| Sessions | `/sessions` | Session history + costs |
| Templates | `/templates` | Mission template library |
| Workflows | `/workflows` | Multi-step pipelines |
| Fusion | `/fusion` | Cross-project intelligence |
| Achievements | `/achievements` | Trophy gallery |
| Setup | `/setup` | Onboarding wizard |
| Settings | `/settings` | API connections |
| Command Center | `/command-center` | Overview dashboard |
| Mobile | `/mobile` | ASCII terminal |

### API Routes (18 total)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents` | GET | List agents |
| `/api/agents/seed` | POST | Demo data |
| `/api/collector/event` | POST | Hook events |
| `/api/collector/agents` | GET | Live sessions |
| `/api/sessions` | GET | Session history |
| `/api/tasks` | GET | Task query |
| `/api/spawn` | POST | Create mission |
| `/api/deploy` | GET/POST | Deploy management |
| `/api/heartbeat` | POST | Agent heartbeat |
| `/api/radiant` | GET | Quest suggestions |
| `/api/webhook` | POST | External triggers |
| `/api/oracle` | GET | Oracle briefings |
| `/api/oracle/chat` | POST | Oracle conversation |
| `/api/oracle/decisions` | GET/POST | Decision management |
| `/api/discord/notify` | POST | Discord notifications |
| `/api/workflows` | POST | Run workflows |
| `/api/schedules` | GET/POST/DELETE | Schedule management |
| `/api/building-activity` | GET | Building stats |
