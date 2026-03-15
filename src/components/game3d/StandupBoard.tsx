"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Worker, WorkerType } from "./types";
import { WORKER_TYPE_CONFIG, BUILDINGS } from "./constants";

// ─── SUPABASE TYPES ──────────────────────────────────────────────────────────

interface SwarmTaskRow {
  id: string;
  title: string;
  status: string;
  task_type: string;
  project: string | null;
  assigned_worker_id: string | null;
  completed_at: string | null;
  updated_at: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatUptime(spawned: string | undefined): string {
  if (!spawned) return "—";
  const diff = Date.now() - new Date(spawned).getTime();
  if (diff < 60_000) return "<1m";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`;
  return `${Math.floor(diff / 86_400_000)}d ${Math.floor((diff % 86_400_000) / 3_600_000)}h`;
}

function getBuildingName(buildingId: string): string {
  const b = BUILDINGS.find((x) => x.id === buildingId);
  return b ? b.shortName : "—";
}

// ─── WORKER CARD ─────────────────────────────────────────────────────────────

function WorkerCard({
  worker,
  isReporting,
  recentTasks,
  tasksCompletedCount,
  onClick,
}: {
  worker: Worker;
  isReporting: boolean;
  recentTasks: SwarmTaskRow[];
  tasksCompletedCount: number;
  onClick: () => void;
}) {
  const config = WORKER_TYPE_CONFIG[worker.type];

  const statusColor =
    worker.status === "working"
      ? "#22c55e"
      : worker.status === "idle"
      ? "#6b7280"
      : "#06b6d4";

  const statusLabel =
    isReporting
      ? "REPORTING"
      : worker.status === "working"
      ? "WORKING"
      : worker.status === "idle"
      ? "IDLE"
      : "MOVING";

  return (
    <motion.div
      layout
      onClick={onClick}
      className="relative cursor-pointer"
      style={{
        background: "rgba(10, 10, 15, 0.95)",
        border: isReporting
          ? `2px solid ${config.color}`
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 6,
        padding: "14px 16px",
        boxShadow: isReporting
          ? `0 0 24px ${config.color}44, 0 0 48px ${config.color}22, inset 0 0 20px ${config.color}08`
          : "0 2px 8px rgba(0,0,0,0.4)",
        transition: "border-color 0.3s, box-shadow 0.3s",
        fontFamily: "'JetBrains Mono', monospace",
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
    >
      {/* Reporting glow top bar */}
      {isReporting && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
            borderRadius: "6px 6px 0 0",
          }}
        />
      )}

      {/* Header: name + type icon + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
            style={{
              background: `${config.color}20`,
              color: config.color,
              border: `1px solid ${config.color}44`,
              boxShadow: isReporting ? `0 0 10px ${config.color}33` : "none",
            }}
          >
            {config.icon}
          </div>
          <div>
            <div
              className="text-xs font-bold"
              style={{ color: config.color, textShadow: `0 0 8px ${config.color}44` }}
            >
              {worker.name}
            </div>
            <div className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
              {config.label}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isReporting ? config.color : statusColor,
              boxShadow: isReporting
                ? `0 0 8px ${config.color}`
                : `0 0 4px ${statusColor}88`,
              animation: isReporting ? "pulse 1.5s ease-in-out infinite" : undefined,
            }}
          />
          <span
            className="text-[8px] uppercase tracking-[0.15em] font-bold"
            style={{ color: isReporting ? config.color : statusColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Current task */}
      <div
        className="text-[10px] mb-2 truncate"
        style={{ color: "rgba(255,255,255,0.65)" }}
        title={worker.task}
      >
        {worker.task}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-2">
        <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span style={{ color: "#eab308" }}>Lv.{worker.level}</span>
          <span className="mx-1">|</span>
          <span style={{ color: config.color }}>{worker.xp}xp</span>
        </div>
        <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          {tasksCompletedCount} tasks
        </div>
        <div className="text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>
          @ {getBuildingName(worker.currentBuildingId)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${worker.progress}%`,
            background: `linear-gradient(90deg, ${config.color}88, ${config.color})`,
            boxShadow: `0 0 6px ${config.color}66`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Last 3 completed tasks */}
      {recentTasks.length > 0 && (
        <div
          className="mt-2 pt-2 space-y-0.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="text-[7px] uppercase tracking-[0.2em] mb-1" style={{ color: `${config.color}66` }}>
            RECENT
          </div>
          {recentTasks.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-1.5">
              <span style={{ color: t.status === "completed" ? "#22c55e" : "#ef4444", fontSize: 8 }}>
                {t.status === "completed" ? "\u2713" : "\u2717"}
              </span>
              <span
                className="text-[8px] truncate flex-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
                title={t.title}
              >
                {t.title.length > 35 ? t.title.slice(0, 35) + "..." : t.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── STANDUP BOARD MODAL ─────────────────────────────────────────────────────

interface StandupBoardProps {
  workers: Worker[];
  onClose: () => void;
}

export function StandupBoard({ workers, onClose }: StandupBoardProps) {
  const [reportingIndex, setReportingIndex] = useState(0);
  const [focusedWorker, setFocusedWorker] = useState<string | null>(null);
  const [tasksByWorker, setTasksByWorker] = useState<Record<string, SwarmTaskRow[]>>({});
  const [tasksCompletedByWorker, setTasksCompletedByWorker] = useState<Record<string, number>>({});
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch task data from Supabase
  useEffect(() => {
    async function fetchTasks() {
      const { data: tasks } = await supabase
        .from("swarm_tasks")
        .select("id, title, status, task_type, project, assigned_worker_id, completed_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (!tasks) return;

      const grouped: Record<string, SwarmTaskRow[]> = {};
      const counts: Record<string, number> = {};

      for (const task of tasks) {
        const wid = task.assigned_worker_id;
        if (!wid) continue;
        if (!grouped[wid]) grouped[wid] = [];
        if (grouped[wid].length < 3) {
          grouped[wid].push(task);
        }
        if (task.status === "completed") {
          counts[wid] = (counts[wid] || 0) + 1;
        }
      }

      // Also map demo worker IDs to get some data
      for (const w of workers) {
        if (!grouped[w.id]) grouped[w.id] = [];
        if (!counts[w.id]) counts[w.id] = Math.floor(Math.random() * 15 + 3);
      }

      setTasksByWorker(grouped);
      setTasksCompletedByWorker(counts);
    }

    fetchTasks();
  }, [workers]);

  // Auto-cycle reporting worker every 5 seconds
  useEffect(() => {
    if (focusedWorker) return; // Don't auto-cycle if manually focused

    autoTimerRef.current = setInterval(() => {
      setReportingIndex((prev) => (prev + 1) % workers.length);
    }, 5000);

    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [workers.length, focusedWorker]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCardClick = useCallback(
    (workerId: string) => {
      const idx = workers.findIndex((w) => w.id === workerId);
      if (idx >= 0) {
        setReportingIndex(idx);
        setFocusedWorker(workerId);
        // Clear focus after 10 seconds to resume auto-cycle
        setTimeout(() => setFocusedWorker(null), 10000);
      }
    },
    [workers]
  );

  const reportingWorkerId = workers[reportingIndex]?.id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        background: "rgba(5, 5, 8, 0.92)",
        backdropFilter: "blur(8px)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal container */}
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-5xl mx-4"
        style={{
          maxHeight: "85vh",
          background: "linear-gradient(180deg, rgba(10, 10, 15, 0.98) 0%, rgba(5, 5, 8, 0.98) 100%)",
          border: "1px solid rgba(232, 160, 25, 0.25)",
          borderRadius: 8,
          boxShadow: "0 0 60px rgba(232, 160, 25, 0.08), 0 25px 80px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, transparent, #e8a019, transparent)",
            opacity: 0.7,
          }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(232, 160, 25, 0.12)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: "#e8a019",
                boxShadow: "0 0 12px rgba(232, 160, 25, 0.6)",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span
              className="text-sm font-bold uppercase tracking-[0.3em]"
              style={{ color: "#e8a019", textShadow: "0 0 20px rgba(232, 160, 25, 0.4)" }}
            >
              STANDUP BRIEFING
            </span>
            <span
              className="text-[9px] uppercase tracking-wider px-2 py-0.5"
              style={{
                color: "rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 3,
              }}
            >
              {workers.length} workers
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-cycle indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-1 h-1 rounded-full"
                style={{
                  background: focusedWorker ? "#6b7280" : "#22c55e",
                  boxShadow: focusedWorker ? "none" : "0 0 4px #22c55e88",
                }}
              />
              <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                {focusedWorker ? "PAUSED" : "AUTO"}
              </span>
            </div>

            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 hover:opacity-100 transition-opacity"
              style={{
                opacity: 0.5,
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Worker grid */}
        <div
          className="p-5 overflow-y-auto"
          style={{ maxHeight: "calc(85vh - 80px)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                isReporting={reportingWorkerId === worker.id}
                recentTasks={tasksByWorker[worker.id] || []}
                tasksCompletedCount={tasksCompletedByWorker[worker.id] || 0}
                onClick={() => handleCardClick(worker.id)}
              />
            ))}
          </div>
        </div>

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4" style={{ borderLeft: "2px solid rgba(232, 160, 25, 0.4)", borderTop: "2px solid rgba(232, 160, 25, 0.4)" }} />
        <div className="absolute top-0 right-0 w-4 h-4" style={{ borderRight: "2px solid rgba(232, 160, 25, 0.4)", borderTop: "2px solid rgba(232, 160, 25, 0.4)" }} />
        <div className="absolute bottom-0 left-0 w-4 h-4" style={{ borderLeft: "2px solid rgba(232, 160, 25, 0.25)", borderBottom: "2px solid rgba(232, 160, 25, 0.25)" }} />
        <div className="absolute bottom-0 right-0 w-4 h-4" style={{ borderRight: "2px solid rgba(232, 160, 25, 0.25)", borderBottom: "2px solid rgba(232, 160, 25, 0.25)" }} />
      </motion.div>

      {/* Pulse animation keyframes */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </motion.div>
  );
}
