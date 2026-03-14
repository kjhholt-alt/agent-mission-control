import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "latest";

  const sb = getSupabase();

  try {
    if (type === "latest") {
      // Get latest briefing
      const { data } = await sb
        .from("oracle_briefings")
        .select("*")
        .eq("briefing_type", "briefing")
        .order("created_at", { ascending: false })
        .limit(1);

      const briefing = data?.[0]?.data;
      return NextResponse.json({
        briefing: typeof briefing === "string" ? JSON.parse(briefing) : briefing,
      });
    }

    if (type === "digest") {
      const { data } = await sb
        .from("oracle_briefings")
        .select("*")
        .eq("briefing_type", "daily_digest")
        .order("created_at", { ascending: false })
        .limit(1);

      const digest = data?.[0]?.data;
      return NextResponse.json({
        digest: typeof digest === "string" ? JSON.parse(digest) : digest,
      });
    }

    if (type === "weekly") {
      const { data } = await sb
        .from("oracle_briefings")
        .select("*")
        .eq("briefing_type", "weekly_report")
        .order("created_at", { ascending: false })
        .limit(1);

      const report = data?.[0]?.data;
      return NextResponse.json({
        report: typeof report === "string" ? JSON.parse(report) : report,
      });
    }

    if (type === "all") {
      const { data } = await sb
        .from("oracle_briefings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const briefings = (data || []).map((row) => {
        const d = row.data;
        return typeof d === "string" ? JSON.parse(d) : d;
      });

      return NextResponse.json({ briefings });
    }

    // Live data: generate a real-time briefing from current state
    if (type === "live") {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const dayStart = new Date(now.toISOString().split("T")[0]).toISOString();

      // Parallel fetch all data
      const [
        budgetRes,
        completedRes,
        failedRes,
        queuedRes,
        stuckRes,
        deadWorkersRes,
      ] = await Promise.all([
        sb
          .from("swarm_budgets")
          .select("*")
          .eq("budget_date", today)
          .limit(1),
        sb
          .from("swarm_tasks")
          .select("id, title, project, completed_at, output_data, actual_cost_cents")
          .eq("status", "completed")
          .neq("task_type", "meta")
          .gte("completed_at", twoHoursAgo)
          .order("completed_at", { ascending: false })
          .limit(10),
        sb
          .from("swarm_tasks")
          .select("id, title, project, error_message, retry_count, max_retries, completed_at")
          .eq("status", "failed")
          .gte("completed_at", dayStart)
          .order("completed_at", { ascending: false })
          .limit(10),
        sb
          .from("swarm_tasks")
          .select("id, title, project, priority")
          .eq("status", "queued")
          .neq("task_type", "meta")
          .order("priority", { ascending: true })
          .limit(5),
        sb
          .from("swarm_tasks")
          .select("id, title, project, started_at, assigned_worker_id")
          .eq("status", "running")
          .lt("started_at", thirtyMinAgo),
        sb
          .from("swarm_workers")
          .select("id, worker_name, worker_type, died_at")
          .eq("status", "dead")
          .gte("died_at", twoHoursAgo),
      ]);

      // Build budget
      const budgetRow = budgetRes.data?.[0];
      const budget = budgetRow
        ? {
            api_spent: budgetRow.api_spent_cents || 0,
            api_limit: budgetRow.daily_api_budget_cents || 500,
            api_pct: budgetRow.daily_api_budget_cents
              ? Math.round(
                  ((budgetRow.api_spent_cents || 0) /
                    budgetRow.daily_api_budget_cents) *
                    1000
                ) / 10
              : 0,
            tasks_completed: budgetRow.tasks_completed || 0,
            tasks_failed: budgetRow.tasks_failed || 0,
          }
        : { api_spent: 0, api_limit: 500, api_pct: 0, tasks_completed: 0, tasks_failed: 0 };

      // Build decisions
      const decisions: Array<Record<string, unknown>> = [];

      // Failed tasks needing redirection
      for (const task of failedRes.data || []) {
        if ((task.retry_count || 0) >= (task.max_retries || 3)) {
          decisions.push({
            type: "failed_task",
            severity: "high",
            title: `Task failed ${task.retry_count}x: ${task.title}`,
            detail: (task.error_message || "No error recorded").slice(0, 200),
            task_id: task.id,
            project: task.project || "unknown",
            actions: ["retry", "redirect", "dismiss"],
          });
        }
      }

      // Budget warning
      if (budget.api_pct >= 80) {
        decisions.push({
          type: "budget_warning",
          severity: budget.api_pct >= 95 ? "critical" : "high",
          title: `API budget at ${budget.api_pct}%`,
          detail: `$${(budget.api_spent / 100).toFixed(2)} / $${(budget.api_limit / 100).toFixed(2)} spent today`,
          actions: ["increase_budget", "pause_workers", "dismiss"],
        });
      }

      // Stuck tasks
      for (const task of stuckRes.data || []) {
        decisions.push({
          type: "stuck_task",
          severity: "medium",
          title: `Task stuck: ${task.title}`,
          detail: `Running since ${task.started_at || "unknown"} in ${task.project || "unknown"}`,
          task_id: task.id,
          project: task.project || "unknown",
          actions: ["retry", "cancel", "dismiss"],
        });
      }

      // Dead workers
      if ((deadWorkersRes.data?.length || 0) >= 2) {
        decisions.push({
          type: "worker_deaths",
          severity: "medium",
          title: `${deadWorkersRes.data!.length} workers died in the last 2 hours`,
          detail: "Multiple worker deaths may indicate a systemic issue",
          actions: ["investigate", "restart_swarm", "dismiss"],
        });
      }

      // Highlights
      const highlights = (completedRes.data || []).map((t) => ({
        title: t.title,
        project: t.project || "unknown",
        completed_at: t.completed_at,
        summary: "",
      }));

      // Next steps
      const next_steps = (queuedRes.data || []).map(
        (t) => `[${t.project || "?"}] ${t.title}`
      );

      // Greeting
      const easternHour = (now.getUTCHours() - 5 + 24) % 24;
      let greeting: string;
      if (easternHour < 12) {
        greeting = "Good morning, Kruz. Here's what you need to know:";
      } else if (easternHour < 17) {
        greeting = "Good afternoon, Kruz. Here's your update:";
      } else {
        greeting = "Good evening, Kruz. Here's the latest:";
      }

      // Today's completed/failed counts
      const todayCompleted = (completedRes.data || []).length;
      const todayFailed = (failedRes.data || []).length;

      return NextResponse.json({
        briefing: {
          type: "live",
          timestamp: now.toISOString(),
          greeting,
          decisions_needed: decisions,
          highlights,
          budget,
          project_health: {},
          next_steps,
          summary: decisions.length
            ? `${decisions.length} item(s) need your attention. ${todayCompleted} tasks completed today.`
            : todayCompleted > 0
              ? `All clear. ${todayCompleted} tasks completed, ${todayFailed} failed today. Budget at ${budget.api_pct}%.`
              : "All quiet. The swarm is idle.",
          today_completed: todayCompleted,
          today_failed: todayFailed,
        },
      });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error) {
    console.error("Oracle API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Oracle data" },
      { status: 500 }
    );
  }
}
