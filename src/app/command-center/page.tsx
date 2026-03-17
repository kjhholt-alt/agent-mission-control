"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Activity,
  DollarSign,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  GitBranch,
  Wrench,
  Trophy,
  Zap,
  RefreshCw,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCost, formatTokens } from "@/lib/pricing";
import { getUnlockedCount } from "@/lib/achievements";
import type { NexusSession } from "@/lib/collector-types";
import { SuccessRateChart } from "@/components/charts/dashboard-charts";

interface TaskSummary {
  queued: number;
  running: number;
  completed_today: number;
  failed_today: number;
}

interface CostSummary {
  today: number;
  week: number;
  month: number;
}

interface RecentTask {
  id: string;
  title: string;
  project: string;
  status: string;
  completed_at: string | null;
  actual_cost_cents: number;
}

interface ChartTask {
  status: string;
  created_at: string;
}

export default function CommandCenterPage() {
  const [tasks, setTasks] = useState<TaskSummary>({ queued: 0, running: 0, completed_today: 0, failed_today: 0 });
  const [costs, setCosts] = useState<CostSummary>({ today: 0, week: 0, month: 0 });
  const [sessions, setSessions] = useState<NexusSession[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [chartTasks, setChartTasks] = useState<ChartTask[]>([]);
  const [achievements, setAchievements] = useState({ unlocked: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [taskRes, sessionRes, recentRes, todayCostRes, weekCostRes, monthCostRes, chartTasksRes] = await Promise.all([
      supabase.from("swarm_tasks").select("status").gte("updated_at", todayStart),
      supabase.from("nexus_sessions").select("*").eq("status", "active").order("last_activity", { ascending: false }).limit(10),
      supabase.from("swarm_tasks").select("id,title,project,status,completed_at,actual_cost_cents").eq("status", "completed").order("completed_at", { ascending: false }).limit(15),
      supabase.from("nexus_sessions").select("cost_usd").gte("last_activity", todayStart),
      supabase.from("nexus_sessions").select("cost_usd").gte("last_activity", weekStart),
      supabase.from("nexus_sessions").select("cost_usd").gte("last_activity", monthStart),
      supabase.from("swarm_tasks").select("status,created_at").gte("created_at", weekStart),
    ]);

    if (taskRes.data) {
      const t = taskRes.data;
      setTasks({
        queued: t.filter((x) => x.status === "queued").length,
        running: t.filter((x) => x.status === "running").length,
        completed_today: t.filter((x) => x.status === "completed").length,
        failed_today: t.filter((x) => x.status === "failed").length,
      });
    }

    if (sessionRes.data) setSessions(sessionRes.data as NexusSession[]);
    if (recentRes.data) setRecentTasks(recentRes.data);
    if (chartTasksRes.data) setChartTasks(chartTasksRes.data);

    setCosts({
      today: todayCostRes.data?.reduce((s, r) => s + (parseFloat(r.cost_usd) || 0), 0) || 0,
      week: weekCostRes.data?.reduce((s, r) => s + (parseFloat(r.cost_usd) || 0), 0) || 0,
      month: monthCostRes.data?.reduce((s, r) => s + (parseFloat(r.cost_usd) || 0), 0) || 0,
    });

    setAchievements(getUnlockedCount());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Realtime for live updates
  useEffect(() => {
    const channel = supabase
      .channel("command-center-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nexus_sessions" }, () => fetchAll())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "swarm_tasks" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="relative z-10 max-w-[1600px] mx-auto px-4 py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-bold text-white tracking-wider">COMMAND CENTER</h1>
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchAll} className="p-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30">
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
            </button>
            <a href="/" className="text-[10px] text-zinc-500 hover:text-white px-2 py-1 rounded hover:bg-white/5">
              Dashboard <ChevronRight className="w-3 h-3 inline" />
            </a>
          </div>
        </div>

        {/* Main grid — 3 columns */}
        <div className="grid grid-cols-12 gap-3">

          {/* LEFT COLUMN — Missions + Sessions (5 cols) */}
          <div className="col-span-12 lg:col-span-5 space-y-3">

            {/* Task stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Queued", value: tasks.queued, icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-400 border-amber-500/20" },
                { label: "Running", value: tasks.running, icon: <Loader2 className="w-3.5 h-3.5" />, color: "text-cyan-400 border-cyan-500/20" },
                { label: "Done Today", value: tasks.completed_today, icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400 border-emerald-500/20" },
                { label: "Failed", value: tasks.failed_today, icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-400 border-red-500/20" },
              ].map((s) => (
                <div key={s.label} className={`bg-zinc-900/50 border ${s.color.split(" ")[1]} rounded-lg p-3 text-center`}>
                  <div className={`text-xl font-bold ${s.color.split(" ")[0]}`}>{s.value}</div>
                  <div className="text-[9px] text-zinc-600 uppercase mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick launch */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
              <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Quick Launch</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Mission", href: "javascript:void(0)", color: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" },
                  { label: "Run Workflow", href: "/workflows", color: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
                  { label: "View Factory", href: "/game", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
                  { label: "Oracle", href: "/oracle", color: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
                ].map((btn) => (
                  <a key={btn.label} href={btn.href} className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs ${btn.color} hover:opacity-80 transition-opacity`}>
                    {btn.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Active sessions */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800/50 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Live Sessions</span>
                {sessions.length > 0 && (
                  <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 rounded-full">{sessions.length}</span>
                )}
              </div>
              {sessions.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-zinc-700">No active sessions</div>
              ) : (
                <div className="divide-y divide-zinc-800/30">
                  {sessions.map((s) => (
                    <div key={s.session_id} className="px-3 py-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      <span className="text-xs text-white flex-1 truncate">{s.project_name || "unknown"}</span>
                      {s.current_tool && <span className="text-[10px] text-cyan-400">{s.current_tool}</span>}
                      <span className="text-[10px] text-zinc-600">{s.tool_count} tools</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER COLUMN — Feed (5 cols) */}
          <div className="col-span-12 lg:col-span-5 space-y-3">

            {/* Success Rate Chart */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800/50 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Success Rate (7 Days)</span>
              </div>
              <div className="p-3">
                <SuccessRateChart tasks={chartTasks} />
              </div>
            </div>

            {/* Recent completed tasks */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800/50 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Recent Completions</span>
              </div>
              <div className="divide-y divide-zinc-800/30 max-h-[500px] overflow-y-auto">
                {recentTasks.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-zinc-700">No completed tasks</div>
                ) : (
                  recentTasks.map((t) => (
                    <div key={t.id} className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="text-xs text-white flex-1 truncate">{t.title}</span>
                        {t.actual_cost_cents > 0 && (
                          <span className="text-[10px] text-zinc-500">{formatCost(t.actual_cost_cents / 100)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-5 mt-0.5 text-[10px] text-zinc-600">
                        <span>{t.project}</span>
                        {t.completed_at && (
                          <span>{new Date(t.completed_at).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Stats (2 cols) */}
          <div className="col-span-12 lg:col-span-2 space-y-3">

            {/* Cost tracker */}
            <div className="bg-zinc-900/50 border border-amber-500/10 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">API Spend</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Today</span>
                  <span className="text-white font-semibold">{formatCost(costs.today)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">This Week</span>
                  <span className="text-white">{formatCost(costs.week)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">This Month</span>
                  <span className={`font-semibold ${costs.month > 50 ? "text-amber-400" : "text-white"}`}>{formatCost(costs.month)}</span>
                </div>
              </div>
            </div>

            {/* Session count */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Sessions</span>
              </div>
              <div className="text-2xl font-bold text-white">{sessions.length}</div>
              <div className="text-[10px] text-zinc-600">active now</div>
            </div>

            {/* Achievements */}
            <a href="/achievements" className="block bg-zinc-900/50 border border-amber-500/10 rounded-lg p-3 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Trophies</span>
              </div>
              <div className="text-lg font-bold text-amber-400">{achievements.unlocked}/{achievements.total}</div>
              <div className="h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${achievements.total > 0 ? (achievements.unlocked / achievements.total) * 100 : 0}%` }} />
              </div>
            </a>

            {/* Quick links */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Navigate</div>
              <div className="space-y-1">
                {[
                  { label: "Sessions", href: "/sessions", icon: <Clock className="w-3 h-3" /> },
                  { label: "Templates", href: "/templates", icon: <Rocket className="w-3 h-3" /> },
                  { label: "Workflows", href: "/workflows", icon: <GitBranch className="w-3 h-3" /> },
                  { label: "Fusion", href: "/fusion", icon: <Activity className="w-3 h-3" /> },
                  { label: "Settings", href: "/settings", icon: <Wrench className="w-3 h-3" /> },
                ].map((link) => (
                  <a key={link.label} href={link.href} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
                    {link.icon}
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
