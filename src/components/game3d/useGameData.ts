"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { supabase } from "@/lib/supabase";
import type { Worker, WorkerType, Building, AlertEvent, ConveyorBelt } from "./types";
import { BUILDINGS, CONVEYORS, INITIAL_WORKERS, INITIAL_EVENTS, WORKER_TYPE_CONFIG } from "./constants";

// ─── SUPABASE ROW TYPES ─────────────────────────────────────────────────────

interface SwarmWorker {
  id: string;
  worker_name: string;
  worker_type: string; // "light" | "heavy" | "inspector" etc.
  tier: string;
  status: string; // "idle" | "busy" | "dead"
  current_task_id: string | null;
  last_heartbeat: string;
  pid: number | null;
  tasks_completed: number;
  tasks_failed: number;
  total_cost_cents: number;
  total_tokens: number;
  xp: number;
  spawned_at: string;
  died_at: string | null;
}

interface SwarmTask {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  project: string | null;
  status: string; // "pending" | "queued" | "in_progress" | "completed" | "failed"
  assigned_worker_id: string | null;
  worker_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
}

interface SwarmBudget {
  id: string;
  budget_date: string;
  daily_api_budget_cents: number;
  daily_claude_code_minutes: number;
  api_spent_cents: number;
  claude_code_minutes_used: number;
  tasks_completed: number;
  tasks_failed: number;
  updated_at: string;
}

interface AgentActivityRow {
  id: string;
  agent_id: string;
  agent_name: string;
  project: string | null;
  status: string;
  current_step: string | null;
  steps_completed: number;
  total_steps: number | null;
  worker_type: string | null;
  xp: number;
  level: number;
  updated_at: string;
}

// ─── MAPPING HELPERS ─────────────────────────────────────────────────────────

/** Map swarm worker_type to game WorkerType */
function mapWorkerType(swarmType: string): WorkerType {
  const map: Record<string, WorkerType> = {
    light: "scout",
    heavy: "builder",
    inspector: "inspector",
    deployer: "deployer",
    miner: "miner",
    messenger: "messenger",
    builder: "builder",
    scout: "scout",
  };
  return map[swarmType] || "builder";
}

/** Map project name to building ID */
function projectToBuilding(project: string | null): string {
  if (!project) return "command-center";
  const map: Record<string, string> = {
    "pl-engine": "pl-engine",
    "nexus": "command-center",
    "buildkit-services": "buildkit",
    "email-finder": "email-finder",
    "barrelhouse": "barrelhouse",
    "barrelhouse-crm": "barrelhouse",
    "pc-bottleneck": "pc-bottleneck",
    "outdoor-crm": "outdoor-crm",
    "chess": "chess-academy",
    "ai-chess-coach": "chess-academy",
    "finance-brief": "finance-brief",
    "ai-finance-brief": "finance-brief",
    "automation": "automation-hub",
    "automation-playground": "automation-hub",
    "mcp": "mcp-array",
    "general": "command-center",
  };
  return map[project] || "command-center";
}

/** Generate a readable worker name from swarm worker_name */
function workerDisplayName(raw: string): string {
  // swarm names are like "light-0520d4ff" or "inspector-48f18b30"
  const names: Record<string, string[]> = {
    light: ["Spark", "Glint", "Wisp", "Flicker", "Pulse", "Beam"],
    heavy: ["Hammer", "Anvil", "Forge", "Titan", "Colossus", "Golem"],
    inspector: ["Lens", "Scope", "Prism", "Optic", "Reticle", "Scan"],
    deployer: ["Igniter", "Launch", "Rocket", "Blast", "Thrust", "Orbit"],
    miner: ["Digger", "Drill", "Pick", "Shard", "Vein", "Core"],
    scout: ["Wind", "Swift", "Dart", "Arrow", "Hawk", "Echo"],
    messenger: ["Signal", "Relay", "Link", "Wave", "Ping", "Bolt"],
    builder: ["Block", "Brick", "Frame", "Girder", "Weld", "Rivet"],
  };
  const prefix = raw.split("-")[0];
  const hash = raw.split("-").slice(1).join("");
  const pool = names[prefix] || names.builder!;
  // Deterministic pick based on hash
  const idx = parseInt(hash.slice(0, 4), 16) % pool.length;
  return pool[idx] || "Unit";
}

/** Convert XP to level */
function xpToLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

// ─── CONVEYOR COMPUTATION ────────────────────────────────────────────────────

/** Map task_type to conveyor dataType */
function taskTypeToDataType(taskType: string): ConveyorBelt["dataType"] {
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
  return map[taskType] || "data";
}

/**
 * Compute active conveyors based on real swarm task activity.
 * - A conveyor is "active" if there are in_progress or recently completed tasks
 *   whose project maps to either endpoint of the conveyor.
 * - Throughput = count of completed tasks in the last hour between the two buildings.
 * - DataType is derived from the most recent task type flowing on that route.
 * - If no real activity exists, the conveyor is inactive with 0 throughput.
 */
function computeActiveConveyors(
  tasks: SwarmTask[],
  workers: SwarmWorker[],
  isDemo: boolean
): ConveyorBelt[] {
  if (isDemo) return CONVEYORS; // Return original demo conveyors

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const fiveMinAgo = now - 5 * 60 * 1000;

  return CONVEYORS.map((belt) => {
    const fromId = belt.fromBuildingId;
    const toId = belt.toBuildingId;

    // Find tasks that relate to either endpoint building
    const relevantTasks = tasks.filter((t) => {
      const bId = projectToBuilding(t.project);
      return bId === fromId || bId === toId;
    });

    // In-progress tasks at either endpoint
    const inProgressAtEndpoints = relevantTasks.filter(
      (t) => t.status === "in_progress"
    );

    // Recently completed tasks (last 5 min) at either endpoint
    const recentlyCompleted = relevantTasks.filter((t) => {
      if (t.status !== "completed" || !t.completed_at) return false;
      return new Date(t.completed_at).getTime() > fiveMinAgo;
    });

    // Completed tasks in the last hour for throughput count
    const completedLastHour = relevantTasks.filter((t) => {
      if (t.status !== "completed" || !t.completed_at) return false;
      return new Date(t.completed_at).getTime() > oneHourAgo;
    });

    // Workers currently at buildings that are endpoints of this conveyor
    const workersAtEndpoints = workers.filter((w) => {
      if (w.status === "dead") return false;
      const task = tasks.find((t) => t.id === w.current_task_id);
      const workerBuilding = task?.project
        ? projectToBuilding(task.project)
        : "command-center";
      return (
        (workerBuilding === fromId || workerBuilding === toId) &&
        (w.status === "busy" || w.current_task_id)
      );
    });

    const isActive =
      inProgressAtEndpoints.length > 0 ||
      recentlyCompleted.length > 0 ||
      workersAtEndpoints.length > 0;

    const throughput = completedLastHour.length;

    // Determine data type from most recent relevant task
    const mostRecentTask =
      inProgressAtEndpoints[0] || recentlyCompleted[0] || completedLastHour[0];
    const dataType = mostRecentTask
      ? taskTypeToDataType(mostRecentTask.task_type)
      : belt.dataType;

    return {
      ...belt,
      active: isActive,
      throughput,
      dataType,
    };
  });
}

// ─── MAIN HOOK ───────────────────────────────────────────────────────────────

export interface GameData {
  workers: Worker[];
  buildings: Building[];
  conveyors: ConveyorBelt[];
  events: AlertEvent[];
  budget: {
    apiSpent: number;
    apiLimit: number;
    minutesUsed: number;
    minutesLimit: number;
    tasksCompleted: number;
    tasksFailed: number;
  } | null;
  isDemo: boolean;
  workerCounts: Record<string, number>;
  completedTaskIds: Set<string>;
}

// ─── HOOK EVENT ROW TYPE ─────────────────────────────────────────────────────

interface HookEventRow {
  id: string;
  session_id: string;
  event_type: string;
  tool_name: string | null;
  project_name: string | null;
  model: string | null;
  created_at: string;
}

interface CompletedSessionRow {
  session_id: string;
  project_name: string | null;
  model: string | null;
  tool_count: number;
  cost_usd: number;
  completed_at: string;
  last_activity: string;
  current_tool: string | null;
}

export function useGameData() {
  const [swarmWorkers, setSwarmWorkers] = useState<SwarmWorker[]>([]);
  const [swarmTasks, setSwarmTasks] = useState<SwarmTask[]>([]);
  const [budget, setBudget] = useState<SwarmBudget | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivityRow[]>([]);
  const [liveEvents, setLiveEvents] = useState<AlertEvent[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [recentSessions, setRecentSessions] = useState<CompletedSessionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Track previous task statuses for completion detection
  const prevTaskStatuses = useRef<Record<string, string>>({});

  // ── Helper to add an event ──
  const addEvent = useCallback((message: string, type: AlertEvent["type"]) => {
    const event: AlertEvent = {
      id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString("en-US", { hour12: false }),
      message,
      type,
    };
    setLiveEvents((prev) => [event, ...prev].slice(0, 30));
  }, []);

  // ── Initial fetch ──
  useEffect(() => {
    async function fetchAll() {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [workersRes, tasksRes, budgetRes, activityRes, sessionsRes, recentSessionsRes, hookEventsRes] = await Promise.all([
        supabase.from("swarm_workers").select("*").order("spawned_at", { ascending: false }),
        supabase.from("swarm_tasks").select("*").order("updated_at", { ascending: false }).limit(50),
        supabase.from("swarm_budgets").select("*").order("budget_date", { ascending: false }).limit(1),
        supabase.from("agent_activity").select("*").order("updated_at", { ascending: false }).limit(20),
        supabase.from("nexus_sessions").select("*").eq("status", "active").order("last_activity", { ascending: false }).limit(10),
        // Fetch recently completed sessions (last 24h) for "ghost" workers
        supabase.from("nexus_sessions").select("session_id, project_name, model, tool_count, cost_usd, completed_at, last_activity, current_tool").eq("status", "completed").gte("completed_at", oneDayAgo).order("completed_at", { ascending: false }).limit(10),
        // Fetch recent hook events for the event feed
        supabase.from("nexus_hook_events").select("*").order("created_at", { ascending: false }).limit(25),
      ]);

      if (workersRes.data) setSwarmWorkers(workersRes.data);
      if (tasksRes.data) {
        setSwarmTasks(tasksRes.data);
        // Initialize task status tracking
        const statusMap: Record<string, string> = {};
        tasksRes.data.forEach((t: SwarmTask) => { statusMap[t.id] = t.status; });
        prevTaskStatuses.current = statusMap;
      }
      if (budgetRes.data && budgetRes.data.length > 0) setBudget(budgetRes.data[0]);
      if (activityRes.data) setAgentActivity(activityRes.data);
      if (recentSessionsRes.data) setRecentSessions(recentSessionsRes.data);

      // Seed event feed from real hook events instead of static demo data
      if (hookEventsRes.data && hookEventsRes.data.length > 0) {
        const seededEvents: AlertEvent[] = hookEventsRes.data.map((e: HookEventRow) => {
          const project = e.project_name || "Unknown";
          let message: string;
          let type: AlertEvent["type"] = "info";

          if (e.event_type === "Stop") {
            message = `${project}: Session ended`;
            type = "info";
          } else if (e.event_type === "PreToolUse" && e.tool_name) {
            message = `${project}: Using ${e.tool_name}`;
            type = "info";
          } else if (e.event_type === "PostToolUse" && e.tool_name) {
            message = `${project}: Completed ${e.tool_name}`;
            type = "success";
          } else {
            message = `${project}: ${e.event_type}${e.tool_name ? ` — ${e.tool_name}` : ""}`;
            type = "info";
          }

          return {
            id: e.id,
            time: new Date(e.created_at).toLocaleTimeString("en-US", { hour12: false }),
            message,
            type,
          };
        });
        setLiveEvents(seededEvents);
      }

      // Convert active nexus_sessions to synthetic swarm workers so they appear in the factory
      if (sessionsRes.data) {
        const sessionWorkers: SwarmWorker[] = sessionsRes.data.map((s: { session_id: string; project_name: string | null; model: string | null; current_tool: string | null; tool_count: number; last_activity: string; cost_usd: number }) => ({
          id: `session-${s.session_id}`,
          worker_name: `cc_light-${s.session_id.slice(0, 8)}`,
          worker_type: s.model?.includes("opus") ? "heavy" : "light",
          tier: "cc_light",
          status: "busy",
          current_task_id: null,
          last_heartbeat: s.last_activity,
          pid: null,
          tasks_completed: s.tool_count || 0,
          tasks_failed: 0,
          total_cost_cents: Math.round((Number(s.cost_usd) || 0) * 100),
          total_tokens: 0,
          xp: (s.tool_count || 0) * 5,
          spawned_at: s.last_activity,
          died_at: null,
        }));
        setSwarmWorkers((prev) => [...prev, ...sessionWorkers]);

        // Add synthetic tasks so workers appear at the right buildings
        const sessionTasks: SwarmTask[] = sessionsRes.data.map((s: { session_id: string; project_name: string | null; current_tool: string | null; last_activity: string }) => ({
          id: `session-task-${s.session_id}`,
          task_type: "eval",
          title: s.current_tool ? `Using ${s.current_tool}` : "Claude Code session",
          description: null,
          project: s.project_name,
          status: "in_progress",
          assigned_worker_id: `session-${s.session_id}`,
          worker_type: "builder",
          started_at: s.last_activity,
          completed_at: null,
          updated_at: s.last_activity,
          created_at: s.last_activity,
        }));
        setSwarmTasks((prev) => [...sessionTasks, ...prev]);
      }

      setLoaded(true);
    }

    fetchAll();
  }, []);

  // ── Supabase Realtime subscriptions ──
  useEffect(() => {
    const channel = supabase
      .channel("game-realtime")
      // swarm_workers changes
      .on("postgres_changes", { event: "*", schema: "public", table: "swarm_workers" }, (payload) => {
        startTransition(() => {
          if (payload.eventType === "INSERT") {
            const w = payload.new as SwarmWorker;
            setSwarmWorkers((prev) => [w, ...prev]);
            addEvent(`Worker ${workerDisplayName(w.worker_name)} spawned`, "info");
          } else if (payload.eventType === "UPDATE") {
            const w = payload.new as SwarmWorker;
            setSwarmWorkers((prev) => prev.map((existing) => existing.id === w.id ? w : existing));
            if (w.status === "dead") {
              addEvent(`Worker ${workerDisplayName(w.worker_name)} died`, "warning");
            }
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setSwarmWorkers((prev) => prev.filter((w) => w.id !== old.id));
          }
        });
      })
      // swarm_tasks changes
      .on("postgres_changes", { event: "*", schema: "public", table: "swarm_tasks" }, (payload) => {
        startTransition(() => {
          if (payload.eventType === "INSERT") {
            const t = payload.new as SwarmTask;
            setSwarmTasks((prev) => [t, ...prev].slice(0, 50));
            prevTaskStatuses.current[t.id] = t.status;
          } else if (payload.eventType === "UPDATE") {
            const t = payload.new as SwarmTask;
            const prevStatus = prevTaskStatuses.current[t.id];
            setSwarmTasks((prev) => prev.map((existing) => existing.id === t.id ? t : existing));

            // Detect task completion
            if (t.status === "completed" && prevStatus !== "completed") {
              const shortTitle = t.title.length > 50 ? t.title.slice(0, 47) + "..." : t.title;
              addEvent(`Task completed: ${shortTitle}`, "success");
              setCompletedTaskIds((prev) => {
                const next = new Set(prev);
                next.add(t.id);
                // Auto-clear after 3 seconds (for particle burst timing)
                setTimeout(() => {
                  setCompletedTaskIds((p) => {
                    const n = new Set(p);
                    n.delete(t.id);
                    return n;
                  });
                }, 3000);
                return next;
              });
            } else if (t.status === "failed" && prevStatus !== "failed") {
              const shortTitle = t.title.length > 50 ? t.title.slice(0, 47) + "..." : t.title;
              addEvent(`Task failed: ${shortTitle}`, "error");
            } else if (t.status === "in_progress" && prevStatus !== "in_progress") {
              const shortTitle = t.title.length > 40 ? t.title.slice(0, 37) + "..." : t.title;
              addEvent(`Task started: ${shortTitle}`, "info");
            }

            prevTaskStatuses.current[t.id] = t.status;
          }
        });
      })
      // swarm_budgets changes
      .on("postgres_changes", { event: "*", schema: "public", table: "swarm_budgets" }, (payload) => {
        startTransition(() => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            setBudget(payload.new as SwarmBudget);
          }
        });
      })
      // nexus_sessions changes (live Claude Code sessions appear as workers)
      .on("postgres_changes", { event: "*", schema: "public", table: "nexus_sessions" }, (payload) => {
        startTransition(() => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const s = payload.new as { session_id: string; project_name: string | null; model: string | null; current_tool: string | null; tool_count: number; status: string; last_activity: string; cost_usd: number };
            const syntheticId = `session-${s.session_id}`;
            if (s.status === "active") {
              // Upsert synthetic worker
              const worker: SwarmWorker = {
                id: syntheticId,
                worker_name: `cc_light-${s.session_id.slice(0, 8)}`,
                worker_type: s.model?.includes("opus") ? "heavy" : "light",
                tier: "cc_light",
                status: "busy",
                current_task_id: null,
                last_heartbeat: s.last_activity,
                pid: null,
                tasks_completed: s.tool_count || 0,
                tasks_failed: 0,
                total_cost_cents: Math.round((Number(s.cost_usd) || 0) * 100),
                total_tokens: 0,
                xp: (s.tool_count || 0) * 5,
                spawned_at: s.last_activity,
                died_at: null,
              };
              setSwarmWorkers((prev) => {
                const exists = prev.some((w) => w.id === syntheticId);
                return exists ? prev.map((w) => w.id === syntheticId ? worker : w) : [...prev, worker];
              });
              if (s.current_tool) {
                addEvent(`Session using ${s.current_tool} on ${s.project_name || "unknown"}`, "info");
              }
            } else if (s.status === "completed") {
              // Remove synthetic worker when session ends
              setSwarmWorkers((prev) => prev.filter((w) => w.id !== syntheticId));
              addEvent(`Session completed on ${s.project_name || "unknown"}`, "success");
            }
          }
        });
      })
      // agent_activity changes
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_activity" }, (payload) => {
        startTransition(() => {
          if (payload.eventType === "INSERT") {
            setAgentActivity((prev) => [payload.new as AgentActivityRow, ...prev].slice(0, 20));
          } else if (payload.eventType === "UPDATE") {
            const a = payload.new as AgentActivityRow;
            setAgentActivity((prev) => prev.map((existing) => existing.id === a.id ? a : existing));
          }
        });
      })
      // nexus_hook_events — live event feed from Claude Code sessions
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nexus_hook_events" }, (payload) => {
        startTransition(() => {
          const e = payload.new as HookEventRow;
          const project = e.project_name || "Unknown";
          let message: string;
          let type: AlertEvent["type"] = "info";

          if (e.event_type === "PreToolUse" && e.tool_name) {
            message = `${project}: Using ${e.tool_name}`;
          } else if (e.event_type === "PostToolUse" && e.tool_name) {
            message = `${project}: Completed ${e.tool_name}`;
            type = "success";
          } else if (e.event_type === "Stop") {
            message = `${project}: Session ended`;
          } else {
            message = `${project}: ${e.event_type}${e.tool_name ? ` — ${e.tool_name}` : ""}`;
          }

          addEvent(message, type);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addEvent]);

  // ── Build game data from live sources ──

  // Filter to alive workers only
  const aliveWorkers = swarmWorkers.filter((w) => w.status !== "dead");
  // Demo mode only when: no live workers AND no recent completed sessions
  // Once the executor auto-starts, this will almost never be true
  const hasRecentActivity = recentSessions.length > 0;
  const isDemo = loaded && aliveWorkers.length === 0 && !hasRecentActivity;

  // Map swarm workers to game workers
  const liveGameWorkers: Worker[] = aliveWorkers.map((sw) => {
    const gameType = mapWorkerType(sw.worker_type);
    const config = WORKER_TYPE_CONFIG[gameType];

    // Determine which building this worker is at based on their current task
    let buildingId = "command-center";
    if (sw.current_task_id) {
      const task = swarmTasks.find((t) => t.id === sw.current_task_id);
      if (task?.project) {
        buildingId = projectToBuilding(task.project);
      }
    }

    // If worker is idle, check most recent completed task for project context
    if (!sw.current_task_id) {
      const recentTask = swarmTasks.find(
        (t) => t.assigned_worker_id === sw.id && (t.status === "completed" || t.status === "failed")
      );
      if (recentTask?.project) {
        buildingId = projectToBuilding(recentTask.project);
      }
    }

    const level = xpToLevel(sw.xp);

    // Worker status mapping
    let gameStatus: Worker["status"] = "idle";
    if (sw.status === "busy") gameStatus = "working";
    else if (sw.current_task_id) gameStatus = "working";

    // Speech bubble from current task or agent activity
    let speechBubble: string | null = null;
    if (sw.current_task_id) {
      const task = swarmTasks.find((t) => t.id === sw.current_task_id);
      if (task) {
        speechBubble = task.title.length > 30 ? task.title.slice(0, 27) + "..." : task.title;
      }
    }
    // Also check agent_activity for current_step
    const activity = agentActivity.find(
      (a) => a.agent_id === sw.id && a.status === "running"
    );
    if (activity?.current_step) {
      speechBubble = activity.current_step.length > 30
        ? activity.current_step.slice(0, 27) + "..."
        : activity.current_step;
    }

    // Progress — compute from multiple sources
    let progress = 0;
    if (activity && activity.total_steps && activity.total_steps > 0) {
      progress = Math.min((activity.steps_completed / activity.total_steps) * 100, 99);
    } else if (sw.status === "busy" || sw.status === "working") {
      // Estimate progress based on time elapsed since task started
      // Heavy tasks take ~5-15 min, light tasks take ~1-3 min
      const elapsed = Date.now() - new Date(sw.last_heartbeat).getTime();
      const isHeavy = sw.worker_type === "heavy";
      const estimatedDuration = isHeavy ? 600000 : 120000; // 10 min or 2 min
      progress = Math.min((elapsed / estimatedDuration) * 100, 95);
      // Add subtle animation so it doesn't look stuck
      progress = Math.max(progress, 5 + Math.sin(Date.now() / 2000) * 3);
    } else if (sw.tasks_completed > 0) {
      progress = 100; // Show full if completed tasks but now idle
    }

    return {
      id: sw.id,
      name: workerDisplayName(sw.worker_name),
      type: gameType,
      color: config.color,
      level,
      xp: sw.xp % 100,
      currentBuildingId: buildingId,
      targetBuildingId: buildingId, // Real workers stay at their building
      task: speechBubble || `${sw.worker_type} worker`,
      progress,
      speechBubble,
      status: gameStatus,
      evolving: false,
    };
  });

  // Build "ghost" workers from recently completed sessions (real activity, not fake demo)
  const ghostWorkers: Worker[] = recentSessions.map((s, i) => {
    const projectName = s.project_name || "general";
    const buildingId = projectToBuilding(projectName);
    const isOpus = s.model?.includes("opus");
    const gameType: WorkerType = isOpus ? "builder" : "scout";
    const config = WORKER_TYPE_CONFIG[gameType];
    const toolCount = s.tool_count || 0;
    const level = Math.min(Math.floor(toolCount / 10) + 1, 10);

    // Time since completion
    const completedTime = s.completed_at ? new Date(s.completed_at) : new Date();
    const minutesAgo = Math.floor((Date.now() - completedTime.getTime()) / 60_000);
    const timeLabel = minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`;

    return {
      id: `ghost-${s.session_id}-${i}`,
      name: `${projectName.slice(0, 12)} (${timeLabel})`,
      type: gameType,
      color: config.color,
      level,
      xp: toolCount % 100,
      currentBuildingId: buildingId,
      targetBuildingId: buildingId,
      task: `${toolCount} tools used`,
      progress: 100,
      speechBubble: null,
      status: "idle" as const,
      evolving: false,
    };
  });

  // Build final workers list: live workers + ghost workers from recent activity
  let finalWorkers: Worker[];
  if (isDemo && ghostWorkers.length > 0) {
    // No live workers, but we have recent real activity — show ghosts
    finalWorkers = ghostWorkers.slice(0, 6);
  } else if (isDemo) {
    // No live workers AND no recent activity — show static demo as last resort
    finalWorkers = INITIAL_WORKERS;
  } else if (liveGameWorkers.length < 3 && ghostWorkers.length > 0) {
    // Few live workers — fill with recent activity ghosts for visual density
    const fill = ghostWorkers.slice(0, Math.max(0, 3 - liveGameWorkers.length));
    finalWorkers = [...liveGameWorkers, ...fill];
  } else {
    finalWorkers = liveGameWorkers;
  }

  // ── Building statuses from real data ──
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const buildingsWithStatus: Building[] = BUILDINGS.map((b) => {
    // Check if any worker is currently at this building
    const hasActiveWorker = liveGameWorkers.some(
      (w) => w.currentBuildingId === b.id && w.status === "working"
    );

    // Check if a task completed at this building in the last hour
    const recentCompletion = swarmTasks.some((t) => {
      if (t.status !== "completed" || !t.completed_at) return false;
      return (
        projectToBuilding(t.project) === b.id &&
        new Date(t.completed_at).getTime() > oneHourAgo
      );
    });

    // Check if tasks failed at this building — count for severity
    const recentFailures = swarmTasks.filter((t) => {
      if (t.status !== "failed") return false;
      return (
        projectToBuilding(t.project) === b.id &&
        new Date(t.updated_at).getTime() > oneHourAgo
      );
    }).length;

    let status: Building["status"] = b.status; // Keep original as default
    if (!isDemo) {
      if (recentFailures >= 3) status = "error"; // Threat zone — 3+ failures
      else if (recentFailures >= 1) status = "warning";
      else if (hasActiveWorker || recentCompletion) status = "active";
      else status = "idle";
    }

    // Update stats with real data if available
    const projectTasks = swarmTasks.filter((t) => projectToBuilding(t.project) === b.id);
    const completedCount = projectTasks.filter((t) => t.status === "completed").length;
    const failedCount = projectTasks.filter((t) => t.status === "failed").length;

    // Dynamic size — buildings grow based on activity
    // Base size from constants, scaled up by completed tasks + workers
    const activityScore = completedCount + (hasActiveWorker ? 5 : 0);
    let sizeMultiplier = 1.0;
    if (!isDemo && activityScore > 0) {
      // Scale from 1.0 (no activity) to 1.8 (very active)
      // Logarithmic so first few tasks have big impact, then it levels off
      sizeMultiplier = 1.0 + Math.min(Math.log2(activityScore + 1) * 0.15, 0.8);
    }

    return {
      ...b,
      size: b.size * sizeMultiplier,
      status,
      stats: isDemo
        ? b.stats
        : {
            tests: b.stats.tests,
            deploys: completedCount || b.stats.deploys,
            uptime: recentFailures ? "WARN" : hasActiveWorker ? "LIVE" : b.stats.uptime,
          },
    };
  });

  // ── Events — always prefer real data ──
  const events: AlertEvent[] = liveEvents.length > 0
    ? liveEvents
    : [{
        id: "no-activity",
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        message: "No recent activity — start a Claude Code session to see live events",
        type: "info" as const,
      }];

  // ── Budget ──
  const budgetData = budget
    ? {
        apiSpent: budget.api_spent_cents,
        apiLimit: budget.daily_api_budget_cents,
        minutesUsed: budget.claude_code_minutes_used,
        minutesLimit: budget.daily_claude_code_minutes,
        tasksCompleted: budget.tasks_completed,
        tasksFailed: budget.tasks_failed,
      }
    : null;

  // ── Worker counts by type ──
  const workerCounts: Record<string, number> = {};
  aliveWorkers.forEach((w) => {
    const gt = mapWorkerType(w.worker_type);
    workerCounts[gt] = (workerCounts[gt] || 0) + 1;
  });

  // ── Conveyors from real task data ──
  const conveyors = computeActiveConveyors(swarmTasks, swarmWorkers, isDemo);

  return {
    workers: finalWorkers,
    buildings: buildingsWithStatus,
    conveyors,
    events,
    budget: budgetData,
    isDemo,
    workerCounts,
    completedTaskIds,
  };
}
