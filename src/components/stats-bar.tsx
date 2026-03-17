"use client";

import { motion } from "framer-motion";
import { Activity, CheckCircle2, Footprints, TrendingUp } from "lucide-react";
import { AgentActivity } from "@/lib/types";

interface StatsBarProps {
  agents: AgentActivity[];
}

export function StatsBar({ agents }: StatsBarProps) {
  const active = agents.filter((a) => a.status === "running").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedToday = agents.filter(
    (a) =>
      a.status === "completed" &&
      a.completed_at &&
      new Date(a.completed_at) >= today
  ).length;

  const totalSteps = agents.reduce((sum, a) => sum + (a.steps_completed || 0), 0);

  const completed = agents.filter((a) => a.status === "completed").length;
  const total = agents.filter(
    (a) => a.status === "completed" || a.status === "failed"
  ).length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;

  const stats = [
    {
      label: "Active Agents",
      value: active,
      icon: Activity,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
      glowColor: "rgba(34, 211, 238, 0.3)",
      hoverBorder: "rgba(34, 211, 238, 0.5)",
    },
    {
      label: "Completed Today",
      value: completedToday,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
      glowColor: "rgba(52, 211, 153, 0.3)",
      hoverBorder: "rgba(52, 211, 153, 0.5)",
    },
    {
      label: "Total Steps",
      value: totalSteps.toLocaleString(),
      icon: Footprints,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
      glowColor: "rgba(167, 139, 250, 0.3)",
      hoverBorder: "rgba(167, 139, 250, 0.5)",
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      icon: TrendingUp,
      color: successRate >= 80 ? "text-emerald-400" : "text-amber-400",
      bg: successRate >= 80 ? "bg-emerald-400/10" : "bg-amber-400/10",
      border: successRate >= 80 ? "border-emerald-400/20" : "border-amber-400/20",
      glowColor: successRate >= 80 ? "rgba(52, 211, 153, 0.3)" : "rgba(251, 191, 36, 0.3)",
      hoverBorder: successRate >= 80 ? "rgba(52, 211, 153, 0.5)" : "rgba(251, 191, 36, 0.5)",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          whileHover={{
            scale: 1.02,
            borderColor: stat.hoverBorder,
            boxShadow: `0 0 20px ${stat.glowColor}`,
          }}
          className={`${stat.bg} ${stat.border} border rounded-lg p-4 backdrop-blur-sm transition-all duration-300 cursor-pointer`}
        >
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <div className={`text-2xl font-mono font-bold ${stat.color}`}>
            {stat.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
