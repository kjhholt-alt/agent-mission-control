"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Trophy, Zap, Clock, Cpu, DollarSign, ListChecks } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRealtimeConnection } from "@/lib/use-realtime-connection";
import { LastUpdated } from "./last-updated";
import { useToast } from "@/components/ui/toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface SwarmTask {
  id: string;
  task_type: string;
  title: string;
  status: string;
  project: string;
  cost_tier: string;
  priority: number;
  parent_task_id: string | null;
  actual_cost_cents: number | null;
  tokens_used: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  output_data: Record<string, unknown> | null;
  assigned_worker_id: string | null;
}

interface SwarmWorker {
  id: string;
  worker_name: string;
  worker_type: string;
  status: string;
}

// ── Worker type config ──────────────────────────────────────────────────────

const WORKER_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  builder:   { border: "border-cyan-500/40",    bg: "bg-cyan-500/10",    text: "text-cyan-400",    dot: "bg-cyan-400" },
  inspector: { border: "border-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  miner:     { border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  scout:     { border: "border-violet-500/40",  bg: "bg-violet-500/10",  text: "text-violet-400",  dot: "bg-violet-400" },
  forger:    { border: "border-orange-500/40",  bg: "bg-orange-500/10",  text: "text-orange-400",  dot: "bg-orange-400" },
  sentinel:  { border: "border-rose-500/40",    bg: "bg-rose-500/10",    text: "text-rose-400",    dot: "bg-rose-400" },
};

function getWorkerStyle(workerType: string) {
  return WORKER_COLORS[workerType?.toLowerCase()] || WORKER_COLORS.builder;
}

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

function formatCost(cents: number | null): string {
  if (cents === null || cents === undefined) return "$0.00";
  return `$${(cents / 100).toFixed(3)}`;
}

function formatTokens(tokens: number | null): string {
  if (!tokens) return "0";
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

function getOutputExcerpt(outputData: Record<string, unknown> | null, maxLen = 100): string {
  if (!outputData) return "";
  const str = typeof outputData === "string" ? outputData : JSON.stringify(outputData);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

// ── Stats Ticker ────────────────────────────────────────────────────────────

function StatsTicker({
  completedToday,
  spentToday,
  activeWorkers,
  queuedTasks,
}: {
  completedToday: number;
  spentToday: number;
  activeWorkers: number;
  queuedTasks: number;
}) {
  const items = [
    `${completedToday} tasks completed today`,
    `$${spentToday.toFixed(2)} spent`,
    `${activeWorkers} workers active`,
    `${queuedTasks} tasks queued`,
  ];

  // Duplicate for seamless loop
  const tickerText = [...items, ...items].join("  \u2022  ");

  return (
    <div className="relative overflow-hidden rounded-lg bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm">
      <div className="flex items-center">
        {/* LIVE badge */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800/80 border-r border-zinc-700/50 shrink-0 z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
        </div>
        {/* Scrolling ticker */}
        <div className="overflow-hidden flex-1 py-2">
          <div className="ticker-scroll whitespace-nowrap text-xs text-zinc-400 font-mono">
            {tickerText}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Highlight Card ──────────────────────────────────────────────────────────

function HighlightCard({ task, workerType, onClick }: { task: SwarmTask; workerType: string; onClick?: (id: string) => void }) {
  const style = getWorkerStyle(workerType);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onClick?.(task.id)}
      className="relative rounded-xl p-4 bg-zinc-900/80 backdrop-blur-md border border-amber-500/30 overflow-hidden cursor-pointer"
      style={{
        boxShadow: "0 0 20px rgba(234, 179, 8, 0.08), 0 0 40px rgba(234, 179, 8, 0.04)",
      }}
    >
      {/* Gold glow border effect */}
      <div className="absolute inset-0 rounded-xl border border-amber-400/20 pointer-events-none" />

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
            {workerType}
          </span>
        </div>
        {task.completed_at && (
          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
            {timeAgo(task.completed_at)}
          </span>
        )}
      </div>

      <h4 className="text-sm font-semibold text-zinc-200 mb-1.5 leading-snug">
        {task.title}
      </h4>

      {task.output_data && (
        <p className="text-xs text-zinc-400 font-mono leading-relaxed mb-2 line-clamp-2">
          {getOutputExcerpt(task.output_data, 200)}
        </p>
      )}

      <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
        {task.actual_cost_cents != null && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatCost(task.actual_cost_cents)}
          </span>
        )}
        {task.tokens_used != null && (
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            {formatTokens(task.tokens_used)} tokens
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Feed Item ───────────────────────────────────────────────────────────────

function FeedItem({ task, workerType, onClick }: { task: SwarmTask; workerType: string; onClick?: (id: string) => void }) {
  const style = getWorkerStyle(workerType);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={() => onClick?.(task.id)}
      className={`flex items-start gap-3 px-4 py-3 border-l-2 ${style.border} bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors cursor-pointer`}
    >
      {/* Worker badge */}
      <div className="shrink-0 mt-0.5">
        <span className={`inline-block w-2 h-2 rounded-full ${style.dot}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
            {workerType}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            {task.completed_at ? timeAgo(task.completed_at) : ""}
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-snug truncate">
          {task.title}
        </p>
        {task.output_data && (
          <p className="text-[11px] text-zinc-500 font-mono mt-1 truncate">
            {getOutputExcerpt(task.output_data)}
          </p>
        )}
      </div>

      {/* Cost / tokens */}
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {task.actual_cost_cents != null && (
          <span className="text-[10px] font-mono text-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {formatCost(task.actual_cost_cents)}
          </span>
        )}
        {task.tokens_used != null && (
          <span className="text-[10px] font-mono text-zinc-500">
            {formatTokens(task.tokens_used)}tk
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function LiveFeed({ onTaskClick }: { onTaskClick?: (id: string) => void } = {}) {
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [workers, setWorkers] = useState<SwarmWorker[]>([]);
  const [highlights, setHighlights] = useState<SwarmTask[]>([]);
  const [stats, setStats] = useState({
    completedToday: 0,
    spentToday: 0,
    activeWorkers: 0,
    queuedTasks: 0,
  });
  const workerMapRef = useRef<Map<string, SwarmWorker>>(new Map());
  const { markDataUpdate, lastUpdate } = useRealtimeConnection();
  const toast = useToast();

  // Build a lookup: worker_id -> worker_type
  const getWorkerType = useCallback((task: SwarmTask): string => {
    if (task.assigned_worker_id && workerMapRef.current.has(task.assigned_worker_id)) {
      return workerMapRef.current.get(task.assigned_worker_id)!.worker_type;
    }
    // Fallback: infer from task_type
    const tt = task.task_type?.toLowerCase() || "";
    if (tt.includes("build") || tt.includes("implement")) return "builder";
    if (tt.includes("eval") || tt.includes("review") || tt.includes("test")) return "inspector";
    if (tt.includes("research") || tt.includes("scan") || tt.includes("gather")) return "miner";
    if (tt.includes("plan") || tt.includes("decompose") || tt.includes("scout")) return "scout";
    return "builder";
  }, []);

  const fetchData = useCallback(async () => {
    // Fetch completed tasks
    const { data: completedTasks } = await supabase
      .from("swarm_tasks")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(30);

    if (completedTasks) setTasks(completedTasks);

    // Fetch workers for type mapping
    const { data: workerData } = await supabase
      .from("swarm_workers")
      .select("id, worker_name, worker_type, status");

    if (workerData) {
      setWorkers(workerData);
      const map = new Map<string, SwarmWorker>();
      for (const w of workerData) map.set(w.id, w);
      workerMapRef.current = map;
    }

    // Fetch highlights: completed in last 2 hours, ranked by tokens/cost
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: highlightData } = await supabase
      .from("swarm_tasks")
      .select("*")
      .eq("status", "completed")
      .gte("completed_at", twoHoursAgo)
      .order("tokens_used", { ascending: false })
      .limit(20);

    if (highlightData) {
      // Rank: prefer build tasks, then by tokens, then by cost
      const ranked = [...highlightData].sort((a, b) => {
        const aScore = (a.task_type === "build" ? 1000 : 0) + (a.tokens_used || 0) + ((a.actual_cost_cents || 0) * 10);
        const bScore = (b.task_type === "build" ? 1000 : 0) + (b.tokens_used || 0) + ((b.actual_cost_cents || 0) * 10);
        return bScore - aScore;
      });
      setHighlights(ranked.slice(0, 5));
    }

    // Compute stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: completedCount } = await supabase
      .from("swarm_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", todayStart.toISOString());

    const { data: budgetData } = await supabase
      .from("swarm_budgets")
      .select("api_spent_cents")
      .eq("budget_date", todayStart.toISOString().split("T")[0])
      .limit(1);

    const { count: queuedCount } = await supabase
      .from("swarm_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");

    setStats({
      completedToday: completedCount || 0,
      spentToday: budgetData?.[0]?.api_spent_cents ? budgetData[0].api_spent_cents / 100 : 0,
      activeWorkers: workerData?.filter((w) => w.status === "working").length || 0,
      queuedTasks: queuedCount || 0,
    });
  }, []);

  // Initial fetch + polling for highlights
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  // Realtime subscription for new completions
  useEffect(() => {
    const channel = supabase
      .channel("live-feed-tasks")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "swarm_tasks",
          filter: "status=eq.completed",
        },
        (payload) => {
          markDataUpdate();
          const newTask = payload.new as SwarmTask;
          setTasks((prev) => {
            // Avoid duplicates
            const filtered = prev.filter((t) => t.id !== newTask.id);
            return [newTask, ...filtered].slice(0, 30);
          });
          // Update stats
          setStats((prev) => ({
            ...prev,
            completedToday: prev.completedToday + 1,
            spentToday: prev.spentToday + (newTask.actual_cost_cents || 0) / 100,
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "swarm_tasks",
          filter: "status=eq.completed",
        },
        (payload) => {
          markDataUpdate();
          const newTask = payload.new as SwarmTask;
          setTasks((prev) => {
            const filtered = prev.filter((t) => t.id !== newTask.id);
            return [newTask, ...filtered].slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [markDataUpdate]);

  return (
    <div className="space-y-4">
      {/* Stats Ticker */}
      <StatsTicker
        completedToday={stats.completedToday}
        spentToday={stats.spentToday}
        activeWorkers={stats.activeWorkers}
        queuedTasks={stats.queuedTasks}
      />

      {/* Highlights */}
      {highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Highlights
            </h3>
            <span className="text-[10px] text-zinc-600 font-mono">last 2h</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {highlights.map((task) => (
              <HighlightCard
                key={task.id}
                task={task}
                workerType={getWorkerType(task)}
                onClick={onTaskClick}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Live Feed */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Live Feed
          </h3>
          <div className="flex items-center gap-1.5 ml-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono">
            {tasks.length} completed
          </span>
          <div className="flex-1" />
          <LastUpdated timestamp={lastUpdate} />
        </div>

        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm overflow-hidden divide-y divide-zinc-800/30">
          {tasks.length > 0 ? (
            <AnimatePresence initial={false}>
              {tasks.slice(0, 15).map((task) => (
                <FeedItem
                  key={task.id}
                  task={task}
                  workerType={getWorkerType(task)}
                  onClick={onTaskClick}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="py-8 text-center">
              <ListChecks className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
              <p className="text-xs text-zinc-600">No completed tasks yet</p>
              <p className="text-[10px] text-zinc-700 mt-1">Tasks will appear here as agents complete work</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Mobile Recent Wins ──────────────────────────────────────────────────────

export function MobileRecentWins() {
  const [tasks, setTasks] = useState<SwarmTask[]>([]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase
      .from("swarm_tasks")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5);

    if (data) setTasks(data);
  }, []);

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 10000);

    const channel = supabase
      .channel("mobile-recent-wins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_tasks" },
        () => fetchRecent()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchRecent]);

  if (tasks.length === 0) {
    return (
      <div style={{ color: "#555", padding: "4px 0" }}>
        No completed tasks yet.
      </div>
    );
  }

  return (
    <>
      {tasks.map((t) => {
        const cost = t.actual_cost_cents != null ? formatCost(t.actual_cost_cents) : "";
        const tokens = t.tokens_used ? `${formatTokens(t.tokens_used)}tk` : "";
        const ago = t.completed_at ? timeAgo(t.completed_at) : "";

        return (
          <div key={t.id} style={{ padding: "2px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#33ff33" }}>
                {"\u2713"}{" "}
                <span style={{ color: "#aaa" }}>
                  {t.title.length > 35 ? t.title.slice(0, 35) + "..." : t.title}
                </span>
              </span>
              <span style={{ color: "#555", fontSize: "10px" }}>{ago}</span>
            </div>
            {(cost || tokens) && (
              <div style={{ color: "#555", fontSize: "10px", paddingLeft: "16px" }}>
                {[cost, tokens].filter(Boolean).join(" | ")}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
