# Nexus Plugin System — Quick Start Guide

## What are Plugins?

Plugins are modular extensions that hook into Nexus at 5 critical layers:
- **API Gateway** — intercept task creation, webhooks
- **Task Executor** — customize model selection, post-execution logic
- **Scheduler** — filter schedules, inject parameters
- **Database Events** — react to task status changes
- **UI Components** — custom dashboard widgets

---

## Creating Your First Plugin

### Step 1: Create Plugin Directory

```bash
cd /c/Users/Kruz/Desktop/Projects/agent-mission-control
mkdir -p plugins/my-first-plugin
cd plugins/my-first-plugin
```

### Step 2: Write Plugin Manifest

**`plugin.json`** — Metadata about your plugin
```json
{
  "id": "my-first-plugin",
  "name": "My First Plugin",
  "version": "1.0.0",
  "type": "executor",
  "hooks": ["pre_execution"],
  "author": "your-github-handle",
  "description": "Example plugin that logs all task starts",
  "config": {
    "log_level": "info"
  }
}
```

### Step 3: Implement Plugin Handler

**`main.ts`** (TypeScript API plugin) or **`main.py`** (Python executor plugin)

```typescript
// plugins/my-first-plugin/main.ts
import { ExecutorPlugin } from "@/lib/plugins";

export const plugin: ExecutorPlugin = {
  id: "my-first-plugin",
  name: "My First Plugin",

  async pre_execution(task) {
    console.log(`[Plugin] Starting task: ${task.id}`);
    return task;  // Pass through unchanged
  },

  async post_execution(task, result) {
    console.log(`[Plugin] Task ${task.id} completed in ${result.duration_ms}ms`);
  },

  async onError(task, error) {
    console.error(`[Plugin] Task ${task.id} failed:`, error);
  }
};
```

### Step 4: Register Plugin

Add to `plugin_configs` table in Supabase:

```sql
INSERT INTO plugin_configs (plugin_id, plugin_type, enabled, config)
VALUES (
  'my-first-plugin',
  'executor',
  true,
  '{"log_level": "info"}'
);
```

### Step 5: Test

```bash
# Restart executor
python executor.py --loop
```

Plugin will now log all task executions.

---

## Plugin Types & Hooks

### Executor Plugins

Run inside `executor.py`. Hook into task execution.

```python
class ExecutorPlugin:
    async def pre_execution(self, task: Task) -> Task:
        """Modify task before execution."""
        return task

    async def post_execution(self, task: Task, result: Result) -> None:
        """Process results after execution."""
        pass

    async def on_error(self, task: Task, error: Exception) -> None:
        """Handle errors."""
        pass

    async def on_cost_tier_select(self, task: Task) -> str:
        """Return model ID for this task."""
        return "claude-sonnet-4-5"
```

---

### API Gateway Plugins

Run in Next.js. Hook into `/api/spawn`, `/api/workflows`, etc.

```typescript
interface APIGatewayPlugin {
  onTaskCreate?(task: TaskInput): Promise<TaskInput | void>;
  onTaskValidate?(task: TaskInput): Promise<ValidationResult>;
  onTaskSuccess?(task: Task, result: any): Promise<void>;
  onTaskFailed?(task: Task, error: any): Promise<void>;
}
```

---

### Scheduler Plugins

Run in `scheduler.py`. Hook into schedule checks.

```python
class SchedulerPlugin:
    def pre_schedule_check(self, schedules: list) -> list:
        """Filter schedules before checking if due."""
        return schedules

    def on_schedule_spawn(self, schedule: dict, mission: dict) -> dict:
        """Modify mission before spawning."""
        return mission
```

---

### Database Event Plugins

React to changes in `swarm_tasks`, `nexus_sessions`, etc.

```typescript
interface DatabaseEventPlugin {
  onTaskStatusChanged?(event: {
    task_id: string;
    old_status: string;
    new_status: string;
  }): Promise<void>;

  onSessionCreated?(session: Session): Promise<void>;
}
```

---

### UI Plugins

Custom React components for dashboard.

```typescript
interface DashboardWidgetPlugin {
  id: string;
  title: string;
  component: React.FC<{ data: any }>;
  fetchData: () => Promise<any>;
  refreshInterval?: number;  // ms
  icon?: React.ReactNode;
}
```

---

## Common Plugin Recipes

### Recipe 1: Slack Notifications on Task Completion

**File**: `plugins/slack-notifier/main.py`

```python
import urllib.request
import json

class SlackNotifierPlugin:
    def __init__(self, config):
        self.webhook_url = config["webhook_url"]

    async def post_execution(self, task, result):
        if task.status == "completed":
            msg = {
                "text": f"✅ Task completed: {task.title}",
                "blocks": [
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": f"*{task.title}*\nProject: {task.project}"}
                    }
                ]
            }
            urllib.request.urlopen(
                urllib.request.Request(
                    self.webhook_url,
                    data=json.dumps(msg).encode(),
                    headers={"Content-Type": "application/json"}
                )
            )
```

**Config**:
```json
{
  "plugin_id": "slack-notifier",
  "plugin_type": "executor",
  "enabled": true,
  "config": {
    "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}
```

---

### Recipe 2: Custom Cost Routing

**File**: `plugins/smart-cost-router/main.py`

```python
class SmartCostRouterPlugin:
    async def on_cost_tier_select(self, task):
        # High-stakes tasks → always Opus
        if any(kw in task.title.lower() for kw in ["audit", "review", "critical"]):
            return "claude-opus-4-6"

        # Light tasks → Haiku (cheaper)
        if any(kw in task.title.lower() for kw in ["status", "check", "ping"]):
            return "claude-haiku-4-5"

        # Everything else → Sonnet (balanced)
        return "claude-sonnet-4-5"
```

---

### Recipe 3: Budget Gatekeeper

**File**: `plugins/budget-enforcer/main.py`

```python
class BudgetEnforcerPlugin:
    def __init__(self, config):
        self.daily_limit = config.get("daily_limit_usd", 50)

    async def pre_fetch_tasks(self, worker_id):
        # Check today's spend
        today_spent = get_today_spent()

        if today_spent >= self.daily_limit:
            # Skip non-critical tasks
            tasks = fetch_tasks()
            return [t for t in tasks if t.priority > 80]
        return fetch_tasks()

    def get_today_spent(self):
        # Query Supabase for today's cost sum
        ...
```

---

### Recipe 4: GitHub Integration

**File**: `plugins/github-integrator/main.ts`

```typescript
export const plugin: APIGatewayPlugin = {
  async onTaskSuccess(task, result) {
    if (task.project.startsWith("pc-bottleneck")) {
      // Auto-create PR with results
      await createGitHubPR({
        repo: "pc-bottleneck-analyzer",
        branch: `task-${task.id}`,
        title: `${task.title} (#${task.id})`,
        body: result.summary
      });
    }
  }
};
```

---

## Plugin Development Best Practices

### ✓ Do

- **Handle errors gracefully** — plugins shouldn't crash the system
- **Log everything** — make debugging easy
- **Use environment variables** for secrets (API keys, webhooks)
- **Keep execution time short** — < 1 second for most hooks
- **Make plugins idempotent** — safe to retry
- **Document your plugin** — README.md in the plugin directory

### ✗ Don't

- Hardcode secrets in code
- Make blocking network calls in `post_execution`
- Assume plugin load order
- Modify task objects without deep copying
- Use infinite loops or background threads
- Call executor from a plugin (would deadlock)

---

## Plugin Examples in Repository

Reference implementations:

1. **`plugins/cost-router/`** — Smart model selection
2. **`plugins/budget-enforcer/`** — Daily spend limits
3. **`plugins/datadog-logger/`** — Observability integration
4. **`plugins/discord-notifier/`** — Task notifications
5. **`plugins/github-integrator/`** — GitHub automation

---

## Troubleshooting

### Plugin not loading?

1. Check `plugin_configs` table — is it enabled?
2. Look in `/logs/` for error messages
3. Verify `plugin.json` syntax (must be valid JSON)
4. Check file path — must be under `plugins/` directory

### Plugin crashing the executor?

1. Add try-catch in your hook handlers
2. Use circuit breaker — disable after 3 errors
3. Check console logs — `python executor.py` (not `--loop`)
4. Test in isolation first — don't load other plugins

### Plugin hooks not being called?

1. Verify hook name matches spec (case-sensitive)
2. Check plugin type — executor hooks won't work in API plugin
3. Print debug logs — `logger.info(f"Hook called: {hook_name}")`
4. Reload plugin — restart executor daemon

---

## Next Steps

1. Read full audit: `AUDIT_PLUGIN_SYSTEM.md`
2. Study reference plugins in `plugins/`
3. Create your first plugin following Recipe #1
4. Test with `python executor.py` (non-daemon)
5. Submit PR with plugin + tests
6. Get peer review before merging

---

**Questions?** Check `AUDIT_PLUGIN_SYSTEM.md` section 2-4 for deep dives.
