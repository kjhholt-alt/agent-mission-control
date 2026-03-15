import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/workflows/run — Execute a workflow by creating chained tasks.
 *
 * Body: { steps: WorkflowStep[], workflow_name: string }
 *
 * Creates swarm_tasks for each step. Steps with use_previous_output=true
 * get depends_on set to the previous step's task_id so the orchestrator
 * chains them.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { steps, workflow_name, workflow_id } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty steps array" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const runId = crypto.randomUUID();
    const taskIds: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const taskId = crypto.randomUUID();
      taskIds.push(taskId);

      // Build the goal — prepend context about the workflow
      let goal = step.goal;
      if (i === 0) {
        goal = `[Workflow: ${workflow_name} — Step ${i + 1}/${steps.length}]\n\n${goal}`;
      } else {
        goal = `[Workflow: ${workflow_name} — Step ${i + 1}/${steps.length}]\n\nPrevious step output will be provided as context.\n\n${goal}`;
      }

      const task: Record<string, unknown> = {
        id: taskId,
        title: `[${workflow_name}] ${step.template_name || `Step ${i + 1}`}`,
        description: goal,
        project: step.project || "nexus",
        priority: step.priority || 50,
        status: i === 0 ? "queued" : "blocked",
        task_type: step.worker_type || "eval",
        cost_tier: "cc_light",
        created_at: now,
        updated_at: now,
        retry_count: 0,
        max_retries: 2,
      };

      // Chain dependency: each step depends on the previous
      if (i > 0 && step.use_previous_output) {
        task.depends_on = [taskIds[i - 1]];
        task.parent_task_id = taskIds[i - 1];
      } else if (i > 0) {
        // Still wait for previous even if not using output
        task.depends_on = [taskIds[i - 1]];
      }

      const { error } = await supabase
        .from("swarm_tasks")
        .insert(task);

      if (error) {
        return NextResponse.json(
          { error: `Failed to create step ${i + 1}: ${error.message}` },
          { status: 500 }
        );
      }

      // Log the step creation
      supabase
        .from("swarm_task_log")
        .insert({
          task_id: taskId,
          event: "workflow_step",
          details: `[${step.project}] Workflow "${workflow_name}" step ${i + 1}/${steps.length}: ${step.template_name}`,
        })
        .then(() => {});
    }

    // Discord notification
    if (process.env.DISCORD_WEBHOOK_URL) {
      fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "NEXUS",
          embeds: [{
            title: `Workflow Started: ${workflow_name}`,
            description: `${steps.length} steps queued`,
            color: 0x8b5cf6,
            footer: { text: "NEXUS Workflows" },
            timestamp: now,
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      run_id: runId,
      workflow_name,
      task_ids: taskIds,
      steps_created: steps.length,
      message: `Workflow "${workflow_name}" started with ${steps.length} steps`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
