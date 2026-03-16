import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/patterns — Task success/fail patterns and agent specializations.
 */
export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [specsRes, tasksRes] = await Promise.all([
      supabase.from("agent_specializations").select("*").order("last_updated", { ascending: false }),
      supabase.from("swarm_tasks").select("project, task_type, status, created_at")
        .gte("created_at", sevenDaysAgo)
        .in("status", ["completed", "failed"]),
    ]);

    const specs = specsRes.data || [];
    const tasks = tasksRes.data || [];

    // Compute 7-day patterns
    const patterns: Record<string, { completed: number; failed: number; total: number }> = {};
    for (const t of tasks) {
      const key = `${t.project}/${t.task_type || "unknown"}`;
      if (!patterns[key]) patterns[key] = { completed: 0, failed: 0, total: 0 };
      patterns[key].total++;
      if (t.status === "completed") patterns[key].completed++;
      if (t.status === "failed") patterns[key].failed++;
    }

    const patternList = Object.entries(patterns).map(([key, data]) => ({
      key,
      ...data,
      successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      specializations: specs,
      patterns: patternList,
      period: "7d",
      totalTasks: tasks.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
