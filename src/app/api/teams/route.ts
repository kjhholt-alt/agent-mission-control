import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/teams — List agent teams with optional filtering.
 *
 * Query params: status, project, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const project = searchParams.get("project");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let query = supabase
      .from("swarm_teams")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (project) query = query.eq("project", project);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich each team with task progress
    const teams = await Promise.all(
      (data || []).map(async (team) => {
        const memberIds = team.member_task_ids || [];
        if (memberIds.length === 0) {
          return { ...team, progress: { total: 0, completed: 0, pct: 0 } };
        }

        const { data: tasks } = await supabase
          .from("swarm_tasks")
          .select("id, status, actual_cost_cents")
          .in("id", memberIds);

        const taskList = tasks || [];
        const completed = taskList.filter((t) => t.status === "completed").length;
        const failed = taskList.filter((t) => t.status === "failed").length;
        const running = taskList.filter((t) => t.status === "running").length;
        const totalCost = taskList.reduce(
          (sum, t) => sum + (t.actual_cost_cents || 0),
          0
        );

        return {
          ...team,
          progress: {
            total: taskList.length,
            completed,
            failed,
            running,
            pct: taskList.length > 0 ? Math.round((completed / taskList.length) * 100) : 0,
          },
          cost_cents: totalCost,
        };
      })
    );

    return NextResponse.json({ teams, total: teams.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams — Create a new agent team.
 *
 * Body: { goal, project, name?, max_workers?, use_worktrees? }
 *
 * This creates the team record and decomposes the goal into tasks.
 * The Python swarm orchestrator picks up and executes the tasks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { goal, project } = body;

    if (!goal || !project) {
      return NextResponse.json(
        { error: "Missing required fields: goal, project" },
        { status: 400 }
      );
    }

    // Validate project is in the allowlist
    const ALLOWED_PROJECTS = [
      "pl-engine", "buildkit-services", "nexus", "email-finder", "mcp-servers",
    ];
    if (!ALLOWED_PROJECTS.includes(project)) {
      return NextResponse.json(
        { error: `Unknown project: ${project}. Allowed: ${ALLOWED_PROJECTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate goal length
    if (typeof goal !== "string" || goal.length > 2000) {
      return NextResponse.json(
        { error: "Goal must be a string under 2000 characters" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const teamId = crypto.randomUUID();
    const name = body.name || `team-${teamId.slice(0, 8)}`;
    const maxWorkers = body.max_workers ?? 3;
    const useWorktrees = body.use_worktrees ?? true;

    // Create team record
    const teamRow = {
      id: teamId,
      name,
      goal,
      project,
      status: "planning",
      max_workers: maxWorkers,
      use_worktrees: useWorktrees,
      worktree_paths: {},
      created_at: now,
      tasks_total: 0,
      tasks_completed: 0,
      cost_cents: 0,
    };

    const { data: team, error: teamError } = await supabase
      .from("swarm_teams")
      .insert(teamRow)
      .select()
      .single();

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    // Create a meta-task that the Python goal_decomposer will pick up
    // The orchestrator detects team tasks and decomposes them
    const metaTaskId = crypto.randomUUID();
    const { error: taskError } = await supabase.from("swarm_tasks").insert({
      id: metaTaskId,
      title: `[TEAM] ${goal}`,
      description: goal,
      project,
      priority: body.priority ?? 30,
      status: "queued",
      task_type: "meta",
      cost_tier: "cc_light",
      created_at: now,
      updated_at: now,
      retry_count: 0,
      max_retries: 1,
      input_data: {
        prompt: goal,
        team_id: teamId,
        use_worktree: useWorktrees,
        max_workers: maxWorkers,
        decompose: true,
      },
    });

    if (taskError) {
      // Clean up team record
      await supabase.from("swarm_teams").delete().eq("id", teamId);
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    // Update team with leader task
    await supabase
      .from("swarm_teams")
      .update({ leader_task_id: metaTaskId })
      .eq("id", teamId);

    // Log event
    supabase
      .from("swarm_task_log")
      .insert({
        task_id: metaTaskId,
        event: "team_created",
        details: `Team ${name}: ${goal}`,
      })
      .then(() => {});

    // Discord notification
    if (process.env.DISCORD_WEBHOOK_URL) {
      fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "NEXUS",
          embeds: [
            {
              title: "Agent Team Created",
              description: `**${name}**\n${goal}`,
              color: 0xf472b6,
              fields: [
                { name: "Project", value: project, inline: true },
                { name: "Max Workers", value: String(maxWorkers), inline: true },
                { name: "Worktrees", value: useWorktrees ? "Yes" : "No", inline: true },
              ],
              footer: { text: "NEXUS Agent Teams" },
              timestamp: now,
            },
          ],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      team_id: teamId,
      name,
      leader_task_id: metaTaskId,
      message: `Team created: ${name}. Goal decomposition queued.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
