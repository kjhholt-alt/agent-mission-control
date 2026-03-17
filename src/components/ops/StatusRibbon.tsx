"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Satellite, Users, Play, CheckCircle, DollarSign, Network, Shield } from "lucide-react";
import Link from "next/link";
import type { OpsWorker, OpsTask, OpsBudget } from "@/lib/ops-types";
import { formatTimeAgo } from "@/lib/ops-types";

interface Props {
  workers: OpsWorker[];
  tasks: OpsTask[];
  budget: OpsBudget | null;
  connected: boolean;
  lastUpdated: Date;
}

function AnimatedCounter({ value, label, icon: Icon, color }: {
  value: number;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (displayed === value) return;
    const step = value > displayed ? 1 : -1;
    const interval = setInterval(() => {
      setDisplayed((prev) => {
        const next = prev + step;
        if ((step > 0 && next >= value) || (step < 0 && next <= value)) {
          clearInterval(interval);
          return value;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [value, displayed]);

  return (
    <div className="flex items-center gap-2 px-4">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
      <div className="flex flex-col">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {displayed}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
    </div>
  );
}

function gradeColor(grade: string): string {
  if (grade === "A") return "#10b981";
  if (grade === "B") return "#22c55e";
  if (grade === "C") return "#eab308";
  if (grade === "D") return "#f97316";
  return "#ef4444";
}

export function StatusRibbon({ workers, tasks, budget, connected, lastUpdated }: Props) {
  const [clock, setClock] = useState("");
  const [healthGrade, setHealthGrade] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number>(0);

  // Fetch health score periodically
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/metrics");
        if (res.ok) {
          const data = await res.json();
          setHealthGrade(data.health?.grade ?? null);
          setHealthScore(data.health?.score ?? 0);
        }
      } catch { /* silent */ }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const update = () => {
      setClock(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeWorkers = workers.filter(
    (w) => w.status === "busy" || w.status === "working"
  ).length;
  const runningTasks = tasks.filter(
    (t) => t.status === "in_progress" || t.status === "running"
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const completedToday = tasks.filter(
    (t) =>
      t.status === "completed" &&
      t.completed_at &&
      t.completed_at.slice(0, 10) === today
  ).length;

  const budgetSpent = budget
    ? `$${(budget.api_spent_cents / 100).toFixed(2)}`
    : "$0.00";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-2 rounded-lg border border-zinc-800/60"
      style={{ background: "rgba(10,10,18,0.9)", backdropFilter: "blur(12px)" }}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Satellite className="w-5 h-5 text-cyan-400" />
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
              connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
            }`}
          />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider">
            <span className="text-cyan-400">NEXUS</span>{" "}
            <span className="text-zinc-400">OPS CENTER</span>
          </h1>
        </div>
        <Link
          href="/ops/graph"
          className="ml-4 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors flex items-center gap-2 group"
        >
          <Network className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
          <span className="text-xs font-mono text-cyan-400 group-hover:text-cyan-300">
            GRAPH VIEW
          </span>
        </Link>
      </div>

      {/* Center: Counters */}
      <div className="hidden md:flex items-center gap-1 divide-x divide-zinc-800">
        <AnimatedCounter
          value={activeWorkers}
          label="Workers Active"
          icon={Users}
          color="#06b6d4"
        />
        <AnimatedCounter
          value={runningTasks}
          label="Tasks Running"
          icon={Play}
          color="#22c55e"
        />
        <AnimatedCounter
          value={completedToday}
          label="Completed Today"
          icon={CheckCircle}
          color="#10b981"
        />
        <div className="flex items-center gap-2 px-4">
          <DollarSign className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-bold tabular-nums text-amber-400">
              {budgetSpent}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">
              Budget Spent
            </span>
          </div>
        </div>
        {healthGrade && (
          <div className="flex items-center gap-2 px-4">
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: gradeColor(healthGrade) }} />
            <div className="flex flex-col">
              <span className="text-lg font-bold tabular-nums" style={{ color: gradeColor(healthGrade) }}>
                {healthGrade}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                Health {healthScore}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Clock + Updated */}
      <div className="flex items-center gap-4 text-xs">
        <span className="font-mono text-cyan-400/80 tabular-nums">{clock}</span>
        <span className="text-zinc-600 hidden sm:inline">
          Updated {formatTimeAgo(lastUpdated.toISOString())}
        </span>
      </div>
    </motion.div>
  );
}
