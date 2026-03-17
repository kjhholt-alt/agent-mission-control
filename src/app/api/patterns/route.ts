import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/patterns — Task patterns, worker rankings, failure hotspots,
 * and cross-project trends.
 *
 * Returns:
 *  - specializations: raw agent_specializations rows
 *  - patterns: 7-day success/fail by project/task_type
 *  - workerRankings: top workers by tasks completed, XP, and success rate
 *  - failureHotspots: project/task_type combos with >50% failure rate
 *  - crossProjectTrends: task_type performance aggregated across all projects
 */
export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [specsRes, tasksRes, workersRes] = await Promise.all([
      supabase
        .from("agent_specializations")
        .select("*")
        .order("last_updated", { ascending: false }),
      supabase
        .from("swarm_tasks")
        .select("project, task_type, status, cost_tier, actual_cost_cents, tokens_used, created_at")
        .gte("created_at", sevenDaysAgo)
        .in("status", ["completed", "failed"]),
      supabase
        .from("swarm_workers")
        .select("id, worker_name, worker_type, tier, tasks_completed, tasks_failed, total_cost_cents, xp, status")
        .order("xp", { ascending: false })
        .limit(50),
    ]);

    const specs = specsRes.data || [];
    const tasks = tasksRes.data || [];
    const workers = workersRes.data || [];

    // ── 7-day patterns ───────────────────────────────────────────────
    const patterns: Record<string, { completed: number; failed: number; total: number; cost_cents: number; tokens: number }> = {};
    for (const t of tasks) {
      const key = `${t.project}/${t.task_type || "unknown"}`;
      if (!patterns[key]) patterns[key] = { completed: 0, failed: 0, total: 0, cost_cents: 0, tokens: 0 };
      patterns[key].total++;
      patterns[key].cost_cents += t.actual_cost_cents || 0;
      patterns[key].tokens += t.tokens_used || 0;
      if (t.status === "completed") patterns[key].completed++;
      if (t.status === "failed") patterns[key].failed++;
    }

    const patternList = Object.entries(patterns)
      .map(([key, data]) => ({
        key,
        ...data,
        successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Worker rankings ──────────────────────────────────────────────
    const workerRankings = workers
      .filter((w) => (w.tasks_completed || 0) + (w.tasks_failed || 0) > 0)
      .map((w) => {
        const total = (w.tasks_completed || 0) + (w.tasks_failed || 0);
        return {
          id: w.id,
          name: w.worker_name,
          type: w.worker_type,
          tier: w.tier,
          status: w.status,
          tasks_completed: w.tasks_completed || 0,
          tasks_failed: w.tasks_failed || 0,
          success_rate: total > 0 ? Math.round(((w.tasks_completed || 0) / total) * 100) : 0,
          xp: w.xp || 0,
          total_cost_cents: w.total_cost_cents || 0,
          efficiency: (w.tasks_completed || 0) > 0
            ? Math.round((w.total_cost_cents || 0) / w.tasks_completed)
            : 0,
        };
      })
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 20);

    // ── Failure hotspots (>50% fail rate, min 3 tasks) ───────────────
    const failureHotspots = patternList
      .filter((p) => p.total >= 3 && p.successRate < 50)
      .map((p) => ({
        key: p.key,
        fail_rate: 100 - p.successRate,
        failed: p.failed,
        total: p.total,
        wasted_cost_cents: Math.round(p.cost_cents * (p.failed / p.total)),
      }))
      .sort((a, b) => b.fail_rate - a.fail_rate);

    // ── Cross-project trends (aggregate by task_type) ────────────────
    const byTaskType: Record<string, { completed: number; failed: number; total: number; projects: Set<string> }> = {};
    for (const t of tasks) {
      const tt = t.task_type || "unknown";
      if (!byTaskType[tt]) byTaskType[tt] = { completed: 0, failed: 0, total: 0, projects: new Set() };
      byTaskType[tt].total++;
      byTaskType[tt].projects.add(t.project || "unknown");
      if (t.status === "completed") byTaskType[tt].completed++;
      if (t.status === "failed") byTaskType[tt].failed++;
    }

    const crossProjectTrends = Object.entries(byTaskType)
      .map(([taskType, data]) => ({
        task_type: taskType,
        ...data,
        projects: Array.from(data.projects),
        project_count: data.projects.size,
        successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      specializations: specs,
      patterns: patternList,
      workerRankings,
      failureHotspots,
      crossProjectTrends,
      period: "7d",
      totalTasks: tasks.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
