# Hive Daemon — The Brain of Nexus

The Hive daemon is not just an orchestrator. It's the **strategic intelligence** that runs the entire operation. Every other component is a limb — the daemon is the mind.

## What Makes It Smart

### 1. Situational Awareness
The daemon knows EVERYTHING at all times:
- How many workers are active, idle, dead
- What tasks are running, queued, blocked, completed
- Budget spend rate (are we on track or burning too fast?)
- Project health across all projects (last deploy, test status, recent activity)
- Time of day (run heavy tasks during work hours, light tasks overnight)
- Historical patterns (what types of tasks succeed vs fail?)

### 2. Strategic Decision Making
Every 10 seconds, the daemon asks itself:
- "What's the highest-impact thing I could do right now?"
- "Am I spending budget wisely or wasting it on low-value tasks?"
- "Are any workers stuck? Should I reassign them?"
- "Has the Scout suggested something I should act on?"
- "Is there an emergency (deploy down, tests failing) that takes priority?"

### 3. Priority Intelligence
Not all goals are equal. The daemon understands:
- Revenue tasks > improvement tasks > maintenance tasks
- Blocked chains should be unblocked ASAP (one stuck task blocks 5 downstream)
- New Scout suggestions get evaluated against current queue — don't flood with work
- Budget-aware: if 80% spent, only run critical tasks
- Time-aware: deploy tasks during low-traffic hours, email tasks during business hours

### 4. Worker Management
The daemon is a good manager:
- Matches workers to tasks they're good at (smart matching)
- Detects underperforming workers (low quality scores) and reassigns
- Scales up when queue is deep, scales down when idle
- Never spawns more workers than the budget can sustain
- Gives workers "rest" — kills idle workers after 10 min to save resources

### 5. Self-Improvement
The daemon improves itself:
- Tracks which task types have highest success rates
- Adjusts Scout suggestions based on what actually worked
- Increases evaluation interval for projects that rarely have improvements
- Decreases interval for actively developed projects
- Learns which prompts produce the best worker outputs

### 6. Communication
The daemon reports clearly:
- Discord summary every 4 hours: "12 tasks completed, $0.08 spent, 2 PRs merged"
- Highlights the single most impactful thing accomplished
- Alerts on anomalies: budget spike, mass failures, stuck chains
- Weekly digest: what the Hive accomplished this week

### 7. Safety Rails
The daemon protects against:
- Budget overrun (hard stop, no exceptions)
- Infinite loops (task spawns task spawns task — max depth 5)
- Worker storms (max 15 light + 3 heavy, enforced)
- Quality drift (if average quality score drops below 6, pause and alert)
- Stale work (if no tasks completed in 2 hours, re-evaluate everything)

## The Daemon Loop (Every 10 Seconds)

```
1. READ STATE
   - Query workers, tasks, budget, memory

2. DETECT ANOMALIES
   - Dead workers? Re-queue their tasks
   - Budget exceeded? Pause workers
   - Mass failures? Alert and pause
   - Stuck chains? Log and investigate

3. STRATEGIC EVALUATION (every 4 hours)
   - Run Scout agent
   - Compare suggestions against current queue
   - Auto-fire top goals if budget allows
   - Adjust evaluation intervals

4. TASK MANAGEMENT
   - Unblock ready tasks (dependencies satisfied)
   - Inject parent outputs into children
   - Re-prioritize based on current state

5. WORKER MANAGEMENT
   - Scale workers to match queue depth
   - Match worker types to task types
   - Kill idle workers (10 min timeout)
   - Detect stuck workers (no heartbeat 10 min)

6. REPORTING
   - Update live feed
   - Post to Discord on milestones
   - Log everything to swarm_task_log
```

This is the most important piece of software in the entire Nexus system. It must be rock-solid, intelligent, and relentless.
