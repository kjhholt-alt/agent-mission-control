import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  source: string;
}

/**
 * GET /api/alerts — Check for system anomalies and return active alerts.
 *
 * Checks:
 *   1. Task failure rate > 50% in last hour
 *   2. Tasks stuck in "running" for > 30 minutes
 *   3. Budget spend > 80% of daily limit
 *   4. No executor heartbeat in last 15 minutes
 */
export async function GET() {
  try {
    const alerts: Alert[] = [];
    const now = new Date();

    // ── 1. High failure rate in last hour ────────────────────────────────
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const [completedLastHour, failedLastHour] = await Promise.all([
      supabase
        .from("swarm_tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("completed_at", oneHourAgo),
      supabase
        .from("swarm_tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("completed_at", oneHourAgo),
    ]);

    const completedCount = completedLastHour.count || 0;
    const failedCount = failedLastHour.count || 0;
    const totalRecent = completedCount + failedCount;

    if (totalRecent > 0) {
      const failureRate = failedCount / totalRecent;
      if (failureRate > 0.5) {
        alerts.push({
          id: `failure-rate-${now.getTime()}`,
          severity: failureRate > 0.8 ? "critical" : "warning",
          message: `High failure rate: ${Math.round(failureRate * 100)}% of tasks failed in the last hour (${failedCount}/${totalRecent})`,
          timestamp: now.toISOString(),
          source: "task-monitor",
        });
      }
    }

    // ── 2. Stuck running tasks (> 30 minutes) ───────────────────────────
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { data: stuckTasks, error: stuckError } = await supabase
      .from("swarm_tasks")
      .select("id, title, created_at, updated_at")
      .eq("status", "running")
      .lt("updated_at", thirtyMinAgo);

    if (!stuckError && stuckTasks && stuckTasks.length > 0) {
      for (const task of stuckTasks.slice(0, 3)) {
        const stuckMins = Math.round(
          (now.getTime() - new Date(task.updated_at).getTime()) / 60000
        );
        alerts.push({
          id: `stuck-task-${task.id}`,
          severity: stuckMins > 60 ? "critical" : "warning",
          message: `Task stuck for ${stuckMins}m: "${task.title?.slice(0, 60) || task.id}"`,
          timestamp: now.toISOString(),
          source: "task-monitor",
        });
      }
    }

    // ── 3. Budget spend > 80% ───────────────────────────────────────────
    const todayStr = now.toISOString().split("T")[0];

    const { data: budgetData } = await supabase
      .from("swarm_budgets")
      .select("api_spent_cents, daily_limit_cents")
      .eq("budget_date", todayStr)
      .limit(1);

    if (budgetData && budgetData.length > 0) {
      const { api_spent_cents, daily_limit_cents } = budgetData[0];
      if (daily_limit_cents && daily_limit_cents > 0) {
        const spendRatio = api_spent_cents / daily_limit_cents;
        if (spendRatio > 0.8) {
          const spentDollars = (api_spent_cents / 100).toFixed(2);
          const limitDollars = (daily_limit_cents / 100).toFixed(2);
          alerts.push({
            id: `budget-${now.getTime()}`,
            severity: spendRatio > 0.95 ? "critical" : "warning",
            message: `Budget alert: $${spentDollars} / $${limitDollars} spent today (${Math.round(spendRatio * 100)}%)`,
            timestamp: now.toISOString(),
            source: "budget-monitor",
          });
        }
      }
    }

    // ── 4. No worker heartbeat in last 15 minutes ───────────────────────
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

    const { data: recentWorkers } = await supabase
      .from("swarm_workers")
      .select("id, worker_name, last_heartbeat, status")
      .neq("status", "dead");

    if (recentWorkers && recentWorkers.length > 0) {
      const staleWorkers = recentWorkers.filter(
        (w) => w.last_heartbeat && w.last_heartbeat < fifteenMinAgo
      );

      if (staleWorkers.length > 0) {
        const allStale = staleWorkers.length === recentWorkers.length;
        alerts.push({
          id: `heartbeat-${now.getTime()}`,
          severity: allStale ? "critical" : "warning",
          message: allStale
            ? `No executor heartbeat in 15+ minutes (${staleWorkers.length} workers stale)`
            : `${staleWorkers.length}/${recentWorkers.length} workers have stale heartbeats (>15 min)`,
          timestamp: now.toISOString(),
          source: "heartbeat-monitor",
        });
      }
    }

    return NextResponse.json({
      alerts,
      checked_at: now.toISOString(),
      checks: ["failure_rate", "stuck_tasks", "budget_spend", "heartbeat"],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error", alerts: [] },
      { status: 500 }
    );
  }
}
