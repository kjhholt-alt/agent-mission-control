import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/metrics — Live system health metrics for the swarm.
 *
 * Returns throughput, latency, error rates, worker utilization,
 * queue health, budget status, and health score.
 */
export async function GET() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Parallel queries for all metrics
    const [
      completedResp,
      failedResp,
      activeTasksResp,
      workersResp,
      budgetResp,
      teamsResp,
      recentDurationsResp,
    ] = await Promise.all([
      // Completed tasks in windows
      supabase
        .from("swarm_tasks")
        .select("id, completed_at, started_at, cost_tier, actual_cost_cents, tokens_used")
        .eq("status", "completed")
        .gte("completed_at", oneDayAgo)
        .order("completed_at", { ascending: false }),
      // Failed tasks in 24h
      supabase
        .from("swarm_tasks")
        .select("id, completed_at, error_message, project, task_type")
        .eq("status", "failed")
        .gte("updated_at", oneDayAgo),
      // Active tasks (queued, running, blocked)
      supabase
        .from("swarm_tasks")
        .select("id, status, cost_tier, priority, created_at, queued_at, started_at")
        .in("status", ["queued", "running", "blocked"]),
      // Active workers
      supabase
        .from("swarm_workers")
        .select("id, tier, status, tasks_completed, tasks_failed, total_cost_cents, xp")
        .neq("status", "dead"),
      // Today's budget
      supabase
        .from("swarm_budgets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
      // Active teams
      supabase
        .from("swarm_teams")
        .select("id, status, tasks_total, tasks_completed")
        .in("status", ["planning", "active"]),
      // Recent completed tasks with duration data
      supabase
        .from("swarm_tasks")
        .select("cost_tier, started_at, completed_at")
        .eq("status", "completed")
        .not("started_at", "is", null)
        .not("completed_at", "is", null)
        .gte("completed_at", oneDayAgo)
        .limit(200),
    ]);

    const completed = completedResp.data || [];
    const failed = failedResp.data || [];
    const activeTasks = activeTasksResp.data || [];
    const workers = workersResp.data || [];
    const budget = budgetResp.data?.[0] || {};
    const teams = teamsResp.data || [];
    const recentDurations = recentDurationsResp.data || [];

    // ── Throughput ──────────────────────────────────────────
    const completed1h = completed.filter(
      (t) => t.completed_at && t.completed_at >= oneHourAgo
    ).length;
    const completed6h = completed.filter(
      (t) => t.completed_at && t.completed_at >= sixHoursAgo
    ).length;
    const completed24h = completed.length;

    // ── Error rate ─────────────────────────────────────────
    const total24h = completed24h + failed.length;
    const errorRate24h = total24h > 0 ? failed.length / total24h : 0;

    // Top error categories
    const errorsByProject: Record<string, number> = {};
    for (const f of failed) {
      const key = f.project || "unknown";
      errorsByProject[key] = (errorsByProject[key] || 0) + 1;
    }

    // ── Latency (avg task duration by tier) ────────────────
    const durationsByTier: Record<string, number[]> = {};
    for (const t of recentDurations) {
      if (!t.started_at || !t.completed_at) continue;
      const start = new Date(t.started_at).getTime();
      const end = new Date(t.completed_at).getTime();
      const durationSec = (end - start) / 1000;
      if (durationSec > 0 && durationSec < 7200) {
        const tier = t.cost_tier || "unknown";
        if (!durationsByTier[tier]) durationsByTier[tier] = [];
        durationsByTier[tier].push(durationSec);
      }
    }

    const latencyByTier: Record<string, { avg: number; p50: number; p95: number; count: number }> = {};
    for (const [tier, durations] of Object.entries(durationsByTier)) {
      durations.sort((a, b) => a - b);
      const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
      const p50 = Math.round(durations[Math.floor(durations.length * 0.5)]);
      const p95 = Math.round(durations[Math.floor(durations.length * 0.95)]);
      latencyByTier[tier] = { avg, p50, p95, count: durations.length };
    }

    // ── Worker utilization ─────────────────────────────────
    const totalWorkers = workers.length;
    const workingWorkers = workers.filter((w) => w.status === "working").length;
    const idleWorkers = workers.filter((w) => w.status === "idle").length;
    const pausedWorkers = workers.filter((w) => w.status === "paused").length;
    const utilization = totalWorkers > 0 ? workingWorkers / totalWorkers : 0;

    const workersByTier: Record<string, number> = {};
    for (const w of workers) {
      workersByTier[w.tier] = (workersByTier[w.tier] || 0) + 1;
    }

    // ── Queue health ───────────────────────────────────────
    const queued = activeTasks.filter((t) => t.status === "queued");
    const running = activeTasks.filter((t) => t.status === "running");
    const blocked = activeTasks.filter((t) => t.status === "blocked");

    // Average wait time for queued tasks
    let avgWaitSeconds = 0;
    if (queued.length > 0) {
      const waits = queued
        .filter((t) => t.queued_at)
        .map((t) => (now.getTime() - new Date(t.queued_at).getTime()) / 1000);
      if (waits.length > 0) {
        avgWaitSeconds = Math.round(waits.reduce((s, w) => s + w, 0) / waits.length);
      }
    }

    // ── Cost ───────────────────────────────────────────────
    const totalCost24h = completed.reduce(
      (sum, t) => sum + (t.actual_cost_cents || 0),
      0
    );
    const totalTokens24h = completed.reduce(
      (sum, t) => sum + (t.tokens_used || 0),
      0
    );

    // ── Health score ───────────────────────────────────────
    let healthScore = 100;
    const issues: string[] = [];

    if (totalWorkers === 0 && queued.length > 0) {
      healthScore -= 25;
      issues.push("No active workers with queued tasks");
    } else if (queued.length > totalWorkers * 3) {
      healthScore -= 15;
      issues.push(`Queue overloaded: ${queued.length} tasks for ${totalWorkers} workers`);
    }

    if (errorRate24h > 0.5) {
      healthScore -= 25;
      issues.push(`High error rate: ${(errorRate24h * 100).toFixed(0)}%`);
    } else if (errorRate24h > 0.2) {
      healthScore -= 15;
      issues.push(`Elevated error rate: ${(errorRate24h * 100).toFixed(0)}%`);
    }

    const apiPct = budget.api_spent_cents && budget.daily_api_budget_cents
      ? (budget.api_spent_cents / budget.daily_api_budget_cents) * 100
      : 0;
    if (apiPct >= 100) {
      healthScore -= 25;
      issues.push("API budget exhausted");
    } else if (apiPct >= 80) {
      healthScore -= 10;
      issues.push(`API budget at ${apiPct.toFixed(0)}%`);
    }

    if (blocked.length > 10) {
      healthScore -= 15;
      issues.push(`${blocked.length} blocked tasks`);
    }

    healthScore = Math.max(0, healthScore);
    const grade = healthScore >= 90 ? "A" : healthScore >= 75 ? "B" : healthScore >= 60 ? "C" : healthScore >= 40 ? "D" : "F";

    return NextResponse.json({
      timestamp: now.toISOString(),
      health: {
        score: healthScore,
        grade,
        issues,
      },
      throughput: {
        completed_1h: completed1h,
        completed_6h: completed6h,
        completed_24h: completed24h,
        failed_24h: failed.length,
        error_rate_24h: Math.round(errorRate24h * 1000) / 10,
        errors_by_project: errorsByProject,
      },
      latency: latencyByTier,
      workers: {
        total: totalWorkers,
        working: workingWorkers,
        idle: idleWorkers,
        paused: pausedWorkers,
        utilization: Math.round(utilization * 100),
        by_tier: workersByTier,
      },
      queue: {
        queued: queued.length,
        running: running.length,
        blocked: blocked.length,
        avg_wait_seconds: avgWaitSeconds,
      },
      cost: {
        total_cents_24h: totalCost24h,
        total_tokens_24h: totalTokens24h,
        budget_api_pct: Math.round(apiPct),
      },
      teams: {
        active: teams.length,
        total_tasks: teams.reduce((s, t) => s + (t.tasks_total || 0), 0),
        completed_tasks: teams.reduce((s, t) => s + (t.tasks_completed || 0), 0),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
