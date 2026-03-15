import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/today — Aggregated dashboard data for today.
 * Returns tasks, costs, workers, sessions in a single call.
 */
export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    const [tasksRes, workersRes, budgetRes, sessionsRes, specRes] = await Promise.all([
      supabase.from("swarm_tasks").select("*")
        .or(`updated_at.gte.${todayStart},status.in.(queued,running,pending_approval,approved)`)
        .order("updated_at", { ascending: false }).limit(50),
      supabase.from("swarm_workers").select("*")
        .order("tasks_completed", { ascending: false }).limit(10),
      supabase.from("swarm_budgets").select("*")
        .order("budget_date", { ascending: false }).limit(1),
      supabase.from("nexus_sessions").select("*")
        .gte("last_activity", todayStart)
        .order("last_activity", { ascending: false }).limit(20),
      supabase.from("agent_specializations").select("*")
        .order("last_updated", { ascending: false }).limit(20),
    ]);

    const tasks = tasksRes.data || [];
    const workers = workersRes.data || [];
    const sessions = sessionsRes.data || [];
    const specs = specRes.data || [];

    // Aggregate today's tasks
    const todayTasks = tasks.filter(t => t.created_at >= todayStart || ["queued", "running", "pending_approval"].includes(t.status));
    const completed = todayTasks.filter(t => t.status === "completed").length;
    const failed = todayTasks.filter(t => t.status === "failed").length;
    const queued = todayTasks.filter(t => t.status === "queued").length;
    const running = todayTasks.filter(t => t.status === "running").length;
    const pending = todayTasks.filter(t => t.status === "pending_approval").length;

    // Cost from sessions
    const todayCost = sessions.reduce((sum, s) => sum + (parseFloat(s.cost_usd) || 0), 0);
    const todayTokens = sessions.reduce((sum, s) => sum + (s.input_tokens || 0) + (s.output_tokens || 0), 0);

    // Project status
    const projectMap: Record<string, { tasks: number; completed: number; failed: number; lastActivity: string }> = {};
    for (const t of todayTasks) {
      const p = t.project || "general";
      if (!projectMap[p]) projectMap[p] = { tasks: 0, completed: 0, failed: 0, lastActivity: "" };
      projectMap[p].tasks++;
      if (t.status === "completed") projectMap[p].completed++;
      if (t.status === "failed") projectMap[p].failed++;
      if (t.updated_at > (projectMap[p].lastActivity || "")) projectMap[p].lastActivity = t.updated_at;
    }

    const projects = Object.entries(projectMap).map(([name, data]) => ({
      name,
      ...data,
      health: data.failed > data.completed ? "red" : data.failed > 0 ? "yellow" : "green",
    })).sort((a, b) => b.tasks - a.tasks);

    // Agent rankings
    const rankings = workers
      .filter(w => (w.tasks_completed || 0) > 0)
      .map(w => ({
        id: w.id,
        name: w.worker_name,
        type: w.worker_type,
        completed: w.tasks_completed || 0,
        failed: w.tasks_failed || 0,
        xp: w.xp || 0,
        status: w.status,
        successRate: w.tasks_completed
          ? Math.round((w.tasks_completed / (w.tasks_completed + (w.tasks_failed || 0))) * 100)
          : 0,
      }));

    return NextResponse.json({
      date: todayStart,
      summary: { completed, failed, queued, running, pending, total: todayTasks.length },
      cost: { usd: Math.round(todayCost * 100) / 100, tokens: todayTokens },
      budget: budgetRes.data?.[0] || null,
      tasks: todayTasks.slice(0, 20),
      projects,
      rankings,
      specializations: specs,
      sessions: { active: sessions.filter(s => s.status === "active").length, total: sessions.length },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
