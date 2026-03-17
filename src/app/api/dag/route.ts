import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DagNode {
  id: string;
  title: string;
  task_type: string;
  status: string;
  priority: number;
  cost_tier: string;
  assigned_worker_id: string | null;
  actual_cost_cents: number | null;
  tokens_used: number | null;
  depends_on: string[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  depth: number;
}

interface DagEdge {
  from: string;
  to: string;
}

/**
 * GET /api/dag — Full DAG topology for a task tree.
 *
 * Query params:
 *   root_id: UUID of the parent/meta task
 *   team_id: UUID of a team (finds tasks by team_id in input_data)
 *
 * Returns nodes, edges, status counts, critical path depth, and cost.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rootId = searchParams.get("root_id");
    const teamId = searchParams.get("team_id");

    if (!rootId && !teamId) {
      return NextResponse.json(
        { error: "Missing required param: root_id or team_id" },
        { status: 400 }
      );
    }

    let rootTask = null;
    let tasks: Record<string, unknown>[] = [];

    if (rootId) {
      // Fetch root task
      const { data: root } = await supabase
        .from("swarm_tasks")
        .select("*")
        .eq("id", rootId)
        .single();

      if (!root) {
        return NextResponse.json(
          { error: "Root task not found" },
          { status: 404 }
        );
      }
      rootTask = root;

      // Fetch all children of this root
      const { data: children } = await supabase
        .from("swarm_tasks")
        .select("*")
        .eq("parent_task_id", rootId)
        .order("priority", { ascending: true });

      tasks = children || [];
    } else if (teamId) {
      // Fetch tasks by team_id (stored in input_data.team_id)
      // First get the team to find member_task_ids
      const { data: team } = await supabase
        .from("swarm_teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (!team) {
        return NextResponse.json(
          { error: "Team not found" },
          { status: 404 }
        );
      }

      const memberIds = team.member_task_ids || [];
      if (memberIds.length > 0) {
        const { data: memberTasks } = await supabase
          .from("swarm_tasks")
          .select("*")
          .in("id", memberIds)
          .order("priority", { ascending: true });

        tasks = memberTasks || [];
      }

      rootTask = {
        id: team.id,
        title: team.name,
        status: team.status,
        created_at: team.created_at,
      };
    }

    // Build task ID set for edge validation
    const taskIds = new Set(tasks.map((t) => t.id as string));

    // Calculate depth for each node (longest path from root)
    const depthMap: Record<string, number> = {};
    function getDepth(taskId: string): number {
      if (depthMap[taskId] !== undefined) return depthMap[taskId];
      const task = tasks.find((t) => t.id === taskId);
      const deps = (task?.depends_on as string[]) || [];
      const validDeps = deps.filter((d) => taskIds.has(d));
      if (validDeps.length === 0) {
        depthMap[taskId] = 0;
        return 0;
      }
      const maxDep = Math.max(...validDeps.map((d) => getDepth(d) + 1));
      depthMap[taskId] = maxDep;
      return maxDep;
    }
    tasks.forEach((t) => getDepth(t.id as string));

    // Build nodes
    const nodes: DagNode[] = tasks.map((t) => ({
      id: t.id as string,
      title: t.title as string,
      task_type: t.task_type as string,
      status: t.status as string,
      priority: t.priority as number,
      cost_tier: t.cost_tier as string,
      assigned_worker_id: t.assigned_worker_id as string | null,
      actual_cost_cents: t.actual_cost_cents as number | null,
      tokens_used: t.tokens_used as number | null,
      depends_on: ((t.depends_on as string[]) || []).filter((d) =>
        taskIds.has(d)
      ),
      created_at: t.created_at as string,
      started_at: t.started_at as string | null,
      completed_at: t.completed_at as string | null,
      error_message: t.error_message as string | null,
      retry_count: t.retry_count as number,
      depth: depthMap[t.id as string] || 0,
    }));

    // Build edges
    const edges: DagEdge[] = [];
    for (const node of nodes) {
      for (const depId of node.depends_on) {
        edges.push({ from: depId, to: node.id });
      }
    }

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const t of tasks) {
      const s = t.status as string;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    const total = tasks.length;
    const completed = statusCounts["completed"] || 0;
    const failed = statusCounts["failed"] || 0;
    const running = statusCounts["running"] || 0;
    const blocked = statusCounts["blocked"] || 0;
    const queued = statusCounts["queued"] || 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const totalCost = tasks.reduce(
      (sum, t) => sum + ((t.actual_cost_cents as number) || 0),
      0
    );
    const totalTokens = tasks.reduce(
      (sum, t) => sum + ((t.tokens_used as number) || 0),
      0
    );

    const maxDepth = Math.max(0, ...Object.values(depthMap));

    // Identify critical path (nodes at max depth)
    const criticalPath = nodes
      .filter((n) => n.depth === maxDepth)
      .map((n) => n.id);

    // Identify bottlenecks (blocked tasks with most dependents)
    const dependentCount: Record<string, number> = {};
    for (const node of nodes) {
      for (const depId of node.depends_on) {
        dependentCount[depId] = (dependentCount[depId] || 0) + 1;
      }
    }
    const bottlenecks = Object.entries(dependentCount)
      .filter(([id]) => {
        const node = nodes.find((n) => n.id === id);
        return node && node.status !== "completed";
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({ task_id: id, downstream_count: count }));

    return NextResponse.json({
      root: rootTask,
      nodes,
      edges,
      stats: {
        total,
        completed,
        failed,
        running,
        blocked,
        queued,
        pct,
        total_cost_cents: totalCost,
        total_tokens: totalTokens,
        max_depth: maxDepth,
        critical_path: criticalPath,
        bottlenecks,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
