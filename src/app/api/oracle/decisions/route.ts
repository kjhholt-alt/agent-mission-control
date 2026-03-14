import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

// GET: List pending decisions
export async function GET() {
  const sb = getSupabase();

  try {
    const { data, error } = await sb
      .from("oracle_decisions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Also pull in live decisions from failed tasks / stuck tasks that
    // may not have been persisted yet
    const now = new Date();
    const thirtyMinAgo = new Date(
      now.getTime() - 30 * 60 * 1000
    ).toISOString();
    const dayStart = new Date(now.toISOString().split("T")[0]).toISOString();

    const [failedRes, stuckRes] = await Promise.all([
      sb
        .from("swarm_tasks")
        .select(
          "id, title, project, error_message, retry_count, max_retries, completed_at"
        )
        .eq("status", "failed")
        .gte("completed_at", dayStart)
        .order("completed_at", { ascending: false })
        .limit(20),
      sb
        .from("swarm_tasks")
        .select("id, title, project, started_at")
        .eq("status", "running")
        .lt("started_at", thirtyMinAgo),
    ]);

    // Check budget
    const today = now.toISOString().split("T")[0];
    const { data: budgetData } = await sb
      .from("swarm_budgets")
      .select("*")
      .eq("budget_date", today)
      .limit(1);

    const budgetRow = budgetData?.[0];

    // Merge persisted decisions with live-detected ones
    const existingTitles = new Set((data || []).map((d) => d.title));
    const liveDecisions: Array<Record<string, unknown>> = [];

    // Failed tasks with max retries
    for (const task of failedRes.data || []) {
      if ((task.retry_count || 0) >= (task.max_retries || 3)) {
        const title = `Task failed ${task.retry_count}x: ${task.title}`;
        if (!existingTitles.has(title)) {
          liveDecisions.push({
            id: `live-failed-${task.id}`,
            title,
            description: (task.error_message || "No error recorded").slice(
              0,
              200
            ),
            severity: "high",
            project: task.project || "unknown",
            action_needed: "retry, redirect, dismiss",
            source_type: "failed_task",
            source_id: task.id,
            status: "pending",
            created_at: task.completed_at || now.toISOString(),
          });
        }
      }
    }

    // Stuck tasks
    for (const task of stuckRes.data || []) {
      const title = `Task stuck: ${task.title}`;
      if (!existingTitles.has(title)) {
        liveDecisions.push({
          id: `live-stuck-${task.id}`,
          title,
          description: `Running since ${task.started_at || "unknown"} in ${task.project || "unknown"}`,
          severity: "medium",
          project: task.project || "unknown",
          action_needed: "retry, cancel, dismiss",
          source_type: "stuck_task",
          source_id: task.id,
          status: "pending",
          created_at: task.started_at || now.toISOString(),
        });
      }
    }

    // Budget alert
    if (budgetRow) {
      const pct =
        budgetRow.daily_api_budget_cents > 0
          ? Math.round(
              ((budgetRow.api_spent_cents || 0) /
                budgetRow.daily_api_budget_cents) *
                100
            )
          : 0;
      if (pct >= 80) {
        const title = `API budget at ${pct}%`;
        if (!existingTitles.has(title)) {
          liveDecisions.push({
            id: `live-budget-${today}`,
            title,
            description: `$${((budgetRow.api_spent_cents || 0) / 100).toFixed(2)} / $${(budgetRow.daily_api_budget_cents / 100).toFixed(2)} spent today`,
            severity: pct >= 95 ? "critical" : "high",
            project: "nexus",
            action_needed: "increase_budget, pause_workers, dismiss",
            source_type: "budget_alert",
            source_id: null,
            status: "pending",
            created_at: now.toISOString(),
          });
        }
      }
    }

    const allDecisions = [...(data || []), ...liveDecisions].sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime()
    );

    return NextResponse.json({ decisions: allDecisions });
  } catch (error) {
    console.error("Decisions API GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch decisions" },
      { status: 500 }
    );
  }
}

// POST: Take action on a decision
export async function POST(request: Request) {
  const sb = getSupabase();

  try {
    const body = await request.json();
    const {
      decision_id,
      action,
      redirect_prompt,
    }: {
      decision_id: string;
      action: "approve" | "dismiss" | "redirect";
      redirect_prompt?: string;
    } = body;

    if (!decision_id || !action) {
      return NextResponse.json(
        { error: "decision_id and action are required" },
        { status: 400 }
      );
    }

    const isLive = decision_id.startsWith("live-");
    const now = new Date().toISOString();

    // Update the decision record if it exists in the table
    if (!isLive) {
      const { error: updateError } = await sb
        .from("oracle_decisions")
        .update({
          status: action === "redirect" ? "redirected" : action === "approve" ? "approved" : "dismissed",
          resolved_at: now,
          resolved_action: action === "redirect" ? `Redirected: ${redirect_prompt}` : action,
        })
        .eq("id", decision_id);

      if (updateError) {
        console.error("Failed to update decision:", updateError);
      }
    }

    // For live decisions, extract the source task ID
    const sourceTaskId = isLive
      ? decision_id.replace(/^live-(failed|stuck|budget)-/, "")
      : null;

    // Handle each action type
    if (action === "approve") {
      // For failed/stuck tasks: retry them by resetting status to queued
      if (sourceTaskId && !decision_id.startsWith("live-budget")) {
        // Get the decision to find the source task
        let taskId = sourceTaskId;
        if (!isLive) {
          const { data: decisionData } = await sb
            .from("oracle_decisions")
            .select("source_id")
            .eq("id", decision_id)
            .single();
          taskId = decisionData?.source_id || taskId;
        }

        if (taskId) {
          await sb
            .from("swarm_tasks")
            .update({
              status: "queued",
              error_message: null,
              assigned_worker_id: null,
              started_at: null,
              completed_at: null,
            })
            .eq("id", taskId);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Decision approved. Task re-queued.",
      });
    }

    if (action === "dismiss") {
      // For tasks: cancel them
      if (sourceTaskId && !decision_id.startsWith("live-budget")) {
        let taskId = sourceTaskId;
        if (!isLive) {
          const { data: decisionData } = await sb
            .from("oracle_decisions")
            .select("source_id")
            .eq("id", decision_id)
            .single();
          taskId = decisionData?.source_id || taskId;
        }

        if (taskId) {
          await sb
            .from("swarm_tasks")
            .update({ status: "cancelled" })
            .eq("id", taskId);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Decision dismissed.",
      });
    }

    if (action === "redirect") {
      if (!redirect_prompt) {
        return NextResponse.json(
          { error: "redirect_prompt is required for redirect action" },
          { status: 400 }
        );
      }

      // Create a new task with the redirect instructions
      let project = "nexus";
      if (!isLive) {
        const { data: decisionData } = await sb
          .from("oracle_decisions")
          .select("project, source_id")
          .eq("id", decision_id)
          .single();
        project = decisionData?.project || project;

        // Cancel the old task
        if (decisionData?.source_id) {
          await sb
            .from("swarm_tasks")
            .update({ status: "cancelled" })
            .eq("id", decisionData.source_id);
        }
      } else if (sourceTaskId) {
        const { data: taskData } = await sb
          .from("swarm_tasks")
          .select("project")
          .eq("id", sourceTaskId)
          .single();
        project = taskData?.project || project;

        await sb
          .from("swarm_tasks")
          .update({ status: "cancelled" })
          .eq("id", sourceTaskId);
      }

      // Create new redirected task
      const { data: newTask, error: insertError } = await sb
        .from("swarm_tasks")
        .insert({
          task_type: "build",
          title: `[Redirected] ${redirect_prompt.slice(0, 100)}`,
          description: redirect_prompt,
          project,
          status: "queued",
          priority: 1,
          cost_tier: "heavy",
          max_retries: 3,
          retry_count: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to create redirected task:", insertError);
        return NextResponse.json(
          { error: "Failed to create redirected task" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Decision redirected. New task created.",
        new_task_id: newTask?.id,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Decisions API POST error:", error);
    return NextResponse.json(
      { error: "Failed to process decision action" },
      { status: 500 }
    );
  }
}
