"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/lib/use-mobile";
import {
  Megaphone,
  Wifi,
  WifiOff,
  Activity,
  Users,
  DollarSign,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Radio,
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Building, Worker, AlertEvent, WorkerType } from "@/components/game3d/types";
import {
  BUILDINGS,
  INITIAL_WORKERS,
  INITIAL_EVENTS,
  NEW_EVENT_MESSAGES,
  SPEECH_BUBBLES,
  WORKER_TYPE_CONFIG,
} from "@/components/game3d/constants";
import { useGameData } from "@/components/game3d/useGameData";
import { StandupBoard } from "@/components/game3d/StandupBoard";

// Dynamic import -- R3F cannot run on the server
const GameCanvas = dynamic(
  () => import("@/components/game3d/GameCanvas"),
  { ssr: false }
);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).toUpperCase();
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface ActivityTask {
  id: string;
  title: string;
  status: string;
  task_type: string;
  completed_at: string | null;
  updated_at: string;
}

interface ActivityStats {
  completed: number;
  failed: number;
  total: number;
  lastActivity?: string | null;
}

const BUILDING_TO_PROJECT: Record<string, string> = {
  "command-center": "nexus",
  "buildkit": "buildkit-services",
  "email-finder": "email-finder",
  "barrelhouse": "BarrelHouseCRM",
  "pc-bottleneck": "pc-bottleneck-analyzer",
  "outdoor-crm": "outdoor-crm",
  "chess-academy": "ai-chess-coach",
  "finance-brief": "ai-finance-brief",
  "automation-hub": "automation-playground",
  "pl-engine": "pl-engine",
  "mcp-array": "mcp-servers",
  "nexus-hq": "nexus",
};

// Minimap isometric projection
const TILE_W = 80;
const TILE_H = 40;
function gridToIso(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

// ─── SHARED: Corner Brackets ────────────────────────────────────────────────

function CornerBrackets({ color, size = 6 }: { color: string; size?: number }) {
  const style = { position: "absolute" as const };
  const b = `1px solid ${color}`;
  return (
    <>
      <div style={{ ...style, top: 0, left: 0, width: size, height: size, borderLeft: b, borderTop: b }} />
      <div style={{ ...style, top: 0, right: 0, width: size, height: size, borderRight: b, borderTop: b }} />
      <div style={{ ...style, bottom: 0, left: 0, width: size, height: size, borderLeft: b, borderBottom: b }} />
      <div style={{ ...style, bottom: 0, right: 0, width: size, height: size, borderRight: b, borderBottom: b }} />
    </>
  );
}

// ─── SHARED: Status LED ─────────────────────────────────────────────────────

function StatusLED({ color, pulse = false, size = 6 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}44`,
        animation: pulse ? "ledPulse 2s ease-in-out infinite" : undefined,
        flexShrink: 0,
      }}
    />
  );
}

// ─── SHARED: Panel Shell ────────────────────────────────────────────────────

function HUDPanel({
  children,
  className = "",
  style = {},
  accentColor = "rgba(6, 182, 212, 0.4)",
  interactive = true,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  accentColor?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: "rgba(12, 16, 24, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid #1a2235",
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: interactive ? "auto" : "none",
        ...style,
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        }}
      />
      <CornerBrackets color="rgba(6, 182, 212, 0.25)" size={5} />
      {children}
    </div>
  );
}

// ─── StatusIcon ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <span style={{ color: "#10b981" }}>{"\u2713"}</span>;
  if (status === "failed") return <span style={{ color: "#ef4444" }}>{"\u2717"}</span>;
  if (status === "running" || status === "in_progress") return <span style={{ color: "#e8a019" }}>{"\u27F3"}</span>;
  return <span style={{ color: "#6b7280" }}>{"\u2022"}</span>;
}

// ─── ActivityFeed ───────────────────────────────────────────────────────────

function ActivityFeed({
  tasks,
  stats,
  loading,
  accentColor,
}: {
  tasks: ActivityTask[];
  stats: ActivityStats | null;
  loading: boolean;
  accentColor: string;
}) {
  return (
    <div
      className="px-3 pb-2"
      style={{ borderTop: `1px solid ${accentColor}15` }}
    >
      <div
        className="text-[7px] uppercase tracking-[0.25em] font-bold pt-2 pb-1.5"
        style={{ color: `${accentColor}88` }}
      >
        RECENT ACTIVITY
      </div>

      {loading ? (
        <div className="text-[9px] py-2 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          Loading...
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-[9px] py-2 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          No activity recorded
        </div>
      ) : (
        <div className="space-y-px">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-1.5 py-0.5 px-1.5"
              style={{
                background: "rgba(255,255,255,0.015)",
                borderRadius: 2,
              }}
            >
              <span className="text-[9px] flex-shrink-0 w-3 text-center">
                <StatusIcon status={task.status} />
              </span>
              <span
                className="text-[9px] flex-1 truncate"
                style={{ color: "rgba(255,255,255,0.6)" }}
                title={task.title}
              >
                {task.title.length > 35 ? task.title.slice(0, 35) + "..." : task.title}
              </span>
              <span
                className="text-[7px] uppercase tracking-wider px-1 py-px flex-shrink-0"
                style={{
                  color: accentColor,
                  background: `${accentColor}10`,
                  border: `1px solid ${accentColor}20`,
                  borderRadius: 2,
                }}
              >
                {task.task_type}
              </span>
              <span
                className="text-[8px] tabular-nums flex-shrink-0 w-10 text-right"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {timeAgo(task.updated_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {stats && !loading && (
        <div
          className="flex items-center gap-2 mt-1.5 pt-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <span className="text-[8px] tabular-nums" style={{ color: "#10b981" }}>
            {stats.completed} ok
          </span>
          <span className="text-[8px] tabular-nums" style={{ color: "#ef4444" }}>
            {stats.failed} fail
          </span>
          {stats.lastActivity && (
            <span className="text-[8px] ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>
              {timeAgo(stats.lastActivity)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 1: TOP RIBBON
// ═══════════════════════════════════════════════════════════════════════════

function TopRibbon({
  time,
  date,
  workerCount,
  isDemo,
  isConnected,
}: {
  time: string;
  date: string;
  workerCount: number;
  isDemo: boolean;
  isConnected: boolean;
}) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
      style={{
        height: 32,
        background: "rgba(12, 16, 24, 0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a2235",
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: "auto",
      }}
    >
      {/* Left cluster */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <StatusLED color={isConnected ? "#10b981" : "#ef4444"} pulse={isConnected} size={5} />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.3em]"
            style={{ color: "#e8a019", textShadow: "0 0 12px rgba(232, 160, 25, 0.3)" }}
          >
            NEXUS FACTORY
          </span>
        </div>
        <div style={{ width: 1, height: 14, background: "#1a2235" }} />
        <div className="flex items-center gap-1">
          {isConnected ? <Wifi size={9} style={{ color: "#10b981" }} /> : <WifiOff size={9} style={{ color: "#ef4444" }} />}
          <span className="text-[8px] uppercase tracking-wider" style={{ color: isConnected ? "#10b981" : "#ef4444" }}>
            {isConnected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Center: clock */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] tabular-nums font-bold" style={{ color: "rgba(6, 182, 212, 0.9)", textShadow: "0 0 8px rgba(6, 182, 212, 0.3)" }}>
          {time}
        </span>
        <span className="text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
          {date}
        </span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Users size={9} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span className="text-[9px] tabular-nums font-bold" style={{ color: "#06b6d4" }}>
            {workerCount}
          </span>
          <span className="text-[7px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
            WORKERS
          </span>
        </div>
        <div style={{ width: 1, height: 14, background: "#1a2235" }} />
        <div
          className="px-1.5 py-px text-[7px] uppercase tracking-[0.2em] font-bold"
          style={{
            color: isDemo ? "#e8a019" : "#10b981",
            background: isDemo ? "rgba(232, 160, 25, 0.1)" : "rgba(16, 185, 129, 0.1)",
            border: `1px solid ${isDemo ? "rgba(232, 160, 25, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
            borderRadius: 2,
          }}
        >
          {isDemo ? "DEMO" : "LIVE"}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 2: LEFT SIDEBAR (Selected building details)
// ═══════════════════════════════════════════════════════════════════════════

function LeftSidebar({
  building,
  onClose,
}: {
  building: Building;
  onClose: () => void;
}) {
  const [recentTasks, setRecentTasks] = useState<ActivityTask[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      setLoadingActivity(true);
      try {
        const res = await fetch(`/api/building-activity?building=${encodeURIComponent(building.id)}`);
        if (res.ok) {
          const data = await res.json();
          setRecentTasks(data.tasks ?? []);
          setActivityStats(data.stats ?? null);
        }
      } catch {
        // silently fail
      }
      setLoadingActivity(false);
    }
    fetchActivity();
  }, [building.id]);

  const statusColor =
    building.status === "active" ? "#10b981"
    : building.status === "warning" ? "#e8a019"
    : building.status === "error" ? "#ef4444"
    : "#6b7280";

  const statusLabel =
    building.status === "active" ? "OPERATIONAL"
    : building.status === "warning" ? "DEGRADED"
    : building.status === "error" ? "CRITICAL"
    : "STANDBY";

  return (
    <motion.div
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute left-0 z-30 overflow-y-auto overflow-x-hidden"
      style={{
        top: 32,
        bottom: 36,
        width: 280,
        pointerEvents: "auto",
      }}
    >
      <HUDPanel accentColor={building.color} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div className="p-3" style={{ borderBottom: `1px solid ${building.color}22` }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <StatusLED color={statusColor} pulse={building.status === "active"} size={6} />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: building.color, textShadow: `0 0 8px ${building.glowColor}` }}
              >
                {building.name}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-5 h-5 transition-opacity opacity-40 hover:opacity-100"
              style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, background: "rgba(255,255,255,0.03)" }}
            >
              <X size={10} />
            </button>
          </div>
          <p className="text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            {building.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="px-1.5 py-px text-[7px] uppercase tracking-[0.15em] font-bold"
              style={{ color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30`, borderRadius: 2 }}
            >
              {statusLabel}
            </div>
            <span className="text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
              [{building.gridX}, {building.gridY}]
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-px p-2" style={{ background: "rgba(0,0,0,0.2)" }}>
          {[
            { label: "TESTS", value: building.stats.tests, color: "#10b981" },
            { label: "DEPLOYS", value: building.stats.deploys, color: "#06b6d4" },
            { label: "UPTIME", value: building.stats.uptime, color: "#e8a019" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center py-1.5 px-1"
              style={{ background: "rgba(12, 16, 24, 0.6)" }}
            >
              <div className="text-[7px] uppercase tracking-[0.2em] mb-0.5" style={{ color: `${stat.color}88` }}>
                {stat.label}
              </div>
              <div className="text-sm font-bold tabular-nums" style={{ color: stat.color, textShadow: `0 0 6px ${stat.color}33` }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto">
          <ActivityFeed
            tasks={recentTasks}
            stats={activityStats}
            loading={loadingActivity}
            accentColor={building.color}
          />
        </div>

        <CornerBrackets color={`${building.color}44`} size={6} />
      </HUDPanel>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 2b: LEFT SIDEBAR (Selected worker details)
// ═══════════════════════════════════════════════════════════════════════════

function LeftSidebarWorker({
  worker,
  buildings,
  onClose,
}: {
  worker: Worker;
  buildings: Building[];
  onClose: () => void;
}) {
  const config = WORKER_TYPE_CONFIG[worker.type];
  const current = buildings.find((b) => b.id === worker.currentBuildingId);
  const target = buildings.find((b) => b.id === worker.targetBuildingId);
  const [recentTasks, setRecentTasks] = useState<ActivityTask[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      setLoadingActivity(true);
      try {
        const res = await fetch(`/api/building-activity?worker=${encodeURIComponent(worker.id)}`);
        if (res.ok) {
          const data = await res.json();
          setRecentTasks(data.tasks ?? []);
          setActivityStats(data.stats ?? null);
        }
      } catch {
        // silently fail
      }
      setLoadingActivity(false);
    }
    fetchActivity();
  }, [worker.id]);

  const statusColor = worker.status === "working" ? "#10b981" : worker.status === "idle" ? "#6b7280" : "#06b6d4";

  return (
    <motion.div
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute left-0 z-30 overflow-y-auto overflow-x-hidden"
      style={{
        top: 32,
        bottom: 36,
        width: 280,
        pointerEvents: "auto",
      }}
    >
      <HUDPanel accentColor={config.color} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div className="p-3" style={{ borderBottom: `1px solid ${config.color}22` }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 flex items-center justify-center text-[10px] font-bold"
                style={{ background: `${config.color}18`, color: config.color, border: `1px solid ${config.color}33`, borderRadius: 3 }}
              >
                {config.icon}
              </div>
              <div>
                <div className="text-[10px] font-bold" style={{ color: config.color, textShadow: `0 0 8px ${config.color}44` }}>
                  {worker.name}
                </div>
                <div className="text-[7px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {config.label}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-5 h-5 transition-opacity opacity-40 hover:opacity-100"
              style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, background: "rgba(255,255,255,0.03)" }}
            >
              <X size={10} />
            </button>
          </div>

          {/* Status + Level */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <StatusLED color={statusColor} pulse={worker.status === "working"} size={5} />
              <span className="text-[7px] uppercase tracking-[0.15em] font-bold" style={{ color: statusColor }}>
                {worker.status}
              </span>
            </div>
            <span className="text-[8px] font-bold px-1 py-px" style={{ background: `${config.color}12`, color: config.color, borderRadius: 2, border: `1px solid ${config.color}25` }}>
              Lv.{worker.level}
            </span>
          </div>
        </div>

        {/* XP bar */}
        <div className="px-3 pt-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>XP</span>
            <span className="text-[8px] tabular-nums" style={{ color: "#e8a019" }}>{worker.xp}/100</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${worker.xp}%`, background: "linear-gradient(90deg, #e8a019, #f59e0b)", boxShadow: "0 0 4px #e8a01966", transition: "width 0.5s ease" }}
            />
          </div>
        </div>

        {/* Current task */}
        <div className="px-3 pt-2 pb-1">
          <div className="text-[7px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>CURRENT TASK</div>
          <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.7)" }}>{worker.task}</div>
        </div>

        {/* Route */}
        <div className="px-3 py-1.5 grid grid-cols-2 gap-1.5">
          <div className="p-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 2 }}>
            <div className="text-[7px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>FROM</div>
            <div className="text-[9px] font-bold" style={{ color: current?.color }}>{current?.shortName || "\u2014"}</div>
          </div>
          <div className="p-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 2 }}>
            <div className="text-[7px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>TO</div>
            <div className="text-[9px] font-bold" style={{ color: target?.color }}>{target?.shortName || "\u2014"}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-3 py-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>PROGRESS</span>
            <span className="text-[8px] tabular-nums font-bold" style={{ color: config.color }}>{Math.round(worker.progress)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${worker.progress}%`, background: config.color, boxShadow: `0 0 4px ${config.color}66`, transition: "width 0.5s ease" }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-3 py-2 grid grid-cols-3 gap-1">
          {[
            { label: "Resume", color: "#10b981", action: "resume" },
            { label: "Redirect", color: "#e8a019", action: "redirect" },
            { label: "Stop", color: "#ef4444", action: "stop" },
          ].map((btn) => (
            <button
              key={btn.label}
              className="py-1 text-[7px] uppercase tracking-[0.1em] font-bold transition-all cursor-pointer"
              style={{
                background: `${btn.color}08`,
                color: btn.color,
                border: `1px solid ${btn.color}30`,
                borderRadius: 2,
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = `${btn.color}18`; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = `${btn.color}08`; }}
              onClick={async () => {
                if (btn.action === "stop") {
                  if (!confirm("Stop this worker?")) return;
                  await fetch("/api/webhook", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-nexus-key": process.env.NEXT_PUBLIC_NEXUS_API_KEY || "nexus-hive-2026" },
                    body: JSON.stringify({ event: "stop_worker", data: { worker_id: worker.id } }),
                  });
                  onClose();
                } else if (btn.action === "redirect") {
                  const newGoal = prompt("Enter new instructions for this worker:");
                  if (!newGoal) return;
                  await fetch("/api/webhook", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-nexus-key": process.env.NEXT_PUBLIC_NEXUS_API_KEY || "nexus-hive-2026" },
                    body: JSON.stringify({ goal: newGoal, project: "nexus" }),
                  });
                  alert("New task created! Worker will pick it up shortly.");
                } else if (btn.action === "resume") {
                  alert("Worker is already running.");
                }
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Activity feed */}
        <div className="flex-1 overflow-y-auto">
          <ActivityFeed
            tasks={recentTasks}
            stats={activityStats}
            loading={loadingActivity}
            accentColor={config.color}
          />
        </div>

        <CornerBrackets color={`${config.color}44`} size={6} />
      </HUDPanel>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 3: BOTTOM STRIP (Event ticker)
// ═══════════════════════════════════════════════════════════════════════════

function BottomStrip({ events }: { events: AlertEvent[] }) {
  const typeColors: Record<string, string> = {
    success: "#10b981",
    info: "#06b6d4",
    warning: "#e8a019",
    error: "#ef4444",
  };

  const visible = events.slice(0, 6);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 flex items-center"
      style={{
        height: 36,
        background: "rgba(12, 16, 24, 0.9)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #1a2235",
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: "auto",
      }}
    >
      {/* Label */}
      <div className="flex items-center gap-1.5 px-3 h-full flex-shrink-0" style={{ borderRight: "1px solid #1a2235" }}>
        <Radio size={8} style={{ color: "#06b6d4" }} />
        <span className="text-[7px] uppercase tracking-[0.2em] font-bold" style={{ color: "rgba(6, 182, 212, 0.6)" }}>
          EVENT FEED
        </span>
        <StatusLED color="#10b981" pulse size={4} />
      </div>

      {/* Scrolling events */}
      <div className="flex-1 overflow-hidden h-full flex items-center">
        <div className="flex items-center gap-4 px-3 animate-ticker">
          {visible.map((event) => (
            <div key={event.id} className="flex items-center gap-1.5 flex-shrink-0">
              <StatusLED color={typeColors[event.type] || "#06b6d4"} size={4} />
              <span className="text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
                {event.time}
              </span>
              <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                {event.message.length > 60 ? event.message.slice(0, 57) + "..." : event.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 4: RIGHT MINI-PANEL (Worker roster)
// ═══════════════════════════════════════════════════════════════════════════

function WorkerRoster({
  workers,
  selectedWorkerId,
  onSelectWorker,
}: {
  workers: Worker[];
  selectedWorkerId: string | null;
  onSelectWorker: (id: string) => void;
}) {
  const statusColor = (s: Worker["status"]) =>
    s === "working" ? "#10b981" : s === "idle" ? "#6b7280" : "#06b6d4";

  return (
    <div
      className="absolute right-0 z-30 overflow-y-auto overflow-x-hidden"
      style={{
        top: 32,
        bottom: 36,
        width: 200,
        pointerEvents: "auto",
      }}
    >
      <HUDPanel accentColor="rgba(6, 182, 212, 0.4)" style={{ height: "100%" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-2" style={{ borderBottom: "1px solid #1a2235" }}>
          <div className="flex items-center gap-1.5">
            <Users size={9} style={{ color: "#06b6d4" }} />
            <span className="text-[7px] uppercase tracking-[0.2em] font-bold" style={{ color: "rgba(6, 182, 212, 0.7)" }}>
              WORKER ROSTER
            </span>
          </div>
          <span className="text-[8px] tabular-nums font-bold" style={{ color: "#06b6d4" }}>
            {workers.length}
          </span>
        </div>

        {/* Worker list */}
        <div className="p-1.5 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100% - 32px)" }}>
          {workers.map((w) => {
            const config = WORKER_TYPE_CONFIG[w.type];
            const isSelected = w.id === selectedWorkerId;
            return (
              <div
                key={w.id}
                className="relative cursor-pointer p-1.5 transition-colors"
                style={{
                  background: isSelected ? `${config.color}12` : "rgba(255,255,255,0.015)",
                  border: isSelected ? `1px solid ${config.color}44` : "1px solid transparent",
                  borderRadius: 3,
                }}
                onClick={() => onSelectWorker(w.id)}
                onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {/* Type icon */}
                  <div
                    className="w-4 h-4 flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                    style={{ background: `${config.color}15`, color: config.color, borderRadius: 2 }}
                  >
                    {config.icon}
                  </div>
                  <span className="text-[8px] font-bold truncate" style={{ color: config.color }}>
                    {w.name}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <StatusLED color={statusColor(w.status)} size={4} />
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-px rounded-full overflow-hidden ml-5" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${w.progress}%`,
                      background: config.color,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <div className="text-[7px] truncate ml-5 mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {w.task.length > 28 ? w.task.slice(0, 25) + "..." : w.task}
                </div>
              </div>
            );
          })}
        </div>
      </HUDPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 5: BOTTOM-RIGHT MINIMAP
// ═══════════════════════════════════════════════════════════════════════════

function MinimapHUD({
  buildings,
  workers,
}: {
  buildings: Building[];
  workers: Worker[];
}) {
  return (
    <div
      className="absolute z-30"
      style={{
        right: 200,
        bottom: 36,
        width: 180,
        height: 120,
        pointerEvents: "auto",
      }}
    >
      <HUDPanel accentColor="rgba(6, 182, 212, 0.3)" style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <div className="flex items-center gap-1 px-2 py-1" style={{ borderBottom: "1px solid #1a2235" }}>
          <MapPin size={7} style={{ color: "rgba(6, 182, 212, 0.5)" }} />
          <span className="text-[6px] uppercase tracking-[0.2em] font-bold" style={{ color: "rgba(6, 182, 212, 0.5)" }}>
            TACTICAL MAP
          </span>
        </div>
        <svg viewBox="-120 -20 600 340" width={180} height={100} className="block">
          {/* Grid dots */}
          {Array.from({ length: 14 }, (_, x) =>
            Array.from({ length: 14 }, (_, y) => {
              const pos = gridToIso(x, y);
              return (
                <circle
                  key={`${x}-${y}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={0.4}
                  fill="rgba(6, 182, 212, 0.06)"
                />
              );
            })
          )}
          {/* Building dots */}
          {buildings.map((b) => {
            const pos = gridToIso(b.gridX, b.gridY);
            return (
              <g key={b.id}>
                <rect
                  x={pos.x - 3 * b.size}
                  y={pos.y - 2 * b.size}
                  width={6 * b.size}
                  height={4 * b.size}
                  fill={b.color}
                  opacity={b.status === "active" ? 0.85 : 0.25}
                  rx={1}
                />
                {b.status === "active" && (
                  <rect
                    x={pos.x - 4 * b.size}
                    y={pos.y - 3 * b.size}
                    width={8 * b.size}
                    height={6 * b.size}
                    fill={b.color}
                    opacity={0.12}
                    rx={2}
                  >
                    <animate attributeName="opacity" values="0.08;0.2;0.08" dur="2s" repeatCount="indefinite" />
                  </rect>
                )}
              </g>
            );
          })}
          {/* Worker dots */}
          {workers.map((w) => {
            const cur = buildings.find((b) => b.id === w.currentBuildingId);
            const tgt = buildings.find((b) => b.id === w.targetBuildingId);
            if (!cur || !tgt) return null;
            const pp1 = gridToIso(cur.gridX, cur.gridY);
            const pp2 = gridToIso(tgt.gridX, tgt.gridY);
            const tt = w.progress / 100;
            return (
              <circle
                key={w.id}
                cx={pp1.x + (pp2.x - pp1.x) * tt}
                cy={pp1.y + (pp2.y - pp1.y) * tt}
                r={1.8}
                fill={WORKER_TYPE_CONFIG[w.type].color}
              >
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
              </circle>
            );
          })}
        </svg>
      </HUDPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 6: TOP-RIGHT BUDGET/METRICS
// ═══════════════════════════════════════════════════════════════════════════

function MetricsPanel({
  budget,
}: {
  budget: { apiSpent: number; apiLimit: number; minutesUsed: number; minutesLimit: number; tasksCompleted: number; tasksFailed: number } | null;
}) {
  const apiSpent = budget ? (budget.apiSpent / 100).toFixed(2) : "0.00";
  const apiLimit = budget ? (budget.apiLimit / 100).toFixed(0) : "10";
  const apiPct = budget ? Math.min((budget.apiSpent / budget.apiLimit) * 100, 100) : 0;
  const tasksOk = budget?.tasksCompleted ?? 0;
  const tasksFail = budget?.tasksFailed ?? 0;

  const rows = [
    { label: "API SPEND", value: `$${apiSpent}`, max: `$${apiLimit}`, pct: apiPct, color: apiPct > 80 ? "#ef4444" : "#e8a019" },
    { label: "COMPLETED", value: `${tasksOk}`, max: "", pct: 100, color: "#10b981" },
    { label: "FAILED", value: `${tasksFail}`, max: "", pct: 100, color: tasksFail > 0 ? "#ef4444" : "#6b7280" },
  ];

  return (
    <div
      className="absolute z-30"
      style={{
        top: 40,
        right: 8,
        width: 184,
        pointerEvents: "auto",
      }}
    >
      <HUDPanel accentColor="rgba(232, 160, 25, 0.4)">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderBottom: "1px solid #1a2235" }}>
          <DollarSign size={8} style={{ color: "#e8a019" }} />
          <span className="text-[7px] uppercase tracking-[0.2em] font-bold" style={{ color: "rgba(232, 160, 25, 0.7)" }}>
            BUDGET / METRICS
          </span>
        </div>
        <div className="p-2 space-y-2">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[7px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.label}</span>
                <span className="text-[9px] tabular-nums font-bold" style={{ color: r.color }}>
                  {r.value}
                  {r.max && <span style={{ color: "rgba(255,255,255,0.2)" }}> / {r.max}</span>}
                </span>
              </div>
              {r.max && (
                <div className="h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full" style={{ width: `${r.pct}%`, background: r.color, transition: "width 0.5s ease" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </HUDPanel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HUD PANEL 7: STANDUP BUTTON (floating)
// ═══════════════════════════════════════════════════════════════════════════

function StandupButton({
  onClick,
  hasActiveWorkers,
}: {
  onClick: () => void;
  hasActiveWorkers: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute z-30 flex items-center gap-1.5 cursor-pointer transition-all"
      style={{
        bottom: 44,
        left: 8,
        padding: "5px 10px",
        background: hasActiveWorkers ? "rgba(232, 160, 25, 0.12)" : "rgba(12, 16, 24, 0.85)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${hasActiveWorkers ? "rgba(232, 160, 25, 0.4)" : "#1a2235"}`,
        borderRadius: 3,
        color: "#e8a019",
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: "auto",
        boxShadow: hasActiveWorkers ? "0 0 12px rgba(232, 160, 25, 0.15)" : "none",
        animation: hasActiveWorkers ? "standupGlow 2s ease-in-out infinite" : "none",
      }}
      title="Standup Briefing (S)"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(232, 160, 25, 0.6)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = hasActiveWorkers ? "rgba(232, 160, 25, 0.4)" : "#1a2235"; }}
    >
      <Megaphone size={11} />
      <span className="text-[8px] uppercase tracking-[0.15em] font-bold">
        STANDUP
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOVER TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════

function BuildingTooltip({ building }: { building: Building }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="fixed z-40 pointer-events-none px-2.5 py-1.5"
      style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(12, 16, 24, 0.92)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${building.color}44`,
        borderRadius: 3,
        boxShadow: `0 0 16px ${building.glowColor}`,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <StatusLED color={building.color} size={5} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: building.color }}>
          {building.name}
        </span>
      </div>
      <div className="text-[8px]" style={{ color: "rgba(255,255,255,0.45)" }}>
        {building.description}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function GamePage() {
  const isMobile = useIsMobile();
  const [time, setTime] = useState(formatTime());
  const [date, setDate] = useState(formatDate());
  const gameData = useGameData();
  const [demoWorkers, setDemoWorkers] = useState(INITIAL_WORKERS);
  const [demoEvents, setDemoEvents] = useState(INITIAL_EVENTS);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [showStandup, setShowStandup] = useState(false);

  // Use live data when available, demo data as fallback
  const workers = gameData.isDemo ? demoWorkers : gameData.workers;
  const events = gameData.isDemo ? demoEvents : gameData.events;
  const buildings = gameData.buildings;

  // Clock
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
      setDate(formatDate());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animate demo workers ONLY when in demo mode
  useEffect(() => {
    if (!gameData.isDemo) return;

    const interval = setInterval(() => {
      setDemoWorkers((prev) =>
        prev.map((w) => {
          let newProgress = w.progress + (Math.random() * 3 + 1);
          let newStatus = w.status;
          let newCurrent = w.currentBuildingId;
          let newTarget = w.targetBuildingId;
          let newTask = w.task;
          let newSpeech = w.speechBubble;
          let newLevel = w.level;
          let newXp = w.xp;
          let newEvolving = false;

          if (Math.random() < 0.05) {
            newSpeech = SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)];
          } else if (Math.random() < 0.15) {
            newSpeech = null;
          }

          if (newProgress >= 100) {
            newProgress = 0;
            newCurrent = w.targetBuildingId;
            const others = BUILDINGS.filter((b) => b.id !== newCurrent);
            const next = others[Math.floor(Math.random() * others.length)];
            newTarget = next.id;
            newStatus = Math.random() > 0.3 ? "moving" : "working";
            const tasks = [
              "Deploying latest changes",
              "Running test suite",
              "Syncing data pipeline",
              "Health check sweep",
              "Optimizing queries",
              "Generating SEO content",
              "Processing automation data",
              "Building CRM module",
              "Updating MCP configs",
              "Analyzing trade data",
            ];
            newTask = tasks[Math.floor(Math.random() * tasks.length)];
            newSpeech = "Job's done!";

            newXp = w.xp + Math.floor(Math.random() * 8 + 3);
            if (newXp >= 100) {
              newXp = 0;
              newLevel = w.level + 1;
              newEvolving = true;
              newSpeech = "LEVEL UP!";
            }
          }

          return {
            ...w,
            progress: newProgress,
            status: newStatus,
            currentBuildingId: newCurrent,
            targetBuildingId: newTarget,
            task: newTask,
            speechBubble: newSpeech,
            level: newLevel,
            xp: newXp,
            evolving: newEvolving,
          };
        })
      );
    }, 400);

    return () => clearInterval(interval);
  }, [gameData.isDemo]);

  // Clear evolving state (demo mode only)
  useEffect(() => {
    if (!gameData.isDemo) return;
    const evolvingWorkers = demoWorkers.filter((w) => w.evolving);
    if (evolvingWorkers.length > 0) {
      const timeout = setTimeout(() => {
        setDemoWorkers((prev) => prev.map((w) => ({ ...w, evolving: false })));
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [demoWorkers, gameData.isDemo]);

  // Demo events (only when in demo mode)
  useEffect(() => {
    if (!gameData.isDemo) return;

    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        const msg = NEW_EVENT_MESSAGES[Math.floor(Math.random() * NEW_EVENT_MESSAGES.length)];
        const newEvent: AlertEvent = {
          id: `e-${Date.now()}`,
          time: formatTime(),
          message: msg.message,
          type: msg.type,
        };
        setDemoEvents((prev) => [newEvent, ...prev].slice(0, 20));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [gameData.isDemo]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showStandup) {
          setShowStandup(false);
        } else {
          setSelectedBuilding(null);
          setSelectedWorker(null);
        }
      }
      if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        setShowStandup((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showStandup]);

  // Derived
  const selectedBuildingData = buildings.find((b) => b.id === selectedBuilding);
  const selectedWorkerData = workers.find((w) => w.id === selectedWorker);
  const hoveredBuildingData = buildings.find((b) => b.id === hoveredBuilding);

  const activeCount = workers.filter((w) => w.status === "moving" || w.status === "working").length;
  const hasLeftPanel = !!selectedBuildingData || !!selectedWorkerData;

  const handleClickBuilding = useCallback((id: string) => {
    if (id === "") {
      setSelectedBuilding(null);
      setSelectedWorker(null);
    } else {
      setSelectedBuilding(id);
      setSelectedWorker(null);
    }
  }, []);

  const handleClickWorker = useCallback((id: string) => {
    setSelectedWorker(id);
    setSelectedBuilding(null);
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: "#080b12",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ── 3D CANVAS (full background) ── */}
      <div className="absolute inset-0 z-0">
        <GameCanvas
          hoveredBuilding={hoveredBuilding}
          selectedBuilding={selectedBuilding}
          selectedWorker={selectedWorker}
          workers={workers}
          buildings={buildings}
          conveyors={gameData.conveyors}
          onHoverBuilding={setHoveredBuilding}
          onClickBuilding={handleClickBuilding}
          onClickWorker={handleClickWorker}
          isMobile={isMobile}
          isStandupActive={showStandup}
        />
      </div>

      {/* ── Vignette ── */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(8, 11, 18, 0.5) 75%, rgba(8, 11, 18, 0.85) 100%)",
        }}
      />

      {/* ── Scanline overlay (subtle) ── */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6, 182, 212, 0.015) 3px, rgba(6, 182, 212, 0.015) 4px)",
          mixBlendMode: "overlay",
        }}
      />

      {/* ── HUD OVERLAY CONTAINER (pointer-events: none, children opt-in) ── */}
      <div className="fixed inset-0 z-20 pointer-events-none">

        {/* 1. Top Ribbon */}
        <TopRibbon
          time={time}
          date={date}
          workerCount={workers.length}
          isDemo={gameData.isDemo}
          isConnected={!gameData.isDemo}
        />

        {/* 2. Left Sidebar (building or worker) */}
        <AnimatePresence>
          {selectedBuildingData && !isMobile && (
            <LeftSidebar
              key={`building-${selectedBuildingData.id}`}
              building={selectedBuildingData}
              onClose={() => setSelectedBuilding(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selectedWorkerData && !isMobile && (
            <LeftSidebarWorker
              key={`worker-${selectedWorkerData.id}`}
              worker={selectedWorkerData}
              buildings={buildings}
              onClose={() => setSelectedWorker(null)}
            />
          )}
        </AnimatePresence>

        {/* 3. Bottom Event Strip */}
        <BottomStrip events={events} />

        {/* 4. Right Worker Roster */}
        {!isMobile && (
          <WorkerRoster
            workers={workers}
            selectedWorkerId={selectedWorker}
            onSelectWorker={handleClickWorker}
          />
        )}

        {/* 5. Minimap */}
        {!isMobile && (
          <MinimapHUD buildings={buildings} workers={workers} />
        )}

        {/* 6. Budget/Metrics */}
        {!isMobile && (
          <MetricsPanel budget={gameData.budget} />
        )}

        {/* 7. Standup Button */}
        {!isMobile && (
          <StandupButton
            onClick={() => setShowStandup(true)}
            hasActiveWorkers={activeCount > 0}
          />
        )}

        {/* Building hover tooltip */}
        <AnimatePresence>
          {hoveredBuildingData && !selectedBuilding && !isMobile && (
            <BuildingTooltip building={hoveredBuildingData} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Standup Board Modal ── */}
      <AnimatePresence>
        {showStandup && (
          <StandupBoard
            workers={workers}
            onClose={() => setShowStandup(false)}
          />
        )}
      </AnimatePresence>

      {/* ── CSS Animations ── */}
      <style jsx global>{`
        @keyframes ledPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes standupGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(232, 160, 25, 0.1); }
          50% { box-shadow: 0 0 14px rgba(232, 160, 25, 0.3); }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          /* Simple left-align; no infinite scroll needed for 6 items */
        }
      `}</style>
    </div>
  );
}
