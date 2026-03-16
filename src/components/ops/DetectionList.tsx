"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Shield, ChevronDown,
  Copy, Timer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface DetectionTask {
  id: string;
  title: string;
  status: string;
  project: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  output_data: Record<string, unknown> | string | null;
}

type FilterMode = "all" | "completed" | "failed";

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(createdAt: string, completedAt: string | null): string {
  if (!completedAt) return "--";
  const diff = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function getOutputPreview(outputData: Record<string, unknown> | string | null): string {
  if (!outputData) return "";
  const str = typeof outputData === "string" ? outputData : JSON.stringify(outputData);
  if (str.length <= 100) return str;
  return str.slice(0, 100) + "...";
}

// ── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "",
    borderColor: "border-emerald-500/20",
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/[0.04]",
    borderColor: "border-red-500/20",
  },
  running: {
    icon: Clock,
    color: "text-amber-400",
    bg: "",
    borderColor: "border-amber-500/20",
  },
} as const;

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.completed;
}

// ── Detection Item ──────────────────────────────────────────────────────────

function DetectionItem({ task, index }: { task: DetectionTask; index: number }) {
  const [copied, setCopied] = useState(false);
  const config = getStatusConfig(task.status);
  const StatusIcon = config.icon;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(task.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [task.id]);

  const timestamp = task.completed_at || task.created_at;
  const duration = formatDuration(task.created_at, task.completed_at);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      onClick={handleCopy}
      className={`
        group flex items-start gap-3 px-4 py-3 cursor-pointer
        hover:bg-white/[0.02] transition-colors border-b border-zinc-800/30
        ${config.bg}
      `}
      title={`Click to copy ID: ${task.id}`}
    >
      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        <StatusIcon className={`w-4 h-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs text-white truncate font-medium">{task.title}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Project badge */}
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {task.project || "general"}
          </span>

          {/* Time ago */}
          <span className="text-[10px] text-zinc-600 font-mono">
            {timeAgo(timestamp)}
          </span>

          {/* Duration */}
          <span className="text-[10px] text-zinc-600 font-mono flex items-center gap-0.5">
            <Timer className="w-2.5 h-2.5" />
            {duration}
          </span>

          {/* Copy indicator */}
          {copied && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-[9px] text-emerald-400 flex items-center gap-0.5"
            >
              <Copy className="w-2.5 h-2.5" /> Copied
            </motion.span>
          )}
        </div>

        {/* Error message for failed tasks */}
        {task.status === "failed" && task.error_message && (
          <p className="text-[10px] text-red-400/70 font-mono mt-1.5 truncate leading-relaxed">
            {task.error_message.slice(0, 120)}
          </p>
        )}

        {/* Output preview for completed tasks */}
        {task.status === "completed" && task.output_data && (
          <p className="text-[10px] text-zinc-500 font-mono mt-1.5 truncate leading-relaxed">
            {getOutputPreview(task.output_data)}
          </p>
        )}
      </div>

      {/* Hover copy icon */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        <Copy className="w-3 h-3 text-zinc-600" />
      </div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DetectionList() {
  const [tasks, setTasks] = useState<DetectionTask[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDetections = useCallback(async () => {
    let query = supabase
      .from("swarm_tasks")
      .select("id, title, status, project, created_at, completed_at, error_message, output_data")
      .in("status", ["completed", "failed"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(50);

    const { data, error } = await query;

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  }, []);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchDetections();
    const interval = setInterval(fetchDetections, 30_000);
    return () => clearInterval(interval);
  }, [fetchDetections]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = () => setDropdownOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [dropdownOpen]);

  // Apply filter
  const filteredTasks = tasks.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  const filterLabels: Record<FilterMode, string> = {
    all: `All (${tasks.length})`,
    completed: `Completed (${completedCount})`,
    failed: `Failed (${failedCount})`,
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.15em]">
            Detections
          </h2>
          <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
            {filteredTasks.length}
          </span>
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300
                       px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50
                       hover:border-zinc-600/50 transition-colors uppercase tracking-wider"
          >
            {filterLabels[filter]}
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-zinc-700/50
                           bg-zinc-900/95 backdrop-blur-md shadow-xl overflow-hidden"
              >
                {(["all", "completed", "failed"] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter(mode);
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider
                      transition-colors hover:bg-white/5
                      ${filter === mode ? "text-cyan-400 bg-cyan-500/5" : "text-zinc-500"}
                    `}
                  >
                    {filterLabels[mode]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,200,255,0.2) transparent" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-600 text-xs">
            <Clock className="w-4 h-4 animate-spin mr-2" />
            Loading detections...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-12 text-center">
            <Shield className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
            <p className="text-xs text-zinc-600">No detections found</p>
            <p className="text-[10px] text-zinc-700 mt-1">
              Tasks will appear here as agents complete or fail work
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task, i) => (
              <DetectionItem key={task.id} task={task} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
