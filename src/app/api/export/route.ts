import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Period helpers ─────────────────────────────────────────────────────────────

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "week":
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function getPeriodLabel(period: string): string {
  switch (period) {
    case "today":
      return "Today";
    case "month":
      return "This Month";
    case "week":
    default:
      return "Last 7 Days";
  }
}

// ── Duration formatter ─────────────────────────────────────────────────────────

function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

// ── CSV escape ─────────────────────────────────────────────────────────────────

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week";
    const format = searchParams.get("format") || "json";

    const periodStart = getPeriodStart(period);
    const periodLabel = getPeriodLabel(period);

    // Fetch tasks for the period
    const { data: tasks, error } = await supabase
      .from("swarm_tasks")
      .select("*")
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allTasks = tasks || [];

    // ── Aggregations ─────────────────────────────────────────────────────────

    const totalTasks = allTasks.length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const failed = allTasks.filter((t) => t.status === "failed").length;
    const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
    const queued = allTasks.filter((t) => t.status === "queued" || t.status === "pending").length;

    // By project
    const byProject: Record<string, { total: number; completed: number; failed: number; cost_cents: number }> = {};
    for (const t of allTasks) {
      const proj = t.project || "unassigned";
      if (!byProject[proj]) byProject[proj] = { total: 0, completed: 0, failed: 0, cost_cents: 0 };
      byProject[proj].total++;
      if (t.status === "completed") byProject[proj].completed++;
      if (t.status === "failed") byProject[proj].failed++;
      byProject[proj].cost_cents += t.cost_cents || 0;
    }

    // By task type
    const byTaskType: Record<string, { total: number; completed: number; failed: number }> = {};
    for (const t of allTasks) {
      const tt = t.task_type || "unknown";
      if (!byTaskType[tt]) byTaskType[tt] = { total: 0, completed: 0, failed: 0 };
      byTaskType[tt].total++;
      if (t.status === "completed") byTaskType[tt].completed++;
      if (t.status === "failed") byTaskType[tt].failed++;
    }

    // Top 10 tasks by duration
    const tasksWithDuration = allTasks
      .filter((t) => t.started_at && t.completed_at)
      .map((t) => {
        const durationMs = new Date(t.completed_at).getTime() - new Date(t.started_at).getTime();
        return {
          id: t.id,
          title: t.title,
          project: t.project || "unassigned",
          task_type: t.task_type,
          status: t.status,
          duration_ms: durationMs,
          duration_formatted: formatDurationMs(durationMs),
          started_at: t.started_at,
          completed_at: t.completed_at,
        };
      })
      .sort((a, b) => b.duration_ms - a.duration_ms)
      .slice(0, 10);

    // Error summary (failed tasks)
    const failedTasks = allTasks
      .filter((t) => t.status === "failed")
      .map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project || "unassigned",
        task_type: t.task_type,
        created_at: t.created_at,
        description: t.description,
      }));

    // Cost breakdown
    const totalCostCents = allTasks.reduce((sum, t) => sum + (t.cost_cents || 0), 0);
    const totalTokens = allTasks.reduce((sum, t) => sum + (t.tokens_used || 0), 0);

    const report = {
      report_period: periodLabel,
      generated_at: new Date().toISOString(),
      summary: {
        total_tasks: totalTasks,
        completed,
        failed,
        in_progress: inProgress,
        queued,
        success_rate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
        total_cost_usd: totalCostCents / 100,
        total_tokens: totalTokens,
      },
      by_project: byProject,
      by_task_type: byTaskType,
      top_10_by_duration: tasksWithDuration,
      error_summary: failedTasks,
      cost_breakdown: {
        total_cents: totalCostCents,
        total_usd: totalCostCents / 100,
        by_project: Object.fromEntries(
          Object.entries(byProject).map(([k, v]) => [k, { cents: v.cost_cents, usd: v.cost_cents / 100 }])
        ),
      },
    };

    // ── Format response ──────────────────────────────────────────────────────

    if (format === "csv") {
      // Build CSV with all tasks
      const headers = [
        "id",
        "title",
        "project",
        "task_type",
        "status",
        "priority",
        "cost_cents",
        "tokens_used",
        "started_at",
        "completed_at",
        "created_at",
        "duration_formatted",
      ];

      const rows = allTasks.map((t) => {
        const durationMs =
          t.started_at && t.completed_at
            ? new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
            : 0;
        return [
          csvEscape(t.id),
          csvEscape(t.title),
          csvEscape(t.project),
          csvEscape(t.task_type),
          csvEscape(t.status),
          csvEscape(t.priority),
          csvEscape(t.cost_cents),
          csvEscape(t.tokens_used),
          csvEscape(t.started_at),
          csvEscape(t.completed_at),
          csvEscape(t.created_at),
          csvEscape(durationMs > 0 ? formatDurationMs(durationMs) : ""),
        ].join(",");
      });

      // Add summary rows at top
      const summaryRows = [
        `# Nexus Report — ${periodLabel}`,
        `# Generated: ${new Date().toISOString()}`,
        `# Total Tasks: ${totalTasks} | Completed: ${completed} | Failed: ${failed} | Success Rate: ${report.summary.success_rate}%`,
        `# Total Cost: $${report.summary.total_cost_usd.toFixed(2)} | Total Tokens: ${totalTokens}`,
        "",
      ];

      const csv = [...summaryRows, headers.join(","), ...rows].join("\n");

      const dateSlug = new Date().toISOString().split("T")[0];
      const filename = `nexus-report-${period}-${dateSlug}.csv`;

      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: JSON
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
