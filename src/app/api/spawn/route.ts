import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/spawn — Create a new mission (swarm task).
 *
 * Body: { goal, project, priority?, worker_type? }
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

    const now = new Date().toISOString();
    const taskId = crypto.randomUUID();

    const task = {
      id: taskId,
      title: goal,
      description: goal,
      project: project,
      priority: body.priority ?? 50,
      status: "queued",
      task_type: body.worker_type || "goal",
      created_at: now,
      updated_at: now,
      retry_count: 0,
      max_retries: 3,
    };

    const { data, error } = await supabase
      .from("swarm_tasks")
      .insert(task)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also log to swarm_task_log
    supabase
      .from("swarm_task_log")
      .insert({
        task_id: taskId,
        event_type: "created",
        title: `Mission spawned: ${goal}`,
        details: JSON.stringify({
          source: "nexus-dashboard",
          worker_type: body.worker_type || "any",
          priority: body.priority ?? 50,
        }),
        project: project,
      })
      .then(() => {});

    return NextResponse.json({
      ok: true,
      message: `Mission queued: ${goal}`,
      task_id: taskId,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
