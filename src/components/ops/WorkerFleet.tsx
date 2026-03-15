"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
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
  Anvil,
} from "lucide-react";
import type { OpsWorker, OpsTask } from "@/lib/ops-types";
import {
  workerDisplayName,
  xpToLevel,
  formatTimeAgo,
  formatDuration,
} from "@/lib/ops-types";

interface Props {
  workers: OpsWorker[];
  tasks: OpsTask[];
  onWorkerSelect: (worker: OpsWorker) => void;
  onTaskDropOnWorker: (taskId: string, workerId: string) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  builder: Hammer,
  inspector: Search,
  miner: Pickaxe,
  scout: Radar,
  deployer: Rocket,
  messenger: Send,
  browser: Globe,
  supervisor: Shield,
  light: Zap,
  heavy: Anvil,
};

const TYPE_COLOR: Record<string, string> = {
  builder: "#f59e0b",
  inspector: "#3b82f6",
  miner: "#8b5cf6",
  scout: "#06b6d4",
  deployer: "#ef4444",
  messenger: "#ec4899",
  browser: "#6366f1",
  supervisor: "#10b981",
  light: "#fbbf24",
  heavy: "#f97316",
};

function workerTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1) + "s";
}

// ─── WORKER CARD (DROP ZONE) ─────────────────────────────────────────────────

function WorkerCard({
  worker,
  currentTask,
  onSelect,
}: {
  worker: OpsWorker;
  currentTask: OpsTask | null;
  onSelect: (w: OpsWorker) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `worker-${worker.id}`,
    data: { workerId: worker.id },
  });

  const Icon = ICON_MAP[worker.worker_type] || Hammer;
  const color = TYPE_COLOR[worker.worker_type] || "#6b7280";
  const level = xpToLevel(worker.xp);
  const xpInLevel = worker.xp % 100;
  const isAlive = worker.status !== "dead";
  const isBusy = worker.status === "busy" || worker.status === "working";

  // Calculate progress if busy
  let progress = 0;
  if (isBusy && worker.last_heartbeat) {
    const elapsed = Date.now() - new Date(worker.last_heartbeat).getTime();
    const isHeavy = worker.worker_type === "heavy";
    const estimatedDuration = isHeavy ? 600000 : 120000;
    progress = Math.min((elapsed / estimatedDuration) * 100, 95);
  }

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(worker)}
      className={`relative p-2.5 rounded-md border cursor-pointer transition-all ${
        isOver
          ? "border-cyan-400/60 bg-cyan-500/5 shadow-md shadow-cyan-500/10"
          : isAlive
            ? "border-zinc-800/60 hover:border-zinc-700"
            : "border-zinc-800/30 opacity-40"
      }`}
      style={{
        background: isOver ? undefined : "rgba(10,10,18,0.6)",
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(worker);
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
        <span className="text-[11px] font-semibold text-zinc-200 truncate">
          {workerDisplayName(worker.worker_name)}
        </span>
        <span
          className={`ml-auto text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
            isBusy
              ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
              : !isAlive
                ? "text-red-400 bg-red-500/10 border border-red-500/20"
                : "text-zinc-500 bg-zinc-800/50 border border-zinc-700/30"
          }`}
        >
          {isBusy ? "WORKING" : !isAlive ? "DEAD" : "IDLE"}
        </span>
      </div>

      {/* Current task */}
      {currentTask && (
        <p className="text-[9px] text-zinc-400 truncate mb-1.5 pl-5">
          {currentTask.title}
        </p>
      )}

      {/* Progress bar */}
      {isBusy && (
        <div className="h-1 rounded-full bg-zinc-800 overflow-hidden mb-1.5 ml-5">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 pl-5 text-[8px] text-zinc-600">
        <span className="tabular-nums">
          {worker.tasks_completed} done
        </span>
        <span className="tabular-nums">
          Lv.{level}
        </span>
        <span className="tabular-nums">
          {xpInLevel}/100 XP
        </span>
        <span className="ml-auto tabular-nums">
          {formatDuration(worker.spawned_at, worker.died_at)}
        </span>
      </div>

      {/* Drop indicator */}
      {isOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-md border-2 border-cyan-400/40 pointer-events-none"
        />
      )}
    </div>
  );
}

// ─── WORKER FLEET ─────────────────────────────────────────────────────────────

export function WorkerFleet({
  workers,
  tasks,
  onWorkerSelect,
}: Props) {
  // Group workers by type
  const grouped = useMemo(() => {
    const groups: Record<string, OpsWorker[]> = {};
    for (const w of workers) {
      const type = w.worker_type || "unknown";
      if (!groups[type]) groups[type] = [];
      groups[type].push(w);
    }
    // Sort types: busy workers first within each group
    for (const type of Object.keys(groups)) {
      groups[type].sort((a, b) => {
        if (a.status === "dead" && b.status !== "dead") return 1;
        if (a.status !== "dead" && b.status === "dead") return -1;
        if ((a.status === "busy" || a.status === "working") && b.status === "idle") return -1;
        if (a.status === "idle" && (b.status === "busy" || b.status === "working")) return 1;
        return 0;
      });
    }
    return groups;
  }, [workers]);

  const taskMap = useMemo(() => {
    const map: Record<string, OpsTask> = {};
    for (const t of tasks) map[t.id] = t;
    return map;
  }, [tasks]);

  const typeOrder = Object.keys(grouped).sort((a, b) => {
    // Active types first
    const aActive = grouped[a].some(
      (w) => w.status === "busy" || w.status === "working"
    );
    const bActive = grouped[b].some(
      (w) => w.status === "busy" || w.status === "working"
    );
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return grouped[b].length - grouped[a].length;
  });

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <h2 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
          Worker Fleet
        </h2>
        <span className="text-[9px] tabular-nums text-zinc-600 ml-auto">
          {workers.filter((w) => w.status !== "dead").length} alive
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-1">
        <AnimatePresence mode="popLayout">
          {typeOrder.map((type) => (
            <motion.div
              key={type}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              layout
            >
              {/* Type header */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: TYPE_COLOR[type] || "#6b7280" }}
                />
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                  {workerTypeLabel(type)}
                </span>
                <span className="text-[9px] tabular-nums text-zinc-700">
                  ({grouped[type].length})
                </span>
              </div>

              {/* Worker cards */}
              <div className="space-y-1">
                {grouped[type].map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    currentTask={
                      worker.current_task_id
                        ? taskMap[worker.current_task_id] || null
                        : null
                    }
                    onSelect={onWorkerSelect}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {workers.length === 0 && (
          <div className="text-center py-12 text-[10px] text-zinc-700">
            No workers registered
          </div>
        )}
      </div>
    </div>
  );
}
