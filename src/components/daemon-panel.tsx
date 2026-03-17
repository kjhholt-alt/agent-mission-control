"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Play,
  Square,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import {
  isTauri,
  getDaemonStatus,
  startDaemon,
  stopDaemon,
  restartDaemon,
  onDaemonStdout,
  onDaemonStderr,
  onDaemonCrash,
  sendNotification,
  type DaemonStatus,
} from "@/lib/tauri-bridge";
import { useToast } from "@/components/ui/toast";

function formatUptime(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  Running: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    label: "RUNNING",
  },
  Starting: {
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    label: "STARTING",
  },
  Crashed: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "CRASHED",
  },
  Stopped: {
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    label: "STOPPED",
  },
};

export function DaemonPanel() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [acting, setActing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const prevStatusRef = useRef<string | null>(null);

  // Only render in Tauri
  useEffect(() => {
    setVisible(isTauri());
  }, []);

  // Poll daemon status
  const pollStatus = useCallback(async () => {
    const s = await getDaemonStatus();
    if (s) {
      const prevStatus = prevStatusRef.current;
      const newStatus = s.status;

      // Show toast on status change
      if (prevStatus && prevStatus !== newStatus) {
        if (newStatus === "Running") {
          toast.success("Daemon started successfully");
        } else if (newStatus === "Stopped") {
          toast.info("Daemon stopped");
        } else if (newStatus === "Crashed") {
          toast.error("Daemon crashed — check logs");
        } else if (newStatus === "Starting") {
          toast.info("Daemon starting...");
        }
      }

      prevStatusRef.current = newStatus;
      setStatus(s);
    }
  }, [toast]);

  useEffect(() => {
    if (!visible) return;
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [visible, pollStatus]);

  // Listen for daemon output
  useEffect(() => {
    if (!visible) return;

    const unStdout = onDaemonStdout((line) => {
      setLogs((prev) => [...prev.slice(-99), `[out] ${line}`]);
    });
    const unStderr = onDaemonStderr((line) => {
      setLogs((prev) => [...prev.slice(-99), `[err] ${line}`]);
    });
    const unCrash = onDaemonCrash((msg) => {
      setLogs((prev) => [...prev.slice(-99), `[CRASH] ${msg}`]);
      sendNotification("Nexus Daemon Crashed", msg);
      toast.error(`Daemon crashed: ${msg}`);
    });

    return () => {
      unStdout();
      unStderr();
      unCrash();
    };
  }, [visible]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!visible) return null;

  const cfg = STATUS_CONFIG[status?.status || "Stopped"];

  const handleAction = async (action: () => Promise<void>) => {
    setActing(true);
    try {
      await action();
      await pollStatus();
    } finally {
      setActing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-zinc-900/50 border ${cfg.border} rounded-xl overflow-hidden transition-colors`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
            {status?.status === "Crashed" ? (
              <AlertTriangle className={`w-4 h-4 ${cfg.color}`} />
            ) : (
              <Activity className={`w-4 h-4 ${cfg.color}`} />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                Swarm Daemon
              </span>
              <span
                className={`text-[10px] uppercase tracking-wider ${cfg.color}`}
              >
                {cfg.label}
              </span>
              {status?.status === "Running" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
              {status?.pid && <span>PID {status.pid}</span>}
              <span>
                Uptime: {formatUptime(status?.uptime_seconds ?? null)}
              </span>
              {(status?.crash_count ?? 0) > 0 && (
                <span className="text-red-400">
                  {status?.crash_count} crashes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick action buttons */}
          {status?.status !== "Running" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction(startDaemon);
              }}
              disabled={acting}
              className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
              title="Start Daemon"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {status?.status === "Running" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction(stopDaemon);
              }}
              disabled={acting}
              className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
              title="Stop Daemon"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(restartDaemon);
            }}
            disabled={acting}
            className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-cyan-500/30 transition-colors disabled:opacity-40"
            title="Restart Daemon"
          >
            <RotateCw className={`w-3.5 h-3.5 ${acting ? "animate-spin" : ""}`} />
          </button>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-600" />
          )}
        </div>
      </button>

      {/* Expanded log area */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800/50 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                  Daemon Output
                </span>
                <button
                  onClick={() => setLogs([])}
                  className="ml-auto text-[10px] text-zinc-700 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="bg-[#050508] rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
                {logs.length === 0 ? (
                  <span className="text-zinc-700">
                    No output yet. Start the daemon to see logs.
                  </span>
                ) : (
                  logs.map((line, i) => (
                    <div
                      key={i}
                      className={`${
                        line.startsWith("[err]")
                          ? "text-red-400/70"
                          : line.startsWith("[CRASH]")
                            ? "text-red-500 font-bold"
                            : "text-zinc-500"
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
