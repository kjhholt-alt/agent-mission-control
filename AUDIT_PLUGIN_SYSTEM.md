# Nexus Plugin System Architecture Audit
**Date**: 2026-03-17 | **Auditor**: Claude Code | **Status**: Active Analysis

---

## Executive Summary

Nexus has a highly modular, multi-layered architecture with **clear separation of concerns** across the Next.js frontend, API layer, Python executor, scheduler, and database. The system is **already pluggable in multiple ways**, though plugins are currently integrated ad-hoc rather than through a formal plugin system.

**Key Finding**: Nexus is architecturally ready for a **tiered plugin system** with minimal refactoring. Extension points exist at 5 critical layers:
1. **API Gateway** (Next.js routes) — accepts webhooks, tasks, events
2. **Task Executor** (Python) — parallel execution with shared memory
3. **Scheduler** (Python daemon) — cron + workflow pipelines
4. **Data Layer** (Supabase Realtime) — event-driven updates
5. **UI Layer** (React components) — dashboard widgets, visualizations

---

## 1. Current Architecture Overview

### Data Flow (High-Level)

```
External Systems
      ↓
[API Gateway] ← /api/* routes (public + private POST/PUT/DELETE)
      ↓
[Supabase] ← swarm_tasks, nexus_schedules, oracle_decisions, etc.
      ↓
[Python Executor] ← polls swarm_tasks, updates status, stores results
      ↓
[Python Scheduler] ← reads nexus_schedules, spawns missions
      ↓
[Supabase Realtime] → broadcasts to frontend (live updates)
      ↓
[React UI] → displays live feeds, task kanban, 3D factory

```

### Module Hierarchy

```
Frontend (Next.js 16)
├── Pages (17 routes) — dashboard, oracle, game, workflows, etc.
├── API Routes (26 endpoints) — public + protected
├── Components (35+) — reusable UI building blocks
├── Lib (10+ utilities) — types, hooks, Supabase client, Tauri bridge
└── Middleware (auth) — x-nexus-key validation

Python Backend
├── executor.py — main worker, parallel execution, cost routing
├── scheduler.py — cron polling, mission spawning
├── swarm/ — orchestrator, task manager, budget manager, oracle, scouts
└── contexts/ — auto-loaded markdown for prompts (AI Finance, Deere, etc.)

Database (Supabase)
├── swarm_tasks — task queue (queued/running/completed/failed/pending_approval)
├── swarm_workers — worker registry + XP tracking
├── nexus_sessions — Claude Code session tracking
├── nexus_hook_events — tool use telemetry
├── nexus_schedules — cron-based task scheduling
├── swarm_memory — shared memory (output summaries)
├── oracle_decisions — AI decision history
├── swarm_budgets — daily budget tracking
└── swarm_task_log — audit trail (immutable)
```

---

## 2. Identified Extension Points

### Layer 1: API Gateway (`src/app/api/*/route.ts`)

**Current State**: 26 public + protected endpoints, branching at middleware level.

**Extension Points**:

| Route | Method | Auth | Plugin Opportunity |
|-------|--------|------|-------------------|
| `/api/spawn` | POST | Protected | **Task Creation Interceptor** — Pre/post-spawn hooks, task validation, custom payload transformation |
| `/api/tasks` | GET | Public | **Task Query Plugin** — Custom filters, aggregations, formatting |
| `/api/tasks/approve` | POST | Protected | **Approval Workflow Plugin** — Custom approval rules, escalation, notifications |
| `/api/collector/event` | POST | Public | **Event Processor Plugin** — External telemetry ingestion (Datadog, Honeycomb, etc.) |
| `/api/workflows` | POST | Protected | **Workflow Engine Plugin** — Custom step types, validation, state management |
| `/api/oracle` | GET/POST | Public | **Oracle Enhancement Plugin** — Custom decision scoring, briefing formats |
| `/api/deploy` | GET/POST | Protected | **Deployment Plugin** — CI/CD integration (GitHub Actions, Railway, Vercel) |
| `/api/discord/notify` | POST | Protected | **Notification Router Plugin** — Multi-channel alerts (Slack, Teams, email) |
| `/api/webhook` | POST | Protected | **Webhook Handler Plugin** — External event triggers (GitHub push, Stripe charge, etc.) |
| `/api/schedules` | GET/POST | Public | **Schedule Plugin** — Custom cron patterns, timezone support, recurring workflows |

**Example Plugin: Task Validator**
```typescript
// src/app/api/spawn/plugin-task-validator.ts
export interface TaskValidatorPlugin {
  name: string;
  validate(task: TaskInput): ValidationResult;
  transform?(task: TaskInput): TaskInput; // optional: mutate task
}
```

**How to Implement**:
1. Create `src/lib/plugins/` directory
2. Define plugin interface with `validate()`, `transform()`, `onTaskStart()`, `onTaskEnd()`
3. Load plugins in middleware (before route handler)
4. Call plugin hooks at key decision points
5. Store plugin config in Supabase `plugin_configs` table

---

### Layer 2: Python Executor (`executor.py`)

**Current State**: Single executor.py polls tasks, runs Claude CLI, updates status. Parallel workers via ThreadPoolExecutor. Context library auto-loads from `contexts/`.

**Extension Points**:

| Hook | Signature | Plugin Opportunity |
|------|-----------|-------------------|
| **pre_fetch_tasks** | `(worker_id) → filtered_tasks` | Custom task scheduling/prioritization |
| **pre_execution** | `(task) → modified_task` | Task parameter injection, validation |
| **post_execution** | `(task, result, exit_code) → void` | Custom result processing, post-work (upload, notify) |
| **on_cost_tier_select** | `(task) → model` | Custom model routing (e.g., "always use Opus for audits") |
| **on_context_load** | `(task, contexts_dir) → loaded_context` | Custom context injection (project-specific secrets, variables) |
| **on_error_handler** | `(task, exception) → recovery_action` | Custom retry/escalation logic |
| **memory_recall** | `(task) → shared_memory_results` | Custom shared memory queries |
| **file_processor** | `(task, file_path) → parsed_content` | Custom file type handlers (xlsx, pdf, custom formats) |

**Example Plugin: Custom Cost Router**
```python
# plugins/cost_router_plugin.py
class CostRouterPlugin:
    def route(self, task: Task) -> str:
        """Return claude model ID based on custom logic."""
        if task.project == "MoneyPrinter" and "audit" in task.title.lower():
            return "claude-opus-4-6"  # expensive, high-stakes
        if task.cost_tier == "light":
            return "claude-haiku-4-5"
        return "claude-sonnet-4-5"  # default

    def on_register(self, executor):
        executor.cost_router = self
```

**How to Implement**:
1. Create `plugins/` directory in project root
2. Define abstract `ExecutorPlugin` base class with hooks
3. In `executor.py`, add `plugin_registry = {}` and `load_plugins()` function
4. At key points in executor loop, call `for hook in plugin_registry.values(): hook.on_task_start(...)`
5. Store enabled plugins in Supabase `plugin_configs` table with `plugin_type`, `enabled`, `config_json`

---

### Layer 3: Python Scheduler (`scheduler.py`)

**Current State**: Polls `nexus_schedules` table every minute, spawns missions on cron match.

**Extension Points**:

| Hook | Signature | Plugin Opportunity |
|------|-----------|-------------------|
| **pre_schedule_check** | `(schedules) → filtered` | Custom filtering (e.g., skip if budget spent) |
| **on_schedule_spawn** | `(schedule, mission) → modified_mission` | Custom mission param injection |
| **cron_parser** | `(cron_expression) → should_run` | Custom cron syntaxes (readable: "every Monday 9am") |
| **on_schedule_error** | `(schedule, error) → void` | Custom error handling, alerts |
| **workflow_executor** | `(workflow) → results` | Custom multi-step workflow engine |

**Example Plugin: Budget-Aware Scheduler**
```python
# plugins/budget_scheduler_plugin.py
class BudgetSchedulerPlugin:
    def pre_schedule_check(self, schedules):
        """Skip schedules if daily budget exceeded."""
        today_spent = get_daily_spend()
        daily_limit = 100  # dollars

        if today_spent >= daily_limit:
            return [s for s in schedules if s.get("critical")]
        return schedules
```

**How to Implement**:
1. Add `SchedulerPlugin` base class in `swarm/plugin_base.py`
2. In `scheduler.py`, load plugins from `plugins/` directory
3. Call `plugin.pre_schedule_check()` before iterating schedules
4. Store scheduler plugin config separately from executor plugins

---

### Layer 4: Data Layer (Supabase)

**Current State**: 11 tables with Realtime enabled on key tables. Event log is immutable audit trail.

**Extension Points**:

| Table | Plugin Opportunity |
|-------|-------------------|
| `swarm_tasks` | **Task Hook Plugin** — trigger on insert/update/delete (e.g., auto-assign to worker) |
| `nexus_sessions` | **Session Analytics Plugin** — aggregate cost, track trends, flag anomalies |
| `swarm_task_log` | **Audit Logger Plugin** — export to external logging service (Datadog, Splunk) |
| `oracle_decisions` | **Decision Logger Plugin** — record decision rationale, feedback, correctness |
| `swarm_memory` | **Memory Plugin** — custom serialization, compression, TTL policies |
| `plugin_configs` | **New Table** — store plugin state, enabled/disabled, configuration |

**Example: Supabase Trigger** (SQL)
```sql
-- Create plugin_configs table
CREATE TABLE plugin_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_type TEXT NOT NULL,  -- 'executor', 'scheduler', 'api_gateway'
  plugin_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast plugin lookup
CREATE INDEX plugin_configs_type_enabled ON plugin_configs(plugin_type, enabled);

-- Trigger: when swarm_tasks inserted, notify executor
CREATE TRIGGER task_created AFTER INSERT ON swarm_tasks
FOR EACH ROW EXECUTE FUNCTION trigger_on_task_created();
```

**How to Implement**:
1. Add `plugin_configs` table to Supabase schema
2. Create Functions (in Supabase) for each trigger (pre/post insert/update)
3. Functions post to webhook endpoints: `POST /api/plugins/{plugin_type}/{hook_name}`
4. API routes dispatch to registered plugins
5. Store plugin state in `plugin_configs`

---

### Layer 5: UI Layer (React Components)

**Current State**: 17 pages, 35+ components, live Realtime subscriptions.

**Extension Points**:

| Component | Plugin Opportunity |
|-----------|-------------------|
| `/` (Dashboard) | **Dashboard Widget Plugin** — custom cards (cost tracker, team standings) |
| `/game` (3D Factory) | **Game Plugin** — custom 3D objects, visualizations, animations |
| `/ops` (Kanban) | **Board Plugin** — custom swim lanes, filtering, status rules |
| `/oracle` | **Oracle Card Plugin** — custom decision display formats |
| `/workflows` | **Workflow Builder Plugin** — custom step types, validators |
| Component: `LiveFeed` | **Activity Stream Plugin** — custom event formatters |
| Hook: `useRealtimeConnection` | **Realtime Transport Plugin** — alternative backends (Socket.io, gRPC) |

**Example Plugin: Custom Dashboard Widget**
```typescript
// src/lib/plugins/dashboard-widget-plugin.ts
export interface DashboardWidgetPlugin {
  id: string;
  title: string;
  component: React.FC<{ data: any }>;
  fetchData: () => Promise<any>;
  refreshInterval?: number;  // ms
}

// Usage in /page.tsx
import { loadDashboardWidins } from "@/lib/plugins";

export default function Dashboard() {
  const [plugins, setPlugins] = useState<DashboardWidgetPlugin[]>([]);

  useEffect(() => {
    loadDashboardWidgets().then(setPlugins);
  }, []);

  return (
    <div className="grid">
      {plugins.map((p) => (
        <p.component key={p.id} data={...} />
      ))}
    </div>
  );
}
```

**How to Implement**:
1. Create `src/lib/plugins/` directory
2. Define `DashboardWidgetPlugin`, `GamePlugIn`, `BoardPlugIn` interfaces
3. Add `loadPlugins()` hook to fetch from `/api/plugins/list`
4. Create `/api/plugins/*` routes to manage plugin lifecycle
5. Store plugin JS in Supabase `plugin_bundles` (or URL) with allow-list for security

---

## 3. Plugin Integration Patterns

### Pattern A: Middleware Chain (API Gateway)

**Use Case**: Task validators, authentication, rate limiting, request transformation.

**Flow**:
```
POST /api/spawn
  ↓
middleware() — check x-nexus-key
  ↓
[Executor Plugins] — validate task, transform payload
  ↓
[API Gate Plugins] — log, audit, notify
  ↓
Handler — create task in swarm_tasks
  ↓
[Post-Hook Plugins] — index in search, notify Discord
```

**Implementation** (`src/app/api/spawn/route.ts`):
```typescript
const SPAWN_PLUGINS = await loadPlugins("api_gateway", "spawn");

export async function POST(request: NextRequest) {
  let body = await request.json();

  // Pre-hook
  for (const plugin of SPAWN_PLUGINS) {
    if (plugin.transform) {
      body = plugin.transform(body);
    }
  }

  // Create task...

  // Post-hook
  for (const plugin of SPAWN_PLUGINS) {
    if (plugin.onTaskCreated) {
      await plugin.onTaskCreated(task);
    }
  }
}
```

---

### Pattern B: Executor Worker Hook (Task Execution)

**Use Case**: Custom cost routing, context injection, post-execution processing.

**Flow**:
```
[Executor Poll] → fetch tasks from swarm_tasks
  ↓
[Pre-Fetch Plugin] — filter/prioritize
  ↓
[Pre-Execution Plugin] — inject params, select model
  ↓
Run Claude CLI
  ↓
[Post-Execution Plugin] — process results, upload, notify
  ↓
[Error-Handler Plugin] — retry, escalate, fail
  ↓
Update swarm_tasks status
```

**Implementation** (`executor.py`):
```python
EXECUTOR_PLUGINS = load_plugins("executor")

def execute_task(task):
    # Pre-execution hook
    for plugin in EXECUTOR_PLUGINS:
        if hasattr(plugin, "pre_execution"):
            task = plugin.pre_execution(task)

    # Run task...
    result = subprocess.run([...])

    # Post-execution hook
    for plugin in EXECUTOR_PLUGINS:
        if hasattr(plugin, "post_execution"):
            plugin.post_execution(task, result)
```

---

### Pattern C: Realtime Event Stream (Database)

**Use Case**: Custom logging, analytics, external service triggers.

**Flow**:
```
Task Status Updated (INSERT/UPDATE swarm_tasks)
  ↓
Supabase Function → POST /api/plugins/hooks/task_updated
  ↓
[Event Plugins] — process event (log, analyze, trigger)
  ↓
Plugin notifies external service (Datadog, Slack, Discord)
```

**Implementation**:
```typescript
// src/app/api/plugins/hooks/task-updated/route.ts
export async function POST(request: NextRequest) {
  const event = await request.json();  // { task_id, old_status, new_status, ...}

  const plugins = await loadPlugins("realtime_events");

  for (const plugin of plugins) {
    if (plugin.onTaskStatusChanged) {
      await plugin.onTaskStatusChanged(event);
    }
  }
}
```

---

## 4. Plugin Registry & Discovery

### Plugin Manifest Format

```typescript
// plugin.json (committed to repo)
{
  "id": "cost-router",
  "name": "Smart Cost Router",
  "version": "1.0.0",
  "type": "executor",
  "hooks": ["pre_execution", "on_cost_tier_select"],
  "author": "kjhholt-alt",
  "description": "Routes tasks to optimal model based on project & task type",
  "config": {
    "default_model": "claude-sonnet-4-5",
    "opus_keywords": ["audit", "review"],
    "haiku_keywords": ["status", "health"]
  }
}
```

### Plugin Registry (Supabase)

```sql
CREATE TABLE plugin_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_id TEXT UNIQUE NOT NULL,
  plugin_type TEXT NOT NULL,  -- 'executor', 'scheduler', 'api_gateway', 'realtime', 'ui'
  enabled BOOLEAN DEFAULT false,
  config JSONB,
  loaded_by TEXT DEFAULT 'system',  -- who loaded this plugin
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_plugin_type_enabled ON plugin_configs(plugin_type, enabled);
```

### Plugin Loader (Python)

```python
# swarm/plugin_loader.py
def load_plugins(plugin_type: str) -> list:
    """Load enabled plugins from Supabase."""
    configs = supabase.table("plugin_configs").select("*").eq(
        "plugin_type", plugin_type
    ).eq("enabled", True).execute()

    plugins = []
    for config in configs.data:
        plugin_id = config["plugin_id"]
        plugin_module = importlib.import_module(f"plugins.{plugin_id}.main")
        plugin = plugin_module.create_plugin(config["config"])
        plugins.append(plugin)

    return plugins
```

---

## 5. Security Considerations

### Plugin Sandboxing

**Current Risk**: Plugins run in same process, can access all system resources.

**Recommendations**:

1. **Code Review**: Every plugin merged requires peer review + manual security audit
2. **Permission Model**: Plugins declare what they need
   ```json
   {
     "permissions": [
       "read:tasks",
       "write:tasks",
       "execute:claude",
       "notify:discord"
     ]
   }
   ```

3. **Secrets Management**: Plugins don't hardcode secrets
   ```python
   # ❌ Bad
   DISCORD_WEBHOOK = "https://discord.com/api/webhooks/..."

   # ✓ Good
   DISCORD_WEBHOOK = os.environ.get("DISCORD_WEBHOOK_URL")
   # Or from plugin config
   webhook = plugin_config.get("discord_webhook_url")
   ```

4. **Audit Logging**: Log every plugin invocation
   ```python
   log_event("plugin_execution", {
       "plugin_id": plugin.id,
       "hook": hook_name,
       "duration_ms": elapsed,
       "error": error_message
   })
   ```

5. **Circuit Breaker**: Disable plugin if it fails N times
   ```python
   plugin_errors[plugin.id] = (plugin_errors.get(plugin.id, 0) or 0) + 1
   if plugin_errors[plugin.id] >= 5:
       disable_plugin(plugin.id)
   ```

---

## 6. Plugin Examples & Use Cases

### Example 1: Datadog Logger Plugin

**Purpose**: Stream all task events to Datadog for observability.

**Type**: `realtime_events` + `executor`

**Hooks**:
- `pre_execution(task)` — log task start
- `post_execution(task, result)` — log task end + metrics
- `onTaskStatusChanged(event)` — log status transitions

```python
# plugins/datadog-logger/main.py
import datadog

class DatadogLoggerPlugin:
    def __init__(self, config):
        self.api_key = config["api_key"]
        datadog.initialize(api_key=self.api_key)

    def post_execution(self, task, result):
        datadog.api.Metric.send(
            metric="task.execution_time",
            points=result.duration_ms,
            tags=[f"project:{task.project}", f"status:{task.status}"]
        )
```

---

### Example 2: GitHub Integration Plugin

**Purpose**: Auto-create PRs, issues, and comments based on task outcomes.

**Type**: `api_gateway` (webhook handler)

**Hooks**:
- `onTaskApproved(task)` — create feature branch
- `onTaskCompleted(task)` — create PR with results
- `onTaskFailed(task)` — create issue, cc developer

---

### Example 3: Budget Enforcement Plugin

**Purpose**: Pause tasks if daily budget exceeded.

**Type**: `executor` + `scheduler`

**Hooks**:
- `pre_fetch_tasks(worker_id)` — filter out tasks if over budget
- `on_cost_tier_select(task)` — downgrade to cheaper model

---

### Example 4: Custom Dashboard Widget

**Purpose**: Display real-time P&L for MoneyPrinter.

**Type**: `ui`

**Component**:
```typescript
export const MoneyPrinterPnLWidget: DashboardWidgetPlugin = {
  id: "mp-pnl",
  title: "MoneyPrinter P&L",
  component: ({ data }) => (
    <Card>
      <p>Today: ${data.pnl_today}</p>
      <p>This Week: ${data.pnl_week}</p>
    </Card>
  ),
  fetchData: () => fetch("/api/moneyprinter/pnl").then(r => r.json())
};
```

---

## 7. Plugin System Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create `swarm/plugin_base.py` with abstract base class
- [ ] Add `plugin_configs` table to Supabase
- [ ] Implement `plugin_loader.py` — load from filesystem + Supabase
- [ ] Add 3 system plugins (cost-router, budget-enforcer, datadog-logger)
- [ ] Unit tests for plugin loading, error handling

### Phase 2: API Gateway Integration (Week 2-3)
- [ ] Create `/api/plugins/load` endpoint — list enabled plugins
- [ ] Modify `/api/spawn`, `/api/workflows` to call plugin hooks
- [ ] Add plugin management routes (`/api/plugins/enable`, `/api/plugins/disable`)
- [ ] Document plugin manifest format
- [ ] Create "plugin template" repo for developers

### Phase 3: Executor Integration (Week 3-4)
- [ ] Refactor `executor.py` to use plugin system
- [ ] Migrate cost-router, budget-enforcer to plugins
- [ ] Add context-library plugin system
- [ ] Performance testing with 5+ plugins
- [ ] Plugin error handling + circuit breaker

### Phase 4: Database Events (Week 4-5)
- [ ] Create Supabase Functions for task/session events
- [ ] Implement `/api/plugins/hooks/*` webhook handlers
- [ ] Add Datadog logger plugin
- [ ] Add audit log exporter plugin
- [ ] Test with 100+ events/min

### Phase 5: UI Plugins (Week 5-6)
- [ ] Create `src/lib/plugins/` with widget loader
- [ ] Build 3 example widgets (cost tracker, team standings, MoneyPrinter P&L)
- [ ] Add `/api/plugins/list?type=ui` endpoint
- [ ] Document dashboard plugin API
- [ ] Add plugin settings page

### Phase 6: Security & Hardening (Week 6-7)
- [ ] Plugin permission model (read/write/execute)
- [ ] Code review checklist for plugin PRs
- [ ] Secrets management guide
- [ ] Circuit breaker + error monitoring
- [ ] Audit log viewer in settings

### Phase 7: Plugin Marketplace (Week 7-8)
- [ ] Create plugin registry website
- [ ] Build plugin installer CLI
- [ ] Document plugin distribution model
- [ ] Create "plugin badge" for verified plugins
- [ ] Write plugin development guide

---

## 8. Current "De Facto" Plugins

Nexus already has informal plugin patterns:

1. **Context Library** (`contexts/`) — dynamically loaded prompts
   - `ai-finance-brief.md` — context for finance tasks
   - `deere.md` — context for John Deere integration
   - Loaded automatically in `executor.py` by project
   - **→ Formalize as `ContextPlugin` type**

2. **Worker Types** (`executor.py`, `swarm/workers/`)
   - `light_worker`, `cc_light_worker`, `heavy_worker`, `browser_worker`
   - Each handles different cost tiers
   - **→ Could be plugin-based (load at runtime)**

3. **Task Types** (in `swarm_tasks.task_type`)
   - `eval`, `scout`, `build`, `review`, `analyze`
   - Routed to specific workers
   - **→ Could be plugin-dispatched (custom task handlers)**

4. **Oracle Behaviors** (`swarm/oracle.py`)
   - Briefing generation, daily digest, weekly report
   - Hard-coded business logic
   - **→ Should be plugin hooks (custom report formatters)**

---

## 9. Recommended Actions

### Immediate (This Week)
1. ✅ **Document plugin extension points** (this audit)
2. 📋 **Create plugin_configs table** in Supabase
3. 📝 **Write plugin manifest spec** (JSON schema)
4. 🔧 **Implement plugin_loader.py** (load from `plugins/` dir)

### Short-term (Next 2 Weeks)
1. 🔌 **Integrate plugins into executor.py** — pre_execution, post_execution hooks
2. 🔌 **Integrate plugins into API routes** — /api/spawn, /api/workflows
3. 📚 **Create plugin template repo** — copy-paste starter
4. 🧪 **Build 3 reference plugins** — cost-router, budget-enforcer, discord-notifier

### Medium-term (Month 2)
1. 🎨 **Build UI plugin system** — custom dashboard widgets
2. 🌐 **Create /api/plugins/* endpoints** — plugin management API
3. 📊 **Add plugin monitoring** — execution time, errors, audit logs
4. 🔐 **Implement permission model** — what plugins can/cannot do

### Long-term (Q2 2026)
1. 🏪 **Plugin marketplace** — discover + install community plugins
2. 📦 **Plugin distribution** — npm packages, GitHub releases
3. 🤝 **Partner ecosystem** — Vercel, Railway, Supabase integrations
4. 🧑‍💻 **Plugin development SDK** — published npm package `@nexus/sdk`

---

## 10. Appendix: File Structure for Plugin System

```
agent-mission-control/
├── src/
│   ├── app/api/
│   │   ├── plugins/
│   │   │   ├── load/route.ts           — GET /api/plugins/load
│   │   │   ├── enable/route.ts         — POST /api/plugins/enable
│   │   │   ├── disable/route.ts        — POST /api/plugins/disable
│   │   │   └── hooks/
│   │   │       ├── task-updated/route.ts
│   │   │       └── task-created/route.ts
│   │   └── spawn/route.ts              — (modified with plugin hooks)
│   └── lib/
│       ├── plugins/
│       │   ├── plugin-base.ts          — Plugin interface
│       │   ├── plugin-loader.ts        — Load from Supabase
│       │   ├── dashboard-widgets.ts    — UI plugin system
│       │   └── types.ts                — PluginConfig, PluginManifest
│       └── supabase.ts                 — (add plugins table)
├── plugins/                            — Plugin directory
│   ├── cost-router/
│   │   ├── plugin.json
│   │   └── main.ts
│   ├── budget-enforcer/
│   │   ├── plugin.json
│   │   └── main.ts
│   └── discord-notifier/
│       ├── plugin.json
│       └── main.ts
├── swarm/
│   ├── plugin_loader.py                — Load Python plugins
│   ├── plugin_base.py                  — Abstract base class
│   └── plugins/                        — Python plugins
│       ├── datadog_logger/
│       └── github_integrator/
├── PLUGIN_DEVELOPMENT.md               — Plugin dev guide
├── PLUGIN_MANIFEST_SPEC.md             — JSON schema
└── PLUGIN_EXAMPLES.md                  — Reference implementations
```

---

## Summary Table: Extension Points Ranked by Impact

| Rank | Layer | Extension Point | Effort | Impact | Security Risk |
|------|-------|-----------------|--------|--------|-----------------|
| 1 | API | `/api/spawn` task validator | Low | High | Low |
| 2 | Executor | pre_execution hook | Low | High | Medium |
| 3 | Executor | post_execution hook | Low | High | Medium |
| 4 | Scheduler | pre_schedule_check | Low | Medium | Low |
| 5 | Database | nexus_schedules triggers | Medium | High | Medium |
| 6 | UI | Dashboard widgets | Medium | Medium | Low |
| 7 | API | `/api/oracle` responses | Low | Medium | Low |
| 8 | Executor | Error handlers | Medium | Medium | Medium |
| 9 | Data | Event stream processors | Medium | Medium | High |
| 10 | Executor | Memory recall | Low | Low | Low |

---

**Status**: Ready for implementation. Recommend starting with Phase 1 (Foundation) immediately.
