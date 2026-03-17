"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sun, CheckCircle2, XCircle, Clock, Loader2, Brain,
  TrendingUp, DollarSign, Users, Zap, RefreshCw, Rocket, BarChart3,
  Activity, Target, Timer,
} from "lucide-react";
import { TodayPageLoading } from "@/components/loading-states";
import { TaskTrendChart, CostTrendChart } from "@/components/charts/dashboard-charts";

interface TodayData {
  date: string;
  summary: {
    completed: number; failed: number; queued: number;
    running: number; pending: number; total: number;
  };
  cost: { usd: number; tokens: number };
  tasks: Array<{
    id: string; title: string; project: string; status: string;
    task_type: string; updated_at: string; output_data?: string;
  }>;
  projects: Array<{
    name: string; tasks: number; completed: number;
    failed: number; health: string;
  }>;
  rankings: Array<{
    id: string; name: string; type: string; completed: number;
    failed: number; xp: number; status: string; successRate: number;
  }>;
  specializations: Array<{
    project: string; task_type: string; success_count: number;
    fail_count: number; avg_duration_seconds: number; best_practices: string;
  }>;
  sessions: { active: number; total: number };
  weekTasks?: Array<{ status: string; created_at: string }>;
  weekSessions?: Array<{ cost_usd: string; last_activity: string; model?: string; project_name?: string }>;
}

interface Analytics {
  successRate: number;
  avgDuration: number;
  costPerTask: number;
  totalCost: number;
  summary: {
    totalTasks: number;
    completed: number;
    failed: number;
    avgDurationMinutes: number;
  };
  tasksPerDay: Array<{ date: string; count: number }>;
  costPerDay: Array<{ date: string; cost: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-emerald-400",
  failed: "text-red-400",
  running: "text-cyan-400",
  queued: "text-zinc-400",
  pending_approval: "text-amber-400",
  approved: "text-purple-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  failed: <XCircle className="w-3.5 h-3.5" />,
  running: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  queued: <Clock className="w-3.5 h-3.5" />,
  pending_approval: <Clock className="w-3.5 h-3.5" />,
};

function StatBox({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`bg-zinc-900/50 border ${color} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, analyticsRes] = await Promise.all([
        fetch("/api/today"),
        fetch("/api/analytics"),
      ]);

      if (!todayRes.ok) throw new Error(`Today API: HTTP ${todayRes.status}`);
      if (!analyticsRes.ok) throw new Error(`Analytics API: HTTP ${analyticsRes.status}`);

      const [todayData, analyticsData] = await Promise.all([
        todayRes.json(),
        analyticsRes.json(),
      ]);

      setData(todayData);
      setAnalytics(analyticsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Sun className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{greeting}</h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={fetchData}
            className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-amber-500/30 transition-colors">
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </motion.header>

        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-400 gap-3">
            <p className="text-sm">Failed to load: {error}</p>
            <button onClick={fetchData} className="text-xs text-cyan-400 hover:text-cyan-300">Retry</button>
          </div>
        ) : loading || !data ? (
          <TodayPageLoading />
        ) : (
          <>
            {/* Stats row */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatBox label="Completed" value={data.summary.completed}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} color="border-emerald-500/20" />
              <StatBox label="Failed" value={data.summary.failed}
                icon={<XCircle className="w-4 h-4 text-red-400" />} color="border-red-500/20" />
              <StatBox label="Running" value={data.summary.running}
                icon={<Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />} color="border-cyan-500/20" />
              <StatBox label="Queue" value={data.summary.queued + data.summary.pending}
                icon={<Clock className="w-4 h-4 text-zinc-400" />} color="border-zinc-700" />
              <StatBox label="Cost" value={`$${data.cost.usd.toFixed(2)}`}
                icon={<DollarSign className="w-4 h-4 text-amber-400" />} color="border-amber-500/20" />
              <StatBox label="Sessions" value={data.sessions.total}
                icon={<Users className="w-4 h-4 text-purple-400" />} color="border-purple-500/20" />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Today's Tasks */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    Today&apos;s Tasks ({data.summary.total})
                  </h2>
                </div>
                <div className="divide-y divide-zinc-800/30 max-h-[400px] overflow-y-auto">
                  {data.tasks.length === 0 ? (
                    <div className="px-4 py-8 text-center text-zinc-600 text-sm">No tasks today yet</div>
                  ) : (
                    data.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                        <span className={STATUS_COLORS[task.status] || "text-zinc-500"}>
                          {STATUS_ICONS[task.status] || <Clock className="w-3.5 h-3.5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{task.title}</p>
                          <div className="flex gap-2 text-[10px] text-zinc-600">
                            <span className="text-cyan-400/60">{task.project}</span>
                            <span>{task.task_type}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] ${STATUS_COLORS[task.status]}`}>
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Project Status */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Projects</h2>
                  </div>
                  <div className="divide-y divide-zinc-800/30">
                    {data.projects.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-zinc-600">No project activity</div>
                    ) : (
                      data.projects.map((p) => (
                        <div key={p.name} className="flex items-center gap-2 px-4 py-2.5">
                          <span className={`w-2 h-2 rounded-full ${
                            p.health === "green" ? "bg-emerald-400" :
                            p.health === "yellow" ? "bg-amber-400" : "bg-red-400 animate-pulse"
                          }`} />
                          <span className="text-xs text-white flex-1">{p.name}</span>
                          <span className="text-[10px] text-emerald-400">{p.completed}✓</span>
                          {p.failed > 0 && <span className="text-[10px] text-red-400">{p.failed}✗</span>}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                {/* Agent Rankings */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Agent Rankings</h2>
                  </div>
                  <div className="divide-y divide-zinc-800/30">
                    {data.rankings.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-zinc-600">No agent data</div>
                    ) : (
                      data.rankings.slice(0, 5).map((agent, i) => (
                        <div key={agent.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-[10px] text-zinc-600 w-4">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white">{agent.name}</span>
                            <div className="flex gap-2 text-[10px] text-zinc-600">
                              <span>{agent.completed} done</span>
                              <span>{agent.successRate}% rate</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-amber-400">{agent.xp} XP</span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>

                {/* Specializations */}
                {data.specializations.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Intelligence</h2>
                    </div>
                    <div className="divide-y divide-zinc-800/30">
                      {data.specializations.slice(0, 5).map((s) => {
                        const total = (s.success_count || 0) + (s.fail_count || 0);
                        const rate = total > 0 ? Math.round((s.success_count / total) * 100) : 0;
                        return (
                          <div key={`${s.project}-${s.task_type}`} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white">{s.project}/{s.task_type}</span>
                              <span className={`text-[10px] ${rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                {rate}% ({total})
                              </span>
                            </div>
                            <div className="h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Charts Section */}
            {data.weekTasks && data.weekSessions && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Task Completion Trend */}
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                      Task Completion Trend (7 Days)
                    </h2>
                  </div>
                  <div className="p-4">
                    <TaskTrendChart tasks={data.weekTasks} />
                  </div>
                </div>

                {/* Cost Trend */}
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                      Cost Trend (7 Days)
                    </h2>
                  </div>
                  <div className="p-4">
                    <CostTrendChart sessions={data.weekSessions} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Analytics Panel (30 Days) */}
            {analytics && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="bg-zinc-900/50 border border-cyan-500/20 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    30-Day Analytics
                  </h2>
                  <span className="ml-auto text-[10px] text-zinc-500">
                    {analytics.summary.totalTasks} tasks tracked
                  </span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-zinc-800/30 rounded-lg p-4 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Success Rate</span>
                      </div>
                      <div className="text-3xl font-bold text-emerald-400">{analytics.successRate}%</div>
                      <div className="text-[10px] text-zinc-600 mt-1">
                        {analytics.summary.completed} completed / {analytics.summary.failed} failed
                      </div>
                    </div>

                    <div className="bg-zinc-800/30 rounded-lg p-4 border border-cyan-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="w-4 h-4 text-cyan-400" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Duration</span>
                      </div>
                      <div className="text-3xl font-bold text-cyan-400">{analytics.summary.avgDurationMinutes}m</div>
                      <div className="text-[10px] text-zinc-600 mt-1">
                        {analytics.avgDuration}s per task
                      </div>
                    </div>

                    <div className="bg-zinc-800/30 rounded-lg p-4 border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Cost / Task</span>
                      </div>
                      <div className="text-3xl font-bold text-amber-400">${analytics.costPerTask.toFixed(3)}</div>
                      <div className="text-[10px] text-zinc-600 mt-1">
                        per execution
                      </div>
                    </div>

                    <div className="bg-zinc-800/30 rounded-lg p-4 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Total Cost</span>
                      </div>
                      <div className="text-3xl font-bold text-purple-400">${analytics.totalCost.toFixed(2)}</div>
                      <div className="text-[10px] text-zinc-600 mt-1">
                        last 30 days
                      </div>
                    </div>
                  </div>

                  {/* Mini sparkline charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tasks per day sparkline */}
                    <div className="bg-zinc-800/20 rounded-lg p-3 border border-zinc-700/30">
                      <div className="text-xs text-zinc-400 mb-2 flex items-center gap-2">
                        <BarChart3 className="w-3 h-3" />
                        Tasks per Day
                      </div>
                      <div className="flex items-end gap-0.5 h-16">
                        {analytics.tasksPerDay.slice(-14).map((d, i) => {
                          const maxCount = Math.max(...analytics.tasksPerDay.map(x => x.count));
                          const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col justify-end group relative">
                              <div
                                className="bg-cyan-500/60 hover:bg-cyan-500 transition-colors rounded-sm"
                                style={{ height: `${height}%` }}
                              />
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                {d.date}: {d.count} tasks
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cost per day sparkline */}
                    <div className="bg-zinc-800/20 rounded-lg p-3 border border-zinc-700/30">
                      <div className="text-xs text-zinc-400 mb-2 flex items-center gap-2">
                        <DollarSign className="w-3 h-3" />
                        Cost per Day
                      </div>
                      <div className="flex items-end gap-0.5 h-16">
                        {analytics.costPerDay.slice(-14).map((d, i) => {
                          const maxCost = Math.max(...analytics.costPerDay.map(x => x.cost));
                          const height = maxCost > 0 ? (d.cost / maxCost) * 100 : 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col justify-end group relative">
                              <div
                                className="bg-amber-500/60 hover:bg-amber-500 transition-colors rounded-sm"
                                style={{ height: `${height}%` }}
                              />
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                {d.date}: ${d.cost.toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
