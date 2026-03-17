"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Trophy,
  AlertTriangle,
  TrendingUp,
  Activity,
  RefreshCw,
  Zap,
  Target,
  Skull,
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface HealthData {
  score: number;
  grade: string;
  issues: string[];
}

interface ThroughputData {
  completed_1h: number;
  completed_6h: number;
  completed_24h: number;
  failed_24h: number;
  error_rate_24h: number;
}

interface WorkerRanking {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  success_rate: number;
  xp: number;
  total_cost_cents: number;
  efficiency: number;
}

interface FailureHotspot {
  key: string;
  fail_rate: number;
  failed: number;
  total: number;
  wasted_cost_cents: number;
}

interface CrossProjectTrend {
  task_type: string;
  completed: number;
  failed: number;
  total: number;
  project_count: number;
  projects: string[];
  successRate: number;
}

interface MetricsData {
  health: HealthData;
  throughput: ThroughputData;
  workers: { total: number; working: number; idle: number; utilization: number };
  queue: { queued: number; running: number; blocked: number; avg_wait_seconds: number };
  cost: { total_cents_24h: number; total_tokens_24h: number; budget_api_pct: number };
}

interface PatternsData {
  workerRankings: WorkerRanking[];
  failureHotspots: FailureHotspot[];
  crossProjectTrends: CrossProjectTrend[];
  totalTasks: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === "A") return "#10b981";
  if (grade === "B") return "#22c55e";
  if (grade === "C") return "#eab308";
  if (grade === "D") return "#f97316";
  return "#ef4444";
}

function tierBadge(tier: string): string {
  if (tier === "heavy") return "text-violet-400 bg-violet-500/10";
  if (tier === "cc_light") return "text-cyan-400 bg-cyan-500/10";
  if (tier === "light") return "text-emerald-400 bg-emerald-500/10";
  return "text-zinc-400 bg-zinc-500/10";
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export function IntelPanel() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [patterns, setPatterns] = useState<PatternsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntel = useCallback(async () => {
    try {
      const [metricsRes, patternsRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/patterns"),
      ]);

      if (!metricsRes.ok || !patternsRes.ok) {
        throw new Error("Failed to fetch intelligence data");
      }

      const [metricsData, patternsData] = await Promise.all([
        metricsRes.json(),
        patternsRes.json(),
      ]);

      setMetrics(metricsData);
      setPatterns(patternsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntel();
    const interval = setInterval(fetchIntel, 30_000);
    return () => clearInterval(interval);
  }, [fetchIntel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-[10px] text-red-400">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchIntel(); }}
          className="text-[9px] text-cyan-400 hover:text-cyan-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const health = metrics?.health;
  const throughput = metrics?.throughput;
  const queue = metrics?.queue;
  const cost = metrics?.cost;
  const rankings = patterns?.workerRankings || [];
  const hotspots = patterns?.failureHotspots || [];
  const trends = patterns?.crossProjectTrends || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin p-2 gap-3">
      {/* ── HEALTH SCORE ── */}
      {health && (
        <section>
          <SectionHeader icon={Activity} label="System Health" />
          <div className="flex items-center gap-3 mt-1.5">
            <div
              className="w-12 h-12 rounded-lg border-2 flex items-center justify-center font-bold text-xl"
              style={{
                borderColor: gradeColor(health.grade),
                color: gradeColor(health.grade),
                background: `${gradeColor(health.grade)}10`,
              }}
            >
              {health.grade}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums text-zinc-200">
                  {health.score}
                </span>
                <span className="text-[9px] text-zinc-500">/100</span>
              </div>
              {/* Score bar */}
              <div className="h-1.5 rounded-full bg-zinc-800 mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${health.score}%`,
                    background: gradeColor(health.grade),
                  }}
                />
              </div>
            </div>
          </div>
          {health.issues.length > 0 && (
            <div className="mt-2 space-y-1">
              {health.issues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[9px] text-amber-400/80"
                >
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {issue}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── THROUGHPUT ── */}
      {throughput && (
        <section>
          <SectionHeader icon={Zap} label="Throughput (24h)" />
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <MetricBox label="1h" value={throughput.completed_1h} color="#06b6d4" />
            <MetricBox label="6h" value={throughput.completed_6h} color="#06b6d4" />
            <MetricBox label="24h" value={throughput.completed_24h} color="#10b981" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <MetricBox label="Failed" value={throughput.failed_24h} color="#ef4444" />
            <MetricBox
              label="Err Rate"
              value={`${throughput.error_rate_24h}%`}
              color={throughput.error_rate_24h > 20 ? "#ef4444" : "#6b7280"}
            />
            <MetricBox
              label="Queue"
              value={queue?.queued ?? 0}
              color="#eab308"
            />
          </div>
          {cost && (
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <MetricBox
                label="Cost 24h"
                value={`$${(cost.total_cents_24h / 100).toFixed(2)}`}
                color="#f59e0b"
              />
              <MetricBox
                label="Budget"
                value={`${cost.budget_api_pct}%`}
                color={cost.budget_api_pct > 80 ? "#ef4444" : "#6b7280"}
              />
            </div>
          )}
        </section>
      )}

      {/* ── WORKER LEADERBOARD ── */}
      {rankings.length > 0 && (
        <section>
          <SectionHeader icon={Trophy} label={`Top Workers (${rankings.length})`} />
          <div className="mt-1.5 space-y-1">
            {rankings.slice(0, 8).map((w, i) => (
              <div
                key={w.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50"
              >
                <span className="text-[9px] font-bold text-zinc-600 w-4 text-right tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-300 font-semibold truncate">
                      {w.name}
                    </span>
                    <span className={`text-[7px] px-1 py-0.5 rounded font-mono ${tierBadge(w.tier)}`}>
                      {w.tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] text-zinc-600">
                    <span>{w.tasks_completed} done</span>
                    <span>{w.success_rate}% rate</span>
                    <span>{w.xp} XP</span>
                  </div>
                </div>
                {/* Mini success bar */}
                <div className="w-10 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${w.success_rate}%`,
                      background: w.success_rate >= 80 ? "#10b981" : w.success_rate >= 50 ? "#eab308" : "#ef4444",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FAILURE HOTSPOTS ── */}
      {hotspots.length > 0 && (
        <section>
          <SectionHeader icon={Skull} label={`Failure Hotspots (${hotspots.length})`} />
          <div className="mt-1.5 space-y-1">
            {hotspots.slice(0, 5).map((h) => (
              <div
                key={h.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/5 border border-red-500/10"
              >
                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-red-300 font-mono truncate block">
                    {h.key}
                  </span>
                  <span className="text-[8px] text-zinc-600">
                    {h.failed}/{h.total} failed &middot; ${(h.wasted_cost_cents / 100).toFixed(2)} wasted
                  </span>
                </div>
                <span className="text-[10px] font-bold tabular-nums text-red-400">
                  {h.fail_rate}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CROSS-PROJECT TRENDS ── */}
      {trends.length > 0 && (
        <section>
          <SectionHeader icon={TrendingUp} label="Cross-Project Trends" />
          <div className="mt-1.5 space-y-1">
            {trends.slice(0, 6).map((t) => (
              <div
                key={t.task_type}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50"
              >
                <Target className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-zinc-300 font-mono truncate block">
                    {t.task_type}
                  </span>
                  <span className="text-[8px] text-zinc-600">
                    {t.total} tasks &middot; {t.project_count} project{t.project_count !== 1 ? "s" : ""}
                  </span>
                </div>
                <span
                  className="text-[10px] font-bold tabular-nums"
                  style={{
                    color: t.successRate >= 80 ? "#10b981" : t.successRate >= 50 ? "#eab308" : "#ef4444",
                  }}
                >
                  {t.successRate}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!throughput && rankings.length === 0 && hotspots.length === 0 && trends.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-2">
          <Brain className="w-6 h-6" />
          <span className="text-[10px]">No intelligence data yet</span>
        </div>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-cyan-400" />
      <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-400">
        {label}
      </span>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded bg-zinc-900/50 px-2 py-1.5 text-center">
      <div className="text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[7px] uppercase tracking-wider text-zinc-600">{label}</div>
    </div>
  );
}
