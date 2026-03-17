"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  DollarSign,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCw,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCost, formatTokens } from "@/lib/pricing";

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  status: string;
  priority: number;
  task_type: string;
  cost_tier: string | null;
  assigned_worker_id: string | null;
  worker_type: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  tokens_used: number;
  actual_cost_cents: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

interface TaskLog {
  id: string;
  task_id: string;
  event: string;
  details: string | null;
  created_at: string;
}

interface WorkbenchProps {
  taskId: string | null;
  onClose: () => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-400" />;
    case "running":
    case "in_progress":
      return <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />;
    case "queued":
      return <Clock className="w-5 h-5 text-amber-400" />;
    default:
      return <Clock className="w-5 h-5 text-zinc-500" />;
  }
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function Workbench({ taskId, onClose }: WorkbenchProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "output" | "logs">(
    "overview"
  );
  const [outputExpanded, setOutputExpanded] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    setLoading(true);
    setActiveTab("overview");

    Promise.all([
      supabase.from("swarm_tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase
        .from("swarm_task_log")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([taskRes, logRes]) => {
      if (taskRes.data) setTask(taskRes.data);
      if (logRes.data) setLogs(logRes.data);
      setLoading(false);
    });
  }, [taskId]);

  const outputText =
    task?.output_data &&
    typeof task.output_data === "object" &&
    "response" in task.output_data
      ? String(task.output_data.response)
      : task?.output_data
        ? JSON.stringify(task.output_data, null, 2)
        : null;

  return (
    <AnimatePresence>
      {taskId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[150]"
            onClick={onClose}
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-2xl z-[151] bg-[#0a0a12] border-l border-cyan-500/10 overflow-y-auto"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : task ? (
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-800/50 shrink-0">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <StatusIcon status={task.status} />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white leading-tight">
                        {task.title}
                      </h2>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                        <span>{task.project || "general"}</span>
                        <span className="text-zinc-800">|</span>
                        <span>P{task.priority}</span>
                        <span className="text-zinc-800">|</span>
                        <span>{task.task_type}</span>
                        {task.cost_tier && (
                          <>
                            <span className="text-zinc-800">|</span>
                            <span>{task.cost_tier}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/5 text-zinc-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-zinc-800/50 shrink-0">
                  <div className="text-center">
                    <Clock className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                    <div className="text-sm font-semibold text-white">
                      {formatDuration(task.started_at, task.completed_at)}
                    </div>
                    <div className="text-[9px] text-zinc-600 uppercase">
                      Duration
                    </div>
                  </div>
                  <div className="text-center">
                    <DollarSign className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                    <div className="text-sm font-semibold text-white">
                      {formatCost(task.actual_cost_cents / 100)}
                    </div>
                    <div className="text-[9px] text-zinc-600 uppercase">
                      Cost
                    </div>
                  </div>
                  <div className="text-center">
                    <Cpu className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-sm font-semibold text-white">
                      {formatTokens(task.tokens_used)}
                    </div>
                    <div className="text-[9px] text-zinc-600 uppercase">
                      Tokens
                    </div>
                  </div>
                  <div className="text-center">
                    <RotateCw className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                    <div className="text-sm font-semibold text-white">
                      {task.retry_count}/{task.max_retries}
                    </div>
                    <div className="text-[9px] text-zinc-600 uppercase">
                      Retries
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800/50 px-6 shrink-0">
                  {(["overview", "output", "logs"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2.5 text-xs uppercase tracking-wider border-b-2 transition-colors ${
                        activeTab === tab
                          ? "text-cyan-400 border-cyan-400"
                          : "text-zinc-500 border-transparent hover:text-zinc-300"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <AnimatePresence mode="wait">
                    {activeTab === "overview" && (
                      <motion.div
                        key="overview"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                      {/* Description/Prompt */}
                      <div>
                        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                          Prompt / Goal
                        </h3>
                        <div className="bg-zinc-900/50 rounded-lg p-4 text-sm text-zinc-300 whitespace-pre-wrap">
                          {task.description || task.title}
                        </div>
                      </div>

                      {/* Error */}
                      {task.error_message && (
                        <div>
                          <h3 className="text-[10px] uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Error
                          </h3>
                          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 text-sm text-red-300 whitespace-pre-wrap">
                            {task.error_message}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-zinc-900/50 rounded-lg p-3">
                          <span className="text-zinc-600">Created</span>
                          <div className="text-zinc-300 mt-0.5">
                            {new Date(task.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg p-3">
                          <span className="text-zinc-600">Started</span>
                          <div className="text-zinc-300 mt-0.5">
                            {task.started_at
                              ? new Date(task.started_at).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg p-3">
                          <span className="text-zinc-600">Completed</span>
                          <div className="text-zinc-300 mt-0.5">
                            {task.completed_at
                              ? new Date(task.completed_at).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-zinc-900/50 rounded-lg p-3">
                          <span className="text-zinc-600">Worker</span>
                          <div className="text-zinc-300 mt-0.5">
                            {task.assigned_worker_id?.slice(0, 8) || "—"}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "output" && (
                    <motion.div
                      key="output"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {outputText ? (
                        <div className="relative">
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(outputText)
                            }
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 z-10"
                            title="Copy output"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <div
                            className={`bg-[#050508] rounded-lg p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto ${
                              !outputExpanded ? "max-h-[500px]" : ""
                            }`}
                          >
                            {outputText}
                          </div>
                          {outputText.length > 2000 && (
                            <button
                              onClick={() =>
                                setOutputExpanded(!outputExpanded)
                              }
                              className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              {outputExpanded ? (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  Collapse
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-3 h-3" />
                                  Show full output (
                                  {outputText.length.toLocaleString()} chars)
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-zinc-600 text-sm">
                          No output recorded
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "logs" && (
                    <motion.div
                      key="logs"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-1"
                    >
                      {logs.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600 text-sm">
                          No log entries
                        </div>
                      ) : (
                        logs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.02]"
                          >
                            <span className="text-[10px] text-zinc-600 tabular-nums whitespace-nowrap mt-0.5">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                            <span
                              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap mt-0.5 ${
                                log.event === "completed"
                                  ? "text-emerald-400 bg-emerald-500/10"
                                  : log.event === "failed" ||
                                      log.event === "error"
                                    ? "text-red-400 bg-red-500/10"
                                    : "text-zinc-400 bg-zinc-800"
                              }`}
                            >
                              {log.event}
                            </span>
                            <span className="text-xs text-zinc-400 flex-1">
                              {log.details}
                            </span>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600">
                Task not found
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
