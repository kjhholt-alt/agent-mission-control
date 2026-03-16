# NEXUS 3-Month Sprint Plan

**Owner:** Kruz | **Start:** 2026-03-15 | **Goal:** Make Nexus the command center for all work (Deere + side projects)

---

## Current State (Honest Audit - March 15, 2026)

### What Actually Works
- Supabase: 8/8 tables healthy, Realtime enabled
- Vercel: 6 sites deployed and responding (200)
- Hook events: LIVE — this session's tool calls tracked in real-time
- 3 sessions recorded, 1,000+ tasks processed historically
- 165 commits to Nexus in last 7 days, 257 total across 9 projects
- 13 projects scored, average health 67/100
- executor.py: tested, runs Claude Code tasks, reports back
- Desktop app: builds, launches, but white screen issue on remote URL load
- 46 operational scripts across testing/ops/scaling/features/dx
- 0 failed tasks in queue (clean slate)

### What's Broken or Incomplete
1. ~~**Sessions show cost=$0.00**~~ — FIXED: New `session-cost.sh` hook parses JSONL file for real token usage on Stop event
2. **Desktop app white screen** — WebView2 loads nexus.buildkit.store but React hydration may fail silently
3. ~~**Executor not persistent**~~ — FIXED: Self-registers as swarm_worker, auto-starts via Task Scheduler with crash recovery
4. **No Deere workflows exist** — Nexus has no finance/ops templates or data connectors
5. **Hooks only track tool names** — no context about WHAT the tool did (file paths, outcomes)
6. **No automated testing** — scripts exist but no CI/CD runs them
7. **Radiant quests are generic** — don't know about Deere priorities or deadlines
8. ~~**3D factory uses demo data**~~ — FIXED: Shows real recent activity (ghost workers from completed sessions, live hook events feed). Demo mode only triggers when there's truly zero historical activity

---

## Month 1: MAKE IT RELIABLE (March 15 - April 15)

The factory needs to run 24/7 without you babysitting it.

### Week 1-2: Fix the Foundation
- [x] **Fix desktop app white screen** — Smart loader with connectivity check, local-first fallback, retry UI, devtools in debug builds
- [x] **Make executor auto-start on boot** — Windows Task Scheduler entry via `scripts/register-executor-task.ps1`, crash recovery via `scripts/start-executor.ps1`
- [x] **Fix session cost tracking** — Stop hook now parses session JSONL for real token usage, sends to collector for cost calculation
- [x] **Add error notifications** — executor.py sends Discord alerts on task failure, timeout, and startup/shutdown
- [x] **Clean up 1000 completed tasks** — Archived 1163 old tasks, kept 100 most recent. Cleared FK refs in task_log first.

### Week 3-4: Make It Useful Daily
- [x] **Morning briefing script** — `scripts/ops/morning-briefing.py` — scheduled daily at 7am via Task Scheduler, posts to Discord with sessions, costs, tasks, git activity, infra status, action items
- [x] **Add Deere project templates** — 5 templates: financial analysis, email drafter, meeting prep, report generator, spreadsheet review
- [x] **Add personal project templates** — 8 templates: MoneyPrinter health/P&L, PC Bottleneck SEO, Finance Brief SEO, BuildKit prospecting, BarrelHouse tests, Nexus health check, dependency updates
- [x] **Scheduled health checks** — `health-check.py` runs every 15min via Task Scheduler, checks 9 endpoints (Supabase, Vercel x4, executor, n8n, Discord, queue), posts Discord alert on failure
- [x] **Git activity dashboard** — Fusion page shows real commits across 14 GitHub repos via /api/git-activity

### Deliverable: Nexus runs 24/7, you get a morning briefing, you can spawn missions from phone via Discord

---

## Month 2: DEERE WORKFLOWS (April 15 - May 15)

Build the actual workflows that save you time at work.

### Week 5-6: Finance Automation Foundations
- [x] **Excel/CSV processor agent** — Executor reads .xlsx via openpyxl, .pdf via PyPDF2, plus all text formats. Templates in Mission Templates library.
- [x] **Email drafter agent** — "Draft Email Response" template + finance-email-style.md context auto-loaded
- [x] **Meeting prep agent** — "Meeting Prep" template with structured agenda/talking points output
- [x] **Report generator agent** — "Generate Report" template + finance-report-templates.md context auto-loaded

### Week 7-8: Multi-Step Workflows
- [x] **Workflow engine v1** — Chained steps via /api/workflows with depends_on linking, context passing between steps
- [x] **Approval gates** — Executor pauses at wait_for_approval steps, sets "pending_approval", notifies Discord. /api/tasks/approve endpoint for approve/reject. Executor picks up "approved" tasks.
- [x] **File I/O for agents** — xlsx/pdf/csv reading in executor. Output saved to nexus/output/ with task ID and timestamp. Extended to .log, .html, .xml.
- [x] **Scheduled workflows** — Scheduler supports workflow_steps column for multi-step pipelines. Morning Standup runs 3-step workflow at 7am.
- [x] **Deere context library** — contexts/ dir with 3 finance files (terminology, report templates, email style). Auto-loaded by executor based on project and task type.

### Deliverable: You can say "prepare my monthly close report" and Nexus generates it from your data

---

## Month 3: MULTI-AGENT + INTELLIGENCE (May 15 - June 15)

Make agents work together and get smarter over time.

### Week 9-10: Agent Coordination
- [ ] **Agent-to-agent handoff** — Builder finishes code → Inspector auto-reviews → Deployer auto-deploys
- [ ] **Parallel agent execution** — Run 3-5 agents simultaneously on different projects
- [ ] **Shared memory/context** — Agents read/write to a shared knowledge base (Supabase table)
- [ ] **Agent specialization** — Train agents on your codebase patterns, your writing style, your finance terminology

### Week 11-12: Intelligence Layer
- [ ] **Pattern recognition** — Track what tasks succeed/fail, auto-adjust prompts based on history
- [ ] **Cost optimization** — Auto-route simple tasks to Haiku, complex to Sonnet, critical to Opus
- [ ] **Predictive scheduling** — Based on your patterns, pre-queue Monday morning tasks on Sunday night
- [ ] **Personal dashboard** — Single page showing: Deere tasks for today, side project status, cost this week, agent performance rankings
- [ ] **Weekly retrospective** — Auto-generated report: what agents accomplished, what failed, what to improve

### Deliverable: Nexus anticipates your needs and runs multi-agent workflows with minimal supervision

---

## Key Metrics to Track

| Metric | Current | Month 1 Target | Month 3 Target |
|--------|---------|-----------------|-----------------|
| Daily active sessions | 0-3 | 10+ | 30+ |
| Tasks completed/day | 0 | 5-10 | 20-50 |
| Uptime (executor) | 0% | 95% | 99% |
| Avg task cost | unknown | tracked | <$0.50 |
| Manual hours saved/week | 0 | 2-3 | 8-10 |
| Deere workflows automated | 0 | 4 | 12+ |
| Side project tasks/week | 0 | 10 | 25 |

---

## What NOT to Build

- Multi-tenant/SaaS features (not selling this)
- User auth/login (single user)
- Public API documentation
- Marketing/landing pages for Nexus
- Mobile app (use Discord + phone browser)
- Palantir-grade visualizations (the 3D factory is enough)

---

## Quick Wins (Do This Week)

1. Add `python executor.py --loop` to Windows Task Scheduler (5 min)
2. Create 5 Deere-specific mission templates (15 min)
3. Run `python scripts/ops/daily-digest.py` and schedule via n8n (10 min)
4. Clean up old tasks: `python scripts/scaling/archive-completed-tasks.py --delete` (2 min)
5. Launch Nexus.exe and verify dashboard loads (2 min)
