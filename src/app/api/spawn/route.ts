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

    // Map worker type to cost tier for orchestrator
    const workerType = body.worker_type || "builder";
    const costTierMap: Record<string, string> = {
      builder: "cc_light",
      inspector: "cc_light",
      scout: "cc_light",
      deployer: "cc_light",
      miner: "light",
      messenger: "light",
      any: "cc_light",
      goal: "cc_light",
    };

    const task = {
      id: taskId,
      title: goal,
      description: goal,
      project: project,
      priority: body.priority ?? 50,
      status: "queued",
      task_type: workerType === "goal" ? "eval" : workerType,
      cost_tier: costTierMap[workerType] || "cc_light",
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

    // Log to swarm_task_log
    supabase
      .from("swarm_task_log")
      .insert({
        task_id: taskId,
        event: "created",
        details: `[${project}] Mission spawned: ${goal}`,
      })
      .then(() => {});

    // Discord notification (fire-and-forget)
    if (process.env.DISCORD_WEBHOOK_URL) {
      fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "NEXUS",
          embeds: [
            {
              title: "New Mission Spawned",
              description: `**${goal}**`,
              color: 0x06b6d4,
              fields: [
                { name: "Project", value: project, inline: true },
                { name: "Priority", value: String(body.priority ?? 50), inline: true },
              ],
              footer: { text: "NEXUS" },
              timestamp: now,
            },
          ],
        }),
      }).catch(() => {});
    }

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
