"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OpsWorker, OpsTask } from "@/lib/ops-types";
import type { AgentActivity } from "@/lib/types";
import { getProjectColor, formatDuration, workerDisplayName } from "@/lib/ops-types";
import {
  Hammer,
  Search,
  Pickaxe,
  Radar,
  Rocket,
  Send,
  Globe,
  Shield,
  Zap,
  CheckCircle2,
} from "lucide-react";

interface Props {
  workers: OpsWorker[];
  tasks: OpsTask[];
  agentActivity: AgentActivity[];
  selectedWorkerId: string | null;
  onWorkerClick?: (workerId: string) => void;
}

const WORKER_ICONS: Record<string, React.ElementType> = {
  builder: Hammer,
  heavy: Hammer,
  inspector: Search,
  miner: Pickaxe,
  scout: Radar,
  deployer: Rocket,
  messenger: Send,
  browser: Globe,
  supervisor: Shield,
  light: Zap,
};

const WORKER_COLORS: Record<string, string> = {
  builder: "#06b6d4",
  heavy: "#06b6d4",
  inspector: "#eab308",
  miner: "#22c55e",
  scout: "#a855f7",
  deployer: "#f97316",
  messenger: "#3b82f6",
  browser: "#0ea5e9",
  supervisor: "#f59e0b",
  light: "#38bdf8",
};

const PROJECT_TO_BUILDING: Record<string, string> = {
  "pl-engine": "PL Engine Forge",
  "nexus": "Command Center",
  "buildkit-services": "BuildKit HQ",
  "email-finder": "Email Finder Lab",
  "barrelhouse": "BarrelHouse CRM",
  "pc-bottleneck": "PC Bottleneck Factory",
  "outdoor-crm": "Outdoor CRM Barracks",
  "ai-chess-coach": "Chess Academy",
  "ai-finance-brief": "Finance Brief Tower",
  "automation-playground": "Automation Hub",
  "mcp-servers": "MCP Server Array",
};

function getBuildingName(project: string | null): string {
  if (!project) return "Command Center";
  return PROJECT_TO_BUILDING[project] || "Command Center";
}

interface WorkLogEntry {
  id: string;
  workerName: string;
  workerType: string;
  status: "working" | "idle" | "complete";
  buildingName: string;
  reasoningText: string;
  stepsCompleted: number;
  totalSteps: number | null;
  elapsed: string;
  costCents: number;
  project: string | null;
}

export function LiveWorkLog({
  workers,
  tasks,
  agentActivity,
  selectedWorkerId,
  onWorkerClick,
}: Props) {
  const entries = useMemo((): WorkLogEntry[] => {
    // Build entries from workers
    return workers
      .filter((w) => w.status !== "dead")
      .map((w) => {
        const currentTask = w.current_task_id
          ? tasks.find((t) => t.id === w.current_task_id)
          : null;

        // Find agent activity for reasoning text
        const activity = agentActivity.find(
          (a) => a.agent_id === w.id && a.status === "running"
        );

        // Determine status
        let status: WorkLogEntry["status"] = "idle";
        if (w.status === "busy" || w.current_task_id) status = "working";

        // Get reasoning text: prefer agent_activity.current_step, fall back to task title
        let reasoningText = "Awaiting assignment...";
        if (activity?.current_step) {
          reasoningText = activity.current_step;
        } else if (currentTask) {
          reasoningText = currentTask.title;
        }

        // Steps
        const stepsCompleted = activity?.steps_completed ?? 0;
        const totalSteps = activity?.total_steps ?? null;

        // Elapsed time
        const startedAt = currentTask?.started_at || w.last_heartbeat;
        const elapsed = formatDuration(startedAt);

        // Cost
        const costCents = currentTask?.cost_cents ?? 0;

        // Building/project
        const project = currentTask?.project ?? null;
        const buildingName = getBuildingName(project);

        return {
          id: w.id,
          workerName: workerDisplayName(w.worker_name),
          workerType: w.worker_type,
          status,
          buildingName,
          reasoningText,
          stepsCompleted,
          totalSteps,
          elapsed,
          costCents,
          project,
        };
      })
      // Sort: working first, then idle
      .sort((a, b) => {
        const statusOrder = { working: 0, complete: 1, idle: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  }, [workers, tasks, agentActivity]);

  // Also add recently completed tasks that don't have active workers
  const recentCompletions = useMemo((): WorkLogEntry[] => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return tasks
      .filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          new Date(t.completed_at).getTime() > fiveMinAgo
      )
      .slice(0, 3)
      .map((t) => {
        const worker = t.assigned_worker_id
          ? workers.find((w) => w.id === t.assigned_worker_id)
          : null;

        return {
          id: `done-${t.id}`,
          workerName: worker
            ? workerDisplayName(worker.worker_name)
            : "Agent",
          workerType: worker?.worker_type || t.worker_type || "light",
          status: "complete" as const,
          buildingName: getBuildingName(t.project),
          reasoningText: t.title,
          stepsCompleted: 0,
          totalSteps: null,
          elapsed: formatDuration(t.started_at, t.completed_at),
          costCents: t.cost_cents,
          project: t.project,
        };
      });
  }, [tasks, workers]);

  const allEntries = useMemo(
    () => [...entries, ...recentCompletions],
    [entries, recentCompletions]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-75" />
        </div>
        <h2 className="text-[9px] font-bold tracking-[0.15em] text-zinc-400 uppercase">
          Live Work Log
        </h2>
        <span className="text-[8px] text-zinc-600 tabular-nums ml-auto">
          {entries.filter((e) => e.status === "working").length} active
        </span>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin pr-1">
        <AnimatePresence mode="popLayout">
          {allEntries.map((entry) => {
            const Icon = WORKER_ICONS[entry.workerType] || Zap;
            const color = WORKER_COLORS[entry.workerType] || "#6b7280";
            const projectColor = getProjectColor(entry.project);
            const isSelected = entry.id === selectedWorkerId;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                layout
                onClick={() => onWorkerClick?.(entry.id)}
                className={`relative p-2.5 rounded-md border cursor-pointer transition-all ${
                  isSelected
                    ? "border-cyan-500/40 bg-cyan-500/[0.06]"
                    : "border-zinc-800/50 hover:border-zinc-700/60 hover:bg-white/[0.01]"
                }`}
              >
                {/* Top row: worker name + status */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20`, border: `1px solid ${color}40` }}
                  >
                    <Icon className="w-2.5 h-2.5" style={{ color }} />
                  </div>

                  <span className="text-[10px] font-semibold text-zinc-200">
                    {entry.workerName}
                  </span>

                  {/* Status badge */}
                  <span
                    className={`text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                      entry.status === "working"
                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                        : entry.status === "complete"
                          ? "text-emerald-300 bg-emerald-400/10 border border-emerald-400/20"
                          : "text-zinc-500 bg-zinc-800/50 border border-zinc-700/30"
                    }`}
                  >
                    {entry.status === "complete" ? (
                      <span className="flex items-center gap-0.5">
                        <CheckCircle2 className="w-2 h-2" />
                        DONE
                      </span>
                    ) : (
                      entry.status.toUpperCase()
                    )}
                  </span>

                  {/* Building location */}
                  <span className="text-[8px] text-zinc-600 ml-auto">
                    @ {entry.buildingName}
                  </span>
                </div>

                {/* Reasoning text -- the killer feature */}
                <p className="text-[10px] text-zinc-400 leading-relaxed mb-1.5 pl-6 italic line-clamp-2">
                  &ldquo;{entry.reasoningText}&rdquo;
                </p>

                {/* Bottom meta row */}
                <div className="flex items-center gap-3 pl-6">
                  {/* Step progress */}
                  {entry.totalSteps && entry.totalSteps > 0 && (
                    <span className="text-[8px] text-zinc-600 tabular-nums">
                      Step {entry.stepsCompleted}/{entry.totalSteps}
                    </span>
                  )}

                  {/* Elapsed */}
                  <span className="text-[8px] text-zinc-600 tabular-nums">
                    {entry.elapsed} elapsed
                  </span>

                  {/* Cost */}
                  {entry.costCents > 0 && (
                    <span className="text-[8px] text-amber-500/70 tabular-nums">
                      ${(entry.costCents / 100).toFixed(3)}
                    </span>
                  )}

                  {/* Project badge */}
                  {entry.project && (
                    <span
                      className="text-[7px] uppercase tracking-wider px-1 py-0.5 rounded ml-auto"
                      style={{
                        color: projectColor,
                        background: `${projectColor}10`,
                        border: `1px solid ${projectColor}20`,
                      }}
                    >
                      {entry.project.replace(/-/g, " ").slice(0, 15)}
                    </span>
                  )}
                </div>

                {/* Progress bar for working entries */}
                {entry.status === "working" && entry.totalSteps && entry.totalSteps > 0 && (
                  <div className="mt-1.5 ml-6 h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${color}, ${color}88)`,
                      }}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (entry.stepsCompleted / entry.totalSteps) * 100,
                          100
                        )}%`,
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {allEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center mb-2">
              <Zap className="w-3.5 h-3.5 text-zinc-700" />
            </div>
            <p className="text-[10px] text-zinc-700">No active workers</p>
            <p className="text-[8px] text-zinc-800 mt-0.5">
              Deploy a task to see live reasoning
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
