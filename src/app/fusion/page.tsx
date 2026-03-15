"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Activity,
  DollarSign,
  GitBranch,
  Upload,
  Users,
  TrendingUp,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCost, formatTokens } from "@/lib/pricing";

interface FusionData {
  sessions: {
    total: number;
    active: number;
    today_cost: number;
    today_tokens: number;
    by_project: Record<string, { count: number; cost: number }>;
    by_model: Record<string, { count: number; cost: number }>;
  };
  tasks: {
    queued: number;
    running: number;
    completed_today: number;
    failed_today: number;
  };
  agents: {
    active: number;
    total: number;
  };
  deploys: {
    recent: Array<{
      project: string;
      status: string;
      created_at: string;
    }>;
  };
  projects: Array<{
    name: string;
    health: "green" | "yellow" | "red";
    last_activity: string;
    session_count: number;
    task_count: number;
    cost: number;
  }>;
}

function HealthDot({ health }: { health: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-400 animate-pulse",
  };
  return <span className={`w-2 h-2 rounded-full ${colors[health] || colors.green}`} />;
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className={`bg-zinc-900/50 border ${color} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function FusionPage() {
  const [data, setData] = useState<FusionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFusionData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Parallel fetches
      const [sessionsRes, tasksRes, agentsRes, deploysRes] = await Promise.all([
        supabase
          .from("nexus_sessions")
          .select("*")
          .gte("last_activity", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order("last_activity", { ascending: false }),
        supabase
          .from("swarm_tasks")
          .select("status, project, created_at")
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from("agent_activity")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("swarm_tasks")
          .select("project, status, created_at")
          .eq("task_type", "deploy")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const sessions = sessionsRes.data || [];
      const tasks = tasksRes.data || [];
      const agents = agentsRes.data || [];
      const deploys = deploysRes.data || [];

      // Aggregate sessions
      const todaySessions = sessions.filter((s) => s.last_activity >= todayStart);
      const byProject: Record<string, { count: number; cost: number }> = {};
      const byModel: Record<string, { count: number; cost: number }> = {};

      for (const s of todaySessions) {
        const proj = s.project_name || "unknown";
        if (!byProject[proj]) byProject[proj] = { count: 0, cost: 0 };
        byProject[proj].count++;
        byProject[proj].cost += parseFloat(s.cost_usd) || 0;

        const model = s.model?.includes("opus") ? "Opus" : s.model?.includes("haiku") ? "Haiku" : "Sonnet";
        if (!byModel[model]) byModel[model] = { count: 0, cost: 0 };
        byModel[model].count++;
        byModel[model].cost += parseFloat(s.cost_usd) || 0;
      }

      // Aggregate tasks
      const taskStats = {
        queued: tasks.filter((t) => t.status === "queued").length,
        running: tasks.filter((t) => t.status === "running").length,
        completed_today: tasks.filter((t) => t.status === "completed").length,
        failed_today: tasks.filter((t) => t.status === "failed").length,
      };

      // Build project health
      const projectNames = Array.from(
        new Set([
          ...sessions.map((s) => s.project_name),
          ...tasks.map((t) => t.project),
        ].filter(Boolean))
      );

      const projects = projectNames.map((name) => {
        const projSessions = sessions.filter((s) => s.project_name === name);
        const projTasks = tasks.filter((t) => t.project === name);
        const failedRecent = projTasks.filter((t) => t.status === "failed").length;
        const lastActivity = projSessions[0]?.last_activity || projTasks[0]?.created_at || "";
        const cost = projSessions.reduce((sum, s) => sum + (parseFloat(s.cost_usd) || 0), 0);

        let health: "green" | "yellow" | "red" = "green";
        if (failedRecent >= 3) health = "red";
        else if (failedRecent >= 1) health = "yellow";

        return {
          name: name!,
          health,
          last_activity: lastActivity,
          session_count: projSessions.length,
          task_count: projTasks.length,
          cost,
        };
      }).sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());

      setData({
        sessions: {
          total: sessions.length,
          active: sessions.filter((s) => s.status === "active").length,
          today_cost: todaySessions.reduce((sum, s) => sum + (parseFloat(s.cost_usd) || 0), 0),
          today_tokens: todaySessions.reduce(
            (sum, s) => sum + (s.input_tokens || 0) + (s.output_tokens || 0), 0
          ),
          by_project: byProject,
          by_model: byModel,
        },
        tasks: taskStats,
        agents: {
          active: agents.filter((a) => a.status === "running").length,
          total: agents.length,
        },
        deploys: {
          recent: deploys.map((d) => ({
            project: d.project || "unknown",
            status: d.status,
            created_at: d.created_at,
          })),
        },
        projects,
      });
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFusionData();
    const interval = setInterval(fetchFusionData, 30_000);
    return () => clearInterval(interval);
  }, [fetchFusionData]);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Layers className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Data Fusion</h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                Cross-project intelligence — single pane of glass
              </p>
            </div>
          </div>
          <button
            onClick={fetchFusionData}
            className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </motion.header>

        {!data ? (
          <div className="flex items-center justify-center py-20 text-zinc-600">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading fusion data...
          </div>
        ) : (
          <>
            {/* Top stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
            >
              <StatCard
                label="Active Sessions"
                value={data.sessions.active.toString()}
                icon={<Activity className="w-4 h-4 text-cyan-400" />}
                color="border-cyan-500/20"
              />
              <StatCard
                label="Today's Cost"
                value={formatCost(data.sessions.today_cost)}
                icon={<DollarSign className="w-4 h-4 text-amber-400" />}
                color="border-amber-500/20"
              />
              <StatCard
                label="Today's Tokens"
                value={formatTokens(data.sessions.today_tokens)}
                icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
                color="border-emerald-500/20"
              />
              <StatCard
                label="Tasks Completed"
                value={data.tasks.completed_today.toString()}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                color="border-emerald-500/20"
                sub={`${data.tasks.failed_today} failed`}
              />
              <StatCard
                label="Active Agents"
                value={data.agents.active.toString()}
                icon={<Users className="w-4 h-4 text-purple-400" />}
                color="border-purple-500/20"
                sub={`${data.agents.total} total`}
              />
              <StatCard
                label="Queue"
                value={data.tasks.queued.toString()}
                icon={<Clock className="w-4 h-4 text-zinc-400" />}
                color="border-zinc-700"
                sub={`${data.tasks.running} running`}
              />
            </motion.div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Project Health */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                    Project Health
                  </h2>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  {data.projects.length === 0 ? (
                    <div className="px-4 py-8 text-center text-zinc-600 text-sm">
                      No project activity in the last 7 days
                    </div>
                  ) : (
                    data.projects.map((project) => (
                      <div
                        key={project.name}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <HealthDot health={project.health} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white font-medium">
                            {project.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span title="Sessions">
                            {project.session_count} sessions
                          </span>
                          <span title="Tasks">
                            {project.task_count} tasks
                          </span>
                          <span
                            title="Cost"
                            className={project.cost > 5 ? "text-amber-400" : ""}
                          >
                            {formatCost(project.cost)}
                          </span>
                          <span className="text-zinc-600 text-[10px]">
                            {project.last_activity
                              ? new Date(project.last_activity).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Right: Cost by model + recent deploys */}
              <div className="space-y-4">
                {/* Cost by Model */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-zinc-800/50">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                      Cost by Model (Today)
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {Object.entries(data.sessions.by_model).length === 0 ? (
                      <p className="text-xs text-zinc-600">No sessions today</p>
                    ) : (
                      Object.entries(data.sessions.by_model).map(
                        ([model, stats]) => {
                          const pct =
                            data.sessions.today_cost > 0
                              ? (stats.cost / data.sessions.today_cost) * 100
                              : 0;
                          const color = model === "Opus"
                            ? "bg-purple-500"
                            : model === "Haiku"
                              ? "bg-emerald-500"
                              : "bg-cyan-500";
                          return (
                            <div key={model}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-zinc-400">
                                  {model}{" "}
                                  <span className="text-zinc-600">
                                    ({stats.count})
                                  </span>
                                </span>
                                <span className="text-white">
                                  {formatCost(stats.cost)}
                                </span>
                              </div>
                              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${color} rounded-full`}
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                            </div>
                          );
                        }
                      )
                    )}
                  </div>
                </motion.div>

                {/* Recent Deploys */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-orange-400" />
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                      Recent Deploys
                    </h2>
                  </div>
                  <div className="divide-y divide-zinc-800/30">
                    {data.deploys.recent.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-zinc-600">
                        No recent deploys
                      </div>
                    ) : (
                      data.deploys.recent.slice(0, 5).map((deploy, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-4 py-2.5"
                        >
                          {deploy.status === "completed" || deploy.status === "success" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : deploy.status === "failed" ? (
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                          )}
                          <span className="text-xs text-white flex-1">
                            {deploy.project}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {new Date(deploy.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
