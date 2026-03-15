"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OpsTask } from "@/lib/ops-types";
import { getProjectColor, formatTimeAgo } from "@/lib/ops-types";

interface Props {
  tasks: OpsTask[];
  onTaskSelect?: (task: OpsTask) => void;
}

type MiniColumn = "queued" | "running" | "done";

const COLUMNS: { key: MiniColumn; label: string; dotColor: string }[] = [
  { key: "queued", label: "QUEUED", dotColor: "bg-cyan-400" },
  { key: "running", label: "RUNNING", dotColor: "bg-emerald-400 animate-pulse" },
  { key: "done", label: "DONE", dotColor: "bg-emerald-300" },
];

function mapStatusToMiniColumn(status: string): MiniColumn | null {
  switch (status) {
    case "pending":
    case "queued":
      return "queued";
    case "in_progress":
    case "running":
      return "running";
    case "completed":
      return "done";
    default:
      return null;
  }
}

function MiniTaskCard({ task, onSelect }: { task: OpsTask; onSelect?: (t: OpsTask) => void }) {
  const projectColor = getProjectColor(task.project);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      onClick={() => onSelect?.(task)}
      className="group relative p-2 rounded-md border border-zinc-800/60 cursor-pointer transition-all hover:border-cyan-500/30 hover:bg-white/[0.02]"
    >
      <p className="text-[10px] text-zinc-300 leading-tight line-clamp-1">
        {task.title}
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        {task.project && (
          <span
            className="text-[7px] uppercase tracking-wider px-1 py-0.5 rounded"
            style={{
              color: projectColor,
              background: `${projectColor}15`,
              border: `1px solid ${projectColor}25`,
            }}
          >
            {task.project.replace(/-/g, " ").slice(0, 12)}
          </span>
        )}
        <span className="text-[8px] text-zinc-600 tabular-nums ml-auto">
          {formatTimeAgo(task.updated_at)}
        </span>
      </div>
    </motion.div>
  );
}

export function MiniKanban({ tasks, onTaskSelect }: Props) {
  const tasksByColumn = useMemo(() => {
    const result: Record<MiniColumn, OpsTask[]> = {
      queued: [],
      running: [],
      done: [],
    };

    for (const task of tasks) {
      const col = mapStatusToMiniColumn(task.status);
      if (col) {
        if (result[col].length < 5) {
          result[col].push(task);
        }
      }
    }

    return result;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <h2 className="text-[9px] font-bold tracking-[0.15em] text-zinc-400 uppercase">
          Task Board
        </h2>
        <span className="text-[8px] text-zinc-600 tabular-nums ml-auto">
          {tasks.length} total
        </span>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-1.5 min-h-0">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="flex flex-col rounded-md border border-zinc-800/40 overflow-hidden"
            style={{ background: "rgba(10,10,18,0.4)" }}
          >
            {/* Column header */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-zinc-800/40">
              <div className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
              <span className="text-[8px] font-bold tracking-wider text-zinc-500 uppercase">
                {col.label}
              </span>
              <span className="text-[8px] tabular-nums text-zinc-700 ml-auto">
                {tasksByColumn[col.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-1 space-y-1 scrollbar-thin">
              <AnimatePresence mode="popLayout">
                {tasksByColumn[col.key].map((task) => (
                  <MiniTaskCard key={task.id} task={task} onSelect={onTaskSelect} />
                ))}
              </AnimatePresence>
              {tasksByColumn[col.key].length === 0 && (
                <div className="text-center py-4 text-[8px] text-zinc-800">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
