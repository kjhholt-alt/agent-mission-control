import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/webhook — External services trigger swarm tasks.
 *
 * Body formats:
 *   { goal: "Improve the PL Engine", project?: "pl-engine", priority?: 30 }
 *   { event: "pr_merged", repo: "pl-engine", data: {...} }
 *
 * Creates a swarm task from the webhook payload.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Determine if this is a goal-based or event-based webhook
    const isGoal = !!body.goal;
    const isEvent = !!body.event;

    if (!isGoal && !isEvent) {
      return NextResponse.json(
        { error: "Missing required field: 'goal' or 'event'" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (isGoal) {
      // Goal-based: create a swarm task directly
      const task = {
        id: crypto.randomUUID(),
        title: body.goal,
        project: body.project || "general",
        priority: body.priority ?? 50,
        status: "queued",
        task_type: "goal",
        input_data: {
          prompt: body.goal,
          source: "webhook",
          metadata: body.metadata || {},
        },
        created_at: now,
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

      return NextResponse.json({
        ok: true,
        message: `Task queued: ${body.goal}`,
        task_id: data.id,
        data,
      });
    }

    // Event-based: translate event into a task
    const eventMap: Record<string, { title: string; taskType: string; priority: number }> = {
      pr_merged: {
        title: `Post-merge review: ${body.repo || "unknown"}`,
        taskType: "eval",
        priority: 40,
      },
      pr_opened: {
        title: `Code review: ${body.repo || "unknown"} PR`,
        taskType: "eval",
        priority: 30,
      },
      deploy_failed: {
        title: `Investigate deploy failure: ${body.repo || "unknown"}`,
        taskType: "eval",
        priority: 10,
      },
      health_alert: {
        title: `Health alert: ${body.data?.service || body.repo || "unknown"}`,
        taskType: "eval",
        priority: 20,
      },
      schedule: {
        title: body.data?.title || `Scheduled task: ${body.repo || "general"}`,
        taskType: body.data?.task_type || "eval",
        priority: body.data?.priority || 50,
      },
    };

    const mapped = eventMap[body.event] || {
      title: `Event: ${body.event} on ${body.repo || "unknown"}`,
      taskType: "eval",
      priority: 50,
    };

    const task = {
      id: crypto.randomUUID(),
      title: mapped.title,
      project: body.repo || body.project || "general",
      priority: body.priority ?? mapped.priority,
      status: "queued",
      task_type: mapped.taskType,
      input_data: {
        prompt: mapped.title,
        source: "webhook",
        event: body.event,
        event_data: body.data || {},
      },
      created_at: now,
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

    return NextResponse.json({
      ok: true,
      message: `Event '${body.event}' processed — task queued`,
      task_id: data.id,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
