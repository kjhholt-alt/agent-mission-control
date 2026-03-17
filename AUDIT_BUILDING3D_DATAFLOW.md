# Audit: Building3D/GameCanvas Worker-to-Building Data Flow

**Date**: 2026-03-16
**Scope**: Complete data propagation from swarm workers → Supabase → GameCanvas 3D visualization
**Status**: ✅ Comprehensive & functional; notes on optimization potential

---

## Executive Summary

The data flow from swarm workers to the Building3D/GameCanvas visualization is **well-structured and functional**, with clear separation between data sources, transformation logic, and 3D rendering. Real-time Supabase subscriptions keep the visualization synchronized with live worker/task activity.

**Key strengths:**
- Multi-source data integration (swarm_workers, swarm_tasks, nexus_sessions, swarm_budgets, agent_activity, nexus_hook_events)
- Synthetic worker generation from active Claude Code sessions
- "Ghost worker" fallback for recently completed activity
- Deterministic worker-to-building mapping
- Event deduplication and completion detection
- Demo mode with graceful degradation

**Potential optimization areas:**
- Subscription consolidation (6 independent table subscriptions)
- Building status computation on every render
- Task filtering inefficiency for large datasets

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEXUS GAME PAGE (page.tsx)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Stateful page maintains:                                               │
│  - hoveredBuilding, selectedBuilding, selectedWorker                    │
│  - Passes state to GameCanvas + sidebar components                      │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       │ calls
                       ▼
    ┌──────────────────────────────────────────┐
    │       useGameData() Hook                  │
    │  (src/components/game3d/useGameData.ts)   │
    └──────────────────────────────────────────┘
            │
            ├─ Initial fetch (useEffect #1)
            ├─ Realtime subscriptions (useEffect #2)
            └─ Data transformation & business logic
                 │
                 ├─ Maps swarm rows → game types
                 ├─ Worker-to-building assignment
                 ├─ Conveyor activation logic
                 ├─ Demo/ghost worker fallback
                 └─ Returns: GameData interface
                    {
                      workers: Worker[],
                      buildings: Building[],
                      conveyors: ConveyorBelt[],
                      events: AlertEvent[],
                      budget, isDemo, workerCounts, completedTaskIds
                    }
                       │
                       │ passed as props
                       ▼
    ┌──────────────────────────────────────────┐
    │         GameCanvas Component              │
    │   (src/components/game3d/GameCanvas.tsx)  │
    └──────────────────────────────────────────┘
            │
            ├─ Receives: workers[], buildings[], conveyors[]
            ├─ Canvas setup (Three.js, lights, fog)
            └─ Renders components:
                 │
                 ├─ Building3D (per building)
                 ├─ CommandCenter3D (special case)
                 ├─ Worker3D (per worker)
                 ├─ ConveyorBelt3D (per conveyor)
                 ├─ DataPackets (animated)
                 ├─ ParticleEffects (sparkles, bursts)
                 └─ SelectionRings (hover/select feedback)
```

---

## Data Sources: Supabase Tables

### 1. **swarm_workers**
Primary source for worker state. Updated by worker processes and heartbeats.

| Field | Type | Usage |
|-------|------|-------|
| `id` | uuid | Worker identity (game worker.id) |
| `worker_name` | text | Display name source (e.g., "light-0520d4ff") |
| `worker_type` | text | Maps to game WorkerType via `mapWorkerType()` |
| `status` | enum | "idle", "busy", "dead" → game status logic |
| `current_task_id` | uuid | Worker's current task (building assignment) |
| `last_heartbeat` | timestamp | Progress estimation, animation timing |
| `tasks_completed` | int | Speech bubble, progress indicator |
| `xp` | int | Level calculation: `xpToLevel(xp)` |
| `total_cost_cents` | int | Budget tracking |
| `spawned_at` | timestamp | Worker join time |
| `died_at` | timestamp | Dead worker filtering |

**Subscription**: Realtime INSERT, UPDATE, DELETE
**Actions on change**:
- INSERT: Spawn event, add to worker list
- UPDATE: Detect status changes (dead), update worker data
- DELETE: Remove from worker list

---

### 2. **swarm_tasks**
Worker assignments and progress. Determines building locations and conveyor activity.

| Field | Type | Usage |
|-------|------|-------|
| `id` | uuid | Task identity |
| `task_type` | text | Maps to conveyor dataType (build→code, test→tests, etc.) |
| `title` | text | Worker speech bubble |
| `project` | text | Maps to building via `projectToBuilding()` |
| `status` | enum | "queued", "in_progress", "completed", "failed", "pending_approval" |
| `assigned_worker_id` | uuid | Which worker owns this task |
| `started_at` | timestamp | Timing |
| `completed_at` | timestamp | Conveyor throughput calculation |
| `updated_at` | timestamp | Event feed |

**Subscription**: Realtime INSERT, UPDATE
**Actions on change**:
- INSERT: Add to task list
- UPDATE: Detect completions/failures → events + effects
- Status transitions:
  - `queued` → `in_progress`: "Task started" event
  - `in_progress` → `completed`: Completion burst effect + add to `completedTaskIds`
  - `in_progress` → `failed`: Error event

---

### 3. **nexus_sessions**
Claude Code sessions (real-time work). Converted to synthetic swarm_workers.

| Field | Type | Usage |
|-------|------|-------|
| `session_id` | uuid | Session identity |
| `project_name` | text | Building assignment |
| `model` | text | Worker type (opus→heavy, haiku→light) |
| `current_tool` | text | Speech bubble |
| `tool_count` | int | Progress indicator |
| `status` | enum | "active", "completed" |
| `last_activity` | timestamp | Heartbeat |
| `cost_usd` | decimal | Cost tracking |

**Subscription**: Realtime INSERT, UPDATE
**Transformation** (lines 365–401):
```typescript
// Active session → synthetic swarm_worker
const sessionWorker: SwarmWorker = {
  id: `session-${session_id}`,
  worker_name: `cc_light-${session_id.slice(0, 8)}`,
  worker_type: model?.includes("opus") ? "heavy" : "light",
  status: "busy",
  current_task_id: null,
  tasks_completed: tool_count,
  xp: tool_count * 5,
  // ...
};

// Synthetic task for routing to building
const sessionTask: SwarmTask = {
  id: `session-task-${session_id}`,
  project: project_name,
  status: "in_progress",
  assigned_worker_id: `session-${session_id}`,
};
```

**Actions on change**:
- INSERT/UPDATE (status="active"): Upsert synthetic worker → appears in factory
- UPDATE (status="completed"): Remove synthetic worker → cleanup event

---

### 4. **swarm_budgets** (Daily)
Cost/resource tracking. Shown in HUD.

| Field | Type | Usage |
|-------|------|-------|
| `budget_date` | date | Tracking period |
| `daily_api_budget_cents` | int | Budget HUD |
| `api_spent_cents` | int | Budget progress |
| `claude_code_minutes_used` | int | Time tracking |
| `tasks_completed` | int | Aggregated stats |
| `tasks_failed` | int | Failure tracking |

**Subscription**: Realtime UPDATE, INSERT
**Usage**: Lines 779–788 → budgetData prop → HUD display

---

### 5. **agent_activity**
Aggregated agent stepping information (from multi-step jobs).

| Field | Type | Usage |
|-------|------|-------|
| `agent_id` | uuid | Agent/worker identity |
| `status` | text | "running", "paused", "complete" |
| `current_step` | text | Progress indication |
| `steps_completed` | int | Progress ÷ total_steps |
| `total_steps` | int | Task complexity |

**Usage** (lines 610–617): Speech bubble override if agent is running

---

### 6. **nexus_hook_events**
Claude Code tool usage events. Event feed source.

| Field | Type | Usage |
|-------|------|-------|
| `event_type` | text | "PreToolUse", "PostToolUse", "Stop", etc. |
| `tool_name` | text | What tool was used |
| `project_name` | text | Which project |
| `created_at` | timestamp | Event ordering |

**Usage** (lines 334–362, 533–553): Seed event feed with real activity

---

## Transformation Pipeline

### Step 1: Data Fetching (useEffect #1, lines 305–407)

**Initial query**: Parallel fetch of all 7 sources
```typescript
const [workersRes, tasksRes, budgetRes, activityRes, sessionsRes, recentSessionsRes, hookEventsRes]
  = await Promise.all([
    supabase.from("swarm_workers").select("*"),
    supabase.from("swarm_tasks").select("*").limit(50),
    supabase.from("swarm_budgets").select("*").limit(1),
    supabase.from("agent_activity").select("*").limit(20),
    supabase.from("nexus_sessions").select("*").eq("status", "active"),
    supabase.from("nexus_sessions").select(...).eq("status", "completed").limit(10),
    supabase.from("nexus_hook_events").select("*").limit(25),
  ]);
```

**Initialization**: Task status tracking for completion detection
```typescript
prevTaskStatuses.current = {};
tasksRes.data.forEach((t) => { prevTaskStatuses.current[t.id] = t.status; });
```

**Session-to-worker synthesis** (lines 365–401): Convert active sessions to synthetic workers so they appear in the factory.

**Ghost worker seeding** (lines 656–685): Create "recently completed" workers from nexus_sessions with status="completed" in the last 24h.

---

### Step 2: Realtime Subscriptions (useEffect #2, lines 409–559)

Six independent table subscriptions via Supabase Realtime channel "game-realtime".

#### **swarm_workers subscription** (lines 414–431)
```typescript
.on("postgres_changes", { event: "*", table: "swarm_workers" }, (payload) => {
  if (payload.eventType === "INSERT") {
    setSwarmWorkers((prev) => [payload.new, ...prev]);
    addEvent(`Worker ${workerDisplayName} spawned`, "info");
  } else if (payload.eventType === "UPDATE") {
    // Upsert logic
    if (payload.new.status === "dead") {
      addEvent(`Worker ${workerDisplayName} died`, "warning");
    }
  }
  // DELETE: filter out
})
```

#### **swarm_tasks subscription** (lines 433–472)
Detects state transitions:
```typescript
const prevStatus = prevTaskStatuses.current[t.id];
if (t.status === "completed" && prevStatus !== "completed") {
  // Completion detected → burst effect
  setCompletedTaskIds((prev) => { prev.add(t.id); /* 3s auto-clear */ });
  addEvent(`Task completed: ${title}`, "success");
} else if (t.status === "failed" && prevStatus !== "failed") {
  addEvent(`Task failed: ${title}`, "error");
}
prevTaskStatuses.current[t.id] = t.status;
```

#### **swarm_budgets subscription** (lines 474–480)
Direct state update:
```typescript
setBudget(payload.new);
```

#### **nexus_sessions subscription** (lines 482–520)
Synthetic worker management:
```typescript
if (s.status === "active") {
  // Upsert synthetic worker + synthetic task
  setSwarmWorkers((prev) => exists ? prev.map(...) : [...prev, worker]);
} else if (s.status === "completed") {
  // Remove synthetic worker (session ended)
  setSwarmWorkers((prev) => prev.filter((w) => w.id !== syntheticId));
}
```

#### **agent_activity subscription** (lines 522–531)
Upsert activity records (used for step progress override).

#### **nexus_hook_events subscription** (lines 533–553)
Real-time event feed from Claude Code tool usage:
```typescript
if (e.event_type === "PreToolUse") {
  addEvent(`${project}: Using ${e.tool_name}`, "info");
} else if (e.event_type === "PostToolUse") {
  addEvent(`${project}: Completed ${e.tool_name}`, "success");
}
```

---

### Step 3: Worker-to-Building Mapping

#### **mapWorkerType()** (lines 73–85)
Maps Supabase worker_type to game WorkerType (3D model selection):
```typescript
const map: Record<string, WorkerType> = {
  light: "scout",        // Haiku API worker → fast scout model
  heavy: "builder",      // Opus/sonnet worker → powerful builder
  inspector: "inspector",
  deployer: "deployer",
  miner: "miner",
  messenger: "messenger",
};
```

Each type has a `WORKER_TYPE_CONFIG` with color, animations, and behavior.

#### **projectToBuilding()** (lines 87–109)
Maps task.project to building.id for 3D placement:
```typescript
const map: Record<string, string> = {
  "pl-engine": "pl-engine",
  "nexus": "command-center",
  "buildkit-services": "buildkit",
  "email-finder": "email-finder",
  "barrelhouse-crm": "barrelhouse",
  "pc-bottleneck": "pc-bottleneck",
  "outdoor-crm": "outdoor-crm",
  "ai-chess-coach": "chess-academy",
  "ai-finance-brief": "finance-brief",
  "automation-playground": "automation-hub",
  // ... etc
};
```

**Fallback**: Unknown projects → "command-center"

#### **Worker Building Assignment** (lines 575–592)
Priority:
1. If worker has `current_task_id`, use task.project → building
2. If idle, check most recent completed/failed task for context
3. Default: "command-center"

```typescript
let buildingId = "command-center";
if (sw.current_task_id) {
  const task = swarmTasks.find((t) => t.id === sw.current_task_id);
  if (task?.project) buildingId = projectToBuilding(task.project);
}
if (!sw.current_task_id) {
  const recentTask = swarmTasks.find(
    (t) => t.assigned_worker_id === sw.id && (t.status === "completed" || "failed")
  );
  if (recentTask?.project) buildingId = projectToBuilding(recentTask.project);
}
```

---

### Step 4: Worker Data Enrichment

#### **Level Calculation** (lines 132–135)
```typescript
function xpToLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;  // 0–99 XP = Level 1, 100+ = Level 2
}
```

#### **Speech Bubbles** (lines 601–617)
Priority:
1. Current task title
2. Agent activity current_step
3. Fallback: "X tasks done — awaiting mission"

#### **Progress Estimation** (lines 619–634)
Multi-source:
1. If agent_activity exists: `steps_completed / total_steps * 100`
2. Else if busy: Estimate based on elapsed time + task type (heavy: 10min, light: 2min)
3. Fallback: 100 if completed tasks exist

#### **Worker Display Name** (lines 111–130)
Deterministic hash-based name generation:
```typescript
// Input: "light-0520d4ff" (from swarm)
// Output: "Spark" or "Glint" or "Wisp" etc.
const pool = { light: ["Spark", "Glint", ...], heavy: ["Hammer", "Anvil", ...], ... };
const hash = "0520d4ff";
const idx = parseInt(hash.slice(0, 4), 16) % pool.length;
return pool[idx];  // Same hash always gives same name
```

---

### Step 5: Building Status Computation

#### **Logic** (lines 707–766)
For each building, scan swarm_tasks and workers:

```typescript
const hasActiveWorker = liveGameWorkers.some(
  (w) => w.currentBuildingId === b.id && w.status === "working"
);

const recentCompletion = swarmTasks.some((t) => {
  if (t.status !== "completed") return false;
  return projectToBuilding(t.project) === b.id && completedLastHour;
});

const recentFailures = swarmTasks.filter((t) => {
  if (t.status !== "failed") return false;
  return projectToBuilding(t.project) === b.id && failedLastHour;
}).length;

// Status decision:
if (recentFailures >= 3) status = "error";
else if (recentFailures >= 1) status = "warning";
else if (hasActiveWorker || recentCompletion) status = "active";
else status = "idle";
```

#### **Building Size Scaling** (lines 744–752)
Logarithmic growth based on activity:
```typescript
const activityScore = completedCount + (hasActiveWorker ? 5 : 0);
let sizeMultiplier = 1.0;
if (activityScore > 0) {
  sizeMultiplier = 1.0 + Math.min(Math.log2(activityScore + 1) * 0.15, 0.8);
  // 1 task: 1.22x, 3 tasks: 1.37x, 10+ tasks: 1.53x
}
```

---

### Step 6: Conveyor Activation

#### **computeActiveConveyors()** (lines 163–235)
For each predefined conveyor:

1. **Find relevant tasks**: Tasks whose project maps to either endpoint building
2. **Activity check**: Any in_progress or recently completed (5 min) tasks?
3. **Throughput**: Count of completed tasks in last hour
4. **Data type**: Derived from most recent task type (build→code, test→tests)

```typescript
const isActive = inProgressAtEndpoints.length > 0
              || recentlyCompleted.length > 0
              || workersAtEndpoints.length > 0;

const throughput = completedLastHour.length;

return { ...belt, active: isActive, throughput, dataType };
```

#### **Task Type → Data Type Mapping** (lines 140–153)
```typescript
const map: Record<string, ConveyorBelt["dataType"]> = {
  build: "code",
  eval: "tests",
  test: "tests",
  mine: "data",
  deploy: "deploy",
  scout: "config",
  inspect: "tests",
  alert: "alerts",
  report: "revenue",
};
```

---

### Step 7: Demo/Ghost Worker Fallback

#### **Demo Mode Detection** (lines 564–568)
```typescript
const isDemo = loaded && aliveWorkers.length === 0 && !hasRecentActivity;
```

Triggers when:
- Initial data loaded
- No alive workers (status !== "dead")
- No recent completed sessions in last 24h

#### **Worker List Priority** (lines 688–701)
```typescript
if (isDemo && ghostWorkers.length > 0) {
  // No live workers, but recent real activity → show ghosts
  finalWorkers = ghostWorkers.slice(0, 6);
} else if (isDemo) {
  // No live workers AND no activity → static demo
  finalWorkers = INITIAL_WORKERS;  // From constants.ts
} else if (liveGameWorkers.length < 3 && ghostWorkers.length > 0) {
  // Few live workers → fill with ghosts for visual density
  const fill = ghostWorkers.slice(0, Math.max(0, 3 - liveGameWorkers.length));
  finalWorkers = [...liveGameWorkers, ...fill];
} else {
  finalWorkers = liveGameWorkers;
}
```

---

## 3D Component Consumption

### Building3D.tsx
**Props**: `building: Building` (from useGameData)

**Key consumption**:
```typescript
const { id, gridX, gridY, size, color, status } = building;

// Mesh sizing
const width = building.size * 1.5;
const depth = building.size * 1.5;
const height = building.size * 1.0;

// Status-driven visual feedback
const isActive = building.status === "active";
const isError = building.status === "error";
const isWarning = building.status === "warning";

// Color updates based on status
if (isError) color = "#ef4444";

// Pulsing emissive:
// error: aggressive red pulse (5 Hz)
// active: gentle white pulse (2 Hz)
// warning: amber pulse (4 Hz)
// idle: faint glow

// Interactivity: onHover, onClick passed to page state
```

### Worker3D.tsx
**Props**: `worker: Worker`, `buildings: Building[]` (for positioning)

**Key consumption**:
```typescript
const { type, color, level, xp, currentBuildingId, targetBuildingId, progress, status } = worker;

// Find current & target building 3D positions
const currentBuilding = buildings.find((b) => b.id === worker.currentBuildingId);
const targetBuilding = buildings.find((b) => b.id === worker.targetBuildingId);

// Position interpolation
const x = currentBuilding.gridX + (targetBuilding.gridX - current.gridX) * (progress / 100);
const z = currentBuilding.gridY + (targetBuilding.gridY - current.gridY) * (progress / 100);

// Model selection based on type
switch (type) {
  case "builder": BuilderModel (welding mech)
  case "scout": ScoutModel (fast drone)
  case "inspector": InspectorModel (scanning robot)
  // ...
}

// Animation state
if (status === "working") {
  // Arms swing, sparks fly, visor glows
  rightArm.rotation.x = Math.sin(t * 6) * 0.8;
  sparks.visible = true;
} else {
  // Idle breathing/pulsing
  breathe = 1 + Math.sin(t * 2.5) * 0.015;
}

// Level badge, XP display
badge.textContent = `Lv.${level}`;
xpBar.style.width = `${(xp % 100)}%`;

// Speech bubble
speechBubble.innerHTML = worker.task;
```

### GameCanvas.tsx
**Props**: `workers[]`, `buildings[]`, `conveyors[]`, etc. (entire GameData object)

**Key rendering**:
```typescript
// Render all buildings
BUILDINGS.map((building) => (
  building.id === "command-center"
    ? <CommandCenter3D {...} />
    : <Building3D {...} />
))

// Render all workers
workers.map((worker) => (
  <Worker3D key={worker.id} worker={worker} buildings={BUILDINGS} />
))

// Render active conveyors
CONVEYORS.filter((c) => c.active).map((conveyor) => (
  <ConveyorBelt3D key={conveyor.id} belt={conveyor} buildings={BUILDINGS} />
))

// Particle effects
<CompletionBursts workers={workers} buildings={BUILDINGS} />
<SpawnRingEffects workers={workers} buildings={BUILDINGS} />
```

---

## Worker Backend Integration

### Worker Registration (swarm/workers/base.py)

Workers write to `swarm_workers` table on startup (lines 92–108):
```python
self.sb.table(self.WORKERS_TABLE).insert({
    "id": self.worker_id,
    "worker_name": f"{worker_type}-{self.worker_id[:8]}",
    "worker_type": self.worker_type,
    "tier": self.tier,
    "status": "idle",
    "last_heartbeat": now,
    "spawned_at": now,
    "pid": self._get_pid(),
    "tasks_completed": 0,
    "tasks_failed": 0,
    "total_cost_cents": 0,
    "total_tokens": 0,
    "xp": 0,
}).execute()
```

Realtime subscription immediately detects INSERT → "Worker spawned" event.

### Worker Status Updates (pull-execute-report loop)

During task execution:
1. Pulls task from swarm_tasks (status="queued")
2. Updates task: `status = "in_progress"`
   - Realtime detects UPDATE → "Task started" event
3. Executes task (HeavyWorker, CCLightWorker, etc.)
4. Updates task: `status = "completed" or "failed"`
   - Realtime detects UPDATE with status change
   - GameData detects completion → burst effect + event
5. Updates worker: `tasks_completed++, xp+=points, total_cost_cents+=cost`
   - Realtime detects UPDATE → worker stats refresh

### Task Execution (HeavyWorker, CCLightWorker)

**HeavyWorker** (lines 25–150):
- Launches Claude Code CLI for complex tasks
- Task input_data contains: `{ prompt, project, cwd }`
- Resolves project_key → working directory from PROJECTS config
- Captures stdout, duration, exit code → `output_data`

**CCLightWorker** (lines 31–150):
- Launches Claude Code for strategic tasks (eval, plan, review)
- Gathers project context from disk (CLAUDE.md, recent git commits)
- Injects context into prompt for better results
- 5-minute timeout (vs 30 min for heavy)

Both workers write `output_data` back to task row for audit trail.

---

## Data Quality & Reliability

### Issue 1: Task Filtering Performance
**Problem**: `swarmTasks.filter()` on every render for building status + conveyor computation.

Current approach (lines 714–729):
```typescript
const recentCompletion = swarmTasks.some((t) => {
  if (t.status !== "completed" || !t.completed_at) return false;
  return projectToBuilding(t.project) === b.id && completedLastHour;
});

const recentFailures = swarmTasks.filter((t) => {
  if (t.status !== "failed") return false;
  return projectToBuilding(t.project) === b.id && failedLastHour;
}).length;
```

**Impact**: With 50+ tasks, this scans all tasks for each of 12+ buildings. O(n*m) complexity.

**Recommendation**: Pre-compute task-by-building index:
```typescript
const tasksByBuilding = useMemo(() => {
  const map: Record<string, SwarmTask[]> = {};
  swarmTasks.forEach((t) => {
    const bId = projectToBuilding(t.project);
    map[bId] = [...(map[bId] || []), t];
  });
  return map;
}, [swarmTasks]);
```

---

### Issue 2: Subscription Consolidation
**Problem**: 6 independent Realtime subscriptions on the same channel.

Current approach (lines 410–559):
```typescript
const channel = supabase.channel("game-realtime")
  .on("postgres_changes", { table: "swarm_workers" }, ...)
  .on("postgres_changes", { table: "swarm_tasks" }, ...)
  .on("postgres_changes", { table: "swarm_budgets" }, ...)
  .on("postgres_changes", { table: "nexus_sessions" }, ...)
  .on("postgres_changes", { table: "agent_activity" }, ...)
  .on("postgres_changes", { table: "nexus_hook_events" }, ...)
  .subscribe();
```

**Impact**: All subscriptions share one channel (efficient), but 6 event handlers = more conditional logic. No major issue, but could be cleaner.

**Recommendation** (optional): Consolidate to single handler:
```typescript
.on("postgres_changes", { event: "*" }, (payload) => {
  switch (payload.table) {
    case "swarm_workers": /* ... */ break;
    case "swarm_tasks": /* ... */ break;
    // ...
  }
})
```

---

### Issue 3: Building Status Recomputed Every Render
**Problem**: Lines 707–766 recompute building status for every worker/task change.

```typescript
const buildingsWithStatus: Building[] = BUILDINGS.map((b) => {
  const hasActiveWorker = liveGameWorkers.some(...);
  const recentCompletion = swarmTasks.some(...);
  const recentFailures = swarmTasks.filter(...);
  // ... compute status, stats, sizeMultiplier
});
```

**Impact**: Runs after every subscription update. Not a bottleneck yet, but could cause jank with 100+ tasks.

**Recommendation**: Memoize with dependencies:
```typescript
const buildingsWithStatus = useMemo(() => {
  // Recompute only when workers or tasks change
}, [liveGameWorkers, swarmTasks, isDemo]);
```

---

### Issue 4: Ghost Worker Generation Every Render
**Problem**: Lines 656–685 filter recent sessions every render:

```typescript
const ghostWorkers: Worker[] = recentSessions.map((s, i) => {
  const projectName = s.project_name || "general";
  const buildingId = projectToBuilding(projectName);
  const isOpus = s.model?.includes("opus");
  // ... more transformation
});
```

**Impact**: With 10+ recent sessions, this creates 10+ new objects on every dependency change. Minor performance hit.

**Recommendation**: Memoize:
```typescript
const ghostWorkers = useMemo(() => {
  return recentSessions.map(...);
}, [recentSessions]);
```

---

### Issue 5: Completed Task IDs Auto-Clear Timing
**Problem**: Lines 448–460 schedule cleanup with `setTimeout`:

```typescript
setCompletedTaskIds((prev) => {
  const next = new Set(prev);
  next.add(t.id);
  setTimeout(() => {
    setCompletedTaskIds((p) => {
      const n = new Set(p);
      n.delete(t.id);
      return n;
    });
  }, 3000);
  return next;
});
```

**Risk**: If component unmounts, timeout still runs (memory leak in dev, but controlled cleanup in production).

**Recommendation** (minor): Use useEffect cleanup:
```typescript
useEffect(() => {
  const timers = new Map<string, NodeJS.Timeout>();
  const handleCompletion = (taskId: string) => {
    const timeout = setTimeout(() => {
      setCompletedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      timers.delete(taskId);
    }, 3000);
    timers.set(taskId, timeout);
  };
  // ...
  return () => {
    timers.forEach((timeout) => clearTimeout(timeout));
  };
}, []);
```

---

### Issue 6: Building Hover/Click State Not Persisted
**Problem**: Lines 22–32 accept onHover/onClick but no persistence.

```typescript
interface GameCanvasProps {
  hoveredBuilding: string | null;
  selectedBuilding: string | null;
  // ...
  onHoverBuilding: (id: string | null) => void;
  onClickBuilding: (id: string) => void;
}
```

**Impact**: Page component (parent) manages state, so data persists correctly. No issue, just documenting flow.

---

## Integration with Building Activity API

### Endpoint: `/api/building-activity`

Queries:
```typescript
GET /api/building-activity?building=command-center
GET /api/building-activity?worker=<worker-id>
```

Returns:
```json
{
  "tasks": [
    { "id", "title", "status", "task_type", "completed_at", "updated_at" }
  ],
  "stats": {
    "completed": 42,
    "failed": 3,
    "total": 50,
    "lastActivity": "2026-03-16T20:45:30Z"
  }
}
```

**Used by**: Building sidebar in page.tsx for detailed activity views. Not directly consumed by GameCanvas.

---

## Event Flow Summary

```
Worker Process                 Supabase DB                   Frontend Hook
─────────────────────────────────────────────────────────────────────────

1. Worker spawns
   └─ register in swarm_workers
      └─ INSERT trigger → Realtime
                             └─ useGameData detects INSERT
                                └─ addEvent("Worker spawned")
                                └─ update swarmWorkers state

2. Task assigned
   └─ task created in swarm_tasks
      └─ INSERT trigger → Realtime
                             └─ detect INSERT
                             └─ initialize prevTaskStatuses

3. Worker starts task
   └─ update task status="in_progress"
      └─ UPDATE trigger → Realtime
                             └─ detect status change
                             └─ addEvent("Task started")

4. Worker finishes task
   └─ update task status="completed"
      └─ update worker tasks_completed++, xp+=N
         └─ UPDATE triggers → Realtime
                                └─ detect completion
                                └─ addEvent("Task completed")
                                └─ setCompletedTaskIds (3s burst effect)
                                └─ update swarmTasks + swarmWorkers

5. Effects triggered
   └─ CompletionBursts render
      └─ Particle effect at building where task completed
      └─ Auto-clear after 3s

6. Building status updates
   └─ recompute for idle → active transition
   └─ update size scaling (log growth)
   └─ update emissive glow

7. Conveyor activates (if both endpoints active)
   └─ computeActiveConveyors detects throughput
   └─ dataType updates based on task_type
   └─ animated packets flow
```

---

## Type Safety

### GameData Interface (lines 239–255)
```typescript
export interface GameData {
  workers: Worker[];          // From swarm_workers + nexus_sessions
  buildings: Building[];      // From constants, enhanced with status
  conveyors: ConveyorBelt[];  // From constants, activated/data-typed
  events: AlertEvent[];       // From nexus_hook_events + synthetic
  budget: { ... } | null;     // From swarm_budgets
  isDemo: boolean;
  workerCounts: Record<string, number>;
  completedTaskIds: Set<string>;
}
```

### Supabase Row Types (lines 10–53)
Well-defined interfaces ensure type safety on subscriptions:
```typescript
interface SwarmWorker { id, worker_name, worker_type, tier, status, ... }
interface SwarmTask { id, task_type, title, project, status, ... }
interface SwarmBudget { ... }
interface AgentActivityRow { ... }
interface HookEventRow { ... }
interface CompletedSessionRow { ... }
```

**Strength**: All subscription payloads typed. No `as any` casts.

---

## Conclusion

**Data flow is robust and well-structured.** The architecture cleanly separates:
- **Data sources**: 6 Supabase tables + synthetic generation
- **Transformation**: Mapping functions (worker type, project → building)
- **Business logic**: Demo mode, ghost workers, conveyor activation
- **Consumption**: Building3D, Worker3D, GameCanvas components
- **Feedback loop**: Real-time subscriptions keep UI in sync

**Performance considerations** are not critical yet but noted for >100 concurrent workers:
1. Memoize building status computation
2. Pre-index tasks by building
3. Consolidate subscriptions (optional)
4. Clean up completion timeout handlers properly

**Key feature**: Synthetic worker generation from active Claude Code sessions makes the factory visualization represent both swarm automation AND live work simultaneously.

