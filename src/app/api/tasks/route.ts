import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/tasks — Unified task query endpoint.
 *
 * Query params:
 *   status   — filter by status (queued, running, completed, failed, blocked)
 *   project  — filter by project name
 *   type     — filter by task_type
 *   limit    — max results (default 50)
 *   offset   — pagination offset (default 0)
 *   sort     — sort field (default: updated_at)
 *   order    — asc or desc (default: desc)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const project = searchParams.get("project");
    const taskType = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = searchParams.get("sort") || "updated_at";
    const order = searchParams.get("order") === "asc";

    let query = supabase
      .from("swarm_tasks")
      .select("*", { count: "exact" })
      .order(sort, { ascending: order })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (project) query = query.eq("project", project);
    if (taskType) query = query.eq("task_type", taskType);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregates
    const tasks = data || [];
    const statusCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};
    for (const t of tasks) {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      const p = t.project || "general";
      projectCounts[p] = (projectCounts[p] || 0) + 1;
    }

    return NextResponse.json({
      tasks,
      total: count || 0,
      limit,
      offset,
      aggregates: {
        by_status: statusCounts,
        by_project: projectCounts,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
