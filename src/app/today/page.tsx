"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sun, CheckCircle2, XCircle, Clock, Loader2, Brain,
  TrendingUp, DollarSign, Users, Zap, RefreshCw, Rocket,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/today");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
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
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-zinc-600">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
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
          </>
        )}
      </div>
    </div>
  );
}
