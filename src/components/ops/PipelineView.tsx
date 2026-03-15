"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  XCircle,
  CircleDot,
  Workflow,
} from "lucide-react";
import type { OpsTask } from "@/lib/ops-types";
import { formatDuration } from "@/lib/ops-types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineStep {
  task: OpsTask;
  stepIndex: number;
  stepName: string;
}

interface PipelineViewProps {
  workflowTasks: OpsTask[];
  workflowName: string;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  {
    color: string;
    borderColor: string;
    bgColor: string;
    glowColor: string;
    icon: React.ReactNode;
    label: string;
  }
> = {
  completed: {
    color: "text-emerald-400",
    borderColor: "border-emerald-500/60",
    bgColor: "bg-emerald-500/10",
    glowColor: "shadow-emerald-500/20",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    label: "Done",
  },
  in_progress: {
    color: "text-cyan-400",
    borderColor: "border-cyan-500/60",
    bgColor: "bg-cyan-500/10",
    glowColor: "shadow-cyan-500/20",
    icon: <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />,
    label: "Running",
  },
  queued: {
    color: "text-amber-400",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/10",
    glowColor: "shadow-amber-500/10",
    icon: <Clock className="w-4 h-4 text-amber-400" />,
    label: "Queued",
  },
  blocked: {
    color: "text-amber-400",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/10",
    glowColor: "shadow-amber-500/10",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    label: "Blocked",
  },
  failed: {
    color: "text-red-400",
    borderColor: "border-red-500/60",
    bgColor: "bg-red-500/10",
    glowColor: "shadow-red-500/20",
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    label: "Failed",
  },
  pending: {
    color: "text-zinc-500",
    borderColor: "border-zinc-700/40",
    bgColor: "bg-zinc-800/30",
    glowColor: "shadow-none",
    icon: <CircleDot className="w-4 h-4 text-zinc-500" />,
    label: "Pending",
  },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

// ── Connecting line between nodes ──────────────────────────────────────────────

function ConnectorLine({
  fromStatus,
  toStatus,
  index,
}: {
  fromStatus: string;
  toStatus: string;
  index: number;
}) {
  const isCompleted = fromStatus === "completed";
  const isActive =
    fromStatus === "completed" &&
    (toStatus === "in_progress" || toStatus === "completed");

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay: 0.1 * (index + 1), duration: 0.3 }}
      className="flex items-center w-8 sm:w-12 flex-shrink-0 relative"
      style={{ originX: 0 }}
    >
      {/* Base line */}
      <div className="h-[2px] w-full bg-zinc-800 rounded-full overflow-hidden">
        {/* Animated fill */}
        {isCompleted && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.15 * (index + 1), duration: 0.4 }}
            className="h-full bg-emerald-500/60 rounded-full"
          />
        )}
        {/* Pulse effect for active transitions */}
        {isActive && !isCompleted && (
          <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-full bg-cyan-500/40 rounded-full"
          />
        )}
      </div>
      {/* Pulse dot for active flow */}
      {isActive && (
        <motion.div
          animate={{ left: ["0%", "100%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
          style={{ top: "50%", transform: "translateY(-50%)" }}
        />
      )}
    </motion.div>
  );
}

// ── Pipeline node ──────────────────────────────────────────────────────────────

function PipelineNode({ step, index }: { step: PipelineStep; index: number }) {
  const config = getStatusConfig(step.task.status);
  const duration =
    step.task.status === "completed" || step.task.status === "in_progress"
      ? formatDuration(step.task.started_at, step.task.completed_at)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.35 }}
      className={`
        relative flex flex-col items-center gap-1.5 p-3 rounded-lg border
        ${config.borderColor} ${config.bgColor}
        shadow-md ${config.glowColor}
        min-w-[120px] max-w-[160px] flex-shrink-0
      `}
    >
      {/* Step number badge */}
      <div
        className={`absolute -top-2.5 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${config.borderColor} ${config.bgColor}`}
        style={{ background: "rgba(10,10,18,0.9)" }}
      >
        <span className={config.color}>{step.stepIndex + 1}</span>
      </div>

      {/* Status icon */}
      <div className="flex items-center gap-1.5">
        {config.icon}
        <span className={`text-[9px] uppercase tracking-wider font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Step name */}
      <p className="text-[11px] text-zinc-300 text-center leading-tight line-clamp-2 font-medium">
        {step.stepName}
      </p>

      {/* Duration */}
      {duration && duration !== "--" && (
        <span className="text-[9px] text-zinc-500 font-mono">{duration}</span>
      )}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PipelineView({ workflowTasks, workflowName }: PipelineViewProps) {
  if (!workflowTasks || workflowTasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-600 text-xs">
        <Workflow className="w-4 h-4 mr-2 text-zinc-700" />
        No active pipelines
      </div>
    );
  }

  // Sort tasks by created_at to maintain step ordering
  const sorted = [...workflowTasks].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Extract step name from title: "[Workflow Name] Step description" -> "Step description"
  const steps: PipelineStep[] = sorted.map((task, i) => {
    const bracketEnd = task.title.indexOf("]");
    const stepName =
      bracketEnd >= 0
        ? task.title.slice(bracketEnd + 1).trim()
        : task.title;

    return {
      task,
      stepIndex: i,
      stepName: stepName || `Step ${i + 1}`,
    };
  });

  // Progress stats
  const completed = steps.filter((s) => s.task.status === "completed").length;
  const failed = steps.filter((s) => s.task.status === "failed").length;
  const total = steps.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Pipeline: {workflowName}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {failed > 0 && (
            <span className="text-[10px] text-red-400 font-mono">
              {failed} failed
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-mono">
            {completed}/{total} steps
          </span>
          {/* Mini progress bar */}
          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className={`h-full rounded-full ${
                failed > 0 ? "bg-red-500/70" : "bg-emerald-500/70"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Pipeline nodes */}
      <div className="flex items-center overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {steps.map((step, i) => (
          <div key={step.task.id} className="flex items-center">
            <PipelineNode step={step} index={i} />
            {i < steps.length - 1 && (
              <ConnectorLine
                fromStatus={step.task.status}
                toStatus={steps[i + 1].task.status}
                index={i}
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
