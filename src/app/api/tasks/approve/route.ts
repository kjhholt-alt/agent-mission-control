import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/tasks/approve — Approve a task that's waiting for approval.
 *
 * Body: { task_id: string, action?: "approve" | "reject" }
 *
 * Approved tasks get status="approved" so the executor picks them up.
 * Rejected tasks get status="cancelled".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, action = "approve" } = body;

    if (!task_id) {
      return NextResponse.json(
        { error: "Missing required field: task_id" },
        { status: 400 }
      );
    }

    // Verify the task exists and is pending approval
    const { data: task, error: fetchError } = await supabase
      .from("swarm_tasks")
      .select("id, title, status, project")
      .eq("id", task_id)
      .single();

    if (fetchError || !task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    if (task.status !== "pending_approval") {
      return NextResponse.json(
        { error: `Task is not pending approval (current status: ${task.status})` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      // Reject — cancel the task
      const { error } = await supabase
        .from("swarm_tasks")
        .update({
          status: "cancelled",
          updated_at: now,
          error_message: "Rejected at approval gate",
        })
        .eq("id", task_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Log
      supabase
        .from("swarm_task_log")
        .insert({
          task_id,
          event: "rejected",
          details: `[${task.project}] Rejected: ${task.title}`,
        })
        .then(() => {});

      // Discord
      if (process.env.DISCORD_WEBHOOK_URL) {
        fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "NEXUS",
            embeds: [{
              title: "Task Rejected",
              description: task.title,
              color: 0xef4444,
              footer: { text: "NEXUS Approval Gate" },
              timestamp: now,
            }],
          }),
        }).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        action: "rejected",
        task_id,
        message: `Task "${task.title}" rejected`,
      });
    }

    // Approve — set status to "approved" so executor picks it up
    const { error } = await supabase
      .from("swarm_tasks")
      .update({
        status: "approved",
        updated_at: now,
      })
      .eq("id", task_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log
    supabase
      .from("swarm_task_log")
      .insert({
        task_id,
        event: "approved",
        details: `[${task.project}] Approved: ${task.title}`,
      })
      .then(() => {});

    // Discord
    if (process.env.DISCORD_WEBHOOK_URL) {
      fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "NEXUS",
          embeds: [{
            title: "Task Approved",
            description: `**${task.title}**\nExecutor will pick it up shortly.`,
            color: 0x10b981,
            footer: { text: "NEXUS Approval Gate" },
            timestamp: now,
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      action: "approved",
      task_id,
      message: `Task "${task.title}" approved — executor will run it next`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
