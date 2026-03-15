import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RadiantQuest {
  id: string;
  title: string;
  description: string;
  project: string;
  worker_type: string;
  priority: number;
  category: "health" | "growth" | "maintenance" | "opportunity";
  severity: "critical" | "high" | "medium" | "low";
  auto_goal: string;
}

/**
 * GET /api/radiant — Auto-generate task suggestions from current state.
 * Scans: failed tasks, stale projects, budget status, idle workers.
 */
export async function GET() {
  try {
    const quests: RadiantQuest[] = [];
    const now = new Date();

    // 1. Check for failed tasks that need attention
    const { data: failedTasks } = await supabase
      .from("swarm_tasks")
      .select("id, title, project, error_message, updated_at")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (failedTasks?.length) {
      for (const task of failedTasks) {
        quests.push({
          id: `radiant-failed-${task.id}`,
          title: `Fix failed task: ${task.title}`,
          description: task.error_message || "Task failed without error message",
          project: task.project || "general",
          worker_type: "builder",
          priority: 20,
          category: "health",
          severity: "high",
          auto_goal: `Investigate and fix the failed task: "${task.title}". Error: ${task.error_message || "unknown"}. Review the code, identify the root cause, and fix it.`,
        });
      }
    }

    // 2. Check for stuck/running tasks (>30 min)
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const { data: stuckTasks } = await supabase
      .from("swarm_tasks")
      .select("id, title, project, started_at")
      .eq("status", "running")
      .lt("started_at", thirtyMinAgo)
      .limit(3);

    if (stuckTasks?.length) {
      for (const task of stuckTasks) {
        quests.push({
          id: `radiant-stuck-${task.id}`,
          title: `Stuck task: ${task.title}`,
          description: `Running for over 30 minutes without completion`,
          project: task.project || "general",
          worker_type: "inspector",
          priority: 30,
          category: "health",
          severity: "medium",
          auto_goal: `Check on the stuck task: "${task.title}" in project ${task.project}. It's been running since ${task.started_at}. Investigate if it's truly stuck or just slow, and take appropriate action.`,
        });
      }
    }

    // 3. Check for stale agents (no heartbeat in 2+ hours)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const { data: staleAgents } = await supabase
      .from("agent_activity")
      .select("agent_id, agent_name, project, updated_at")
      .eq("status", "running")
      .lt("updated_at", twoHoursAgo)
      .limit(3);

    if (staleAgents?.length) {
      for (const agent of staleAgents) {
        quests.push({
          id: `radiant-stale-${agent.agent_id}`,
          title: `Stale agent: ${agent.agent_name}`,
          description: `Last heartbeat over 2 hours ago`,
          project: agent.project || "general",
          worker_type: "inspector",
          priority: 25,
          category: "health",
          severity: "high",
          auto_goal: `Agent "${agent.agent_name}" in project ${agent.project} hasn't sent a heartbeat since ${agent.updated_at}. Check if it crashed and needs restart.`,
        });
      }
    }

    // 4. Check daily budget status
    const today = now.toISOString().split("T")[0];
    const { data: budget } = await supabase
      .from("swarm_budgets")
      .select("*")
      .eq("budget_date", today)
      .maybeSingle();

    if (budget) {
      const spentPct = budget.daily_api_budget_cents > 0
        ? (budget.api_spent_cents / budget.daily_api_budget_cents) * 100
        : 0;

      if (spentPct >= 80) {
        quests.push({
          id: "radiant-budget-warning",
          title: `Budget ${Math.round(spentPct)}% spent today`,
          description: `$${(budget.api_spent_cents / 100).toFixed(2)} of $${(budget.daily_api_budget_cents / 100).toFixed(2)} daily budget used`,
          project: "general",
          worker_type: "inspector",
          priority: 15,
          category: "health",
          severity: spentPct >= 100 ? "critical" : "high",
          auto_goal: `Review today's API spend. Budget is ${Math.round(spentPct)}% consumed. Identify which agents/tasks are consuming the most tokens and consider pausing non-critical work.`,
        });
      }
    }

    // 5. Check for queued tasks waiting too long (>1 hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { data: waitingTasks, count: waitingCount } = await supabase
      .from("swarm_tasks")
      .select("id, title, project", { count: "exact" })
      .eq("status", "queued")
      .lt("created_at", oneHourAgo)
      .limit(1);

    if (waitingCount && waitingCount > 0) {
      quests.push({
        id: "radiant-queue-backlog",
        title: `${waitingCount} tasks waiting over 1 hour`,
        description: `Task queue has a backlog — consider spawning more workers`,
        project: waitingTasks?.[0]?.project || "general",
        worker_type: "any",
        priority: 40,
        category: "maintenance",
        severity: waitingCount > 5 ? "high" : "medium",
        auto_goal: `There are ${waitingCount} tasks waiting in the queue for over an hour. Review the queue, prioritize critical tasks, and assign workers.`,
      });
    }

    // 6. Check for projects with no recent activity (>24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSessions } = await supabase
      .from("nexus_sessions")
      .select("project_name")
      .gte("last_activity", oneDayAgo);

    const activeProjects = new Set(
      recentSessions?.map((s) => s.project_name).filter(Boolean) || []
    );

    const knownProjects = [
      "nexus", "MoneyPrinter", "ai-finance-brief", "buildkit-services",
      "pc-bottleneck-analyzer", "outdoor-crm", "BarrelHouseCRM",
    ];

    const dormantProjects = knownProjects.filter((p) => !activeProjects.has(p));
    if (dormantProjects.length > 0 && dormantProjects.length < knownProjects.length) {
      quests.push({
        id: "radiant-dormant-projects",
        title: `${dormantProjects.length} projects idle for 24h+`,
        description: `No sessions recorded for: ${dormantProjects.slice(0, 3).join(", ")}${dormantProjects.length > 3 ? "..." : ""}`,
        project: dormantProjects[0],
        worker_type: "scout",
        priority: 70,
        category: "opportunity",
        severity: "low",
        auto_goal: `Projects with no recent activity: ${dormantProjects.join(", ")}. Run a health check or plan the next feature for one of these projects.`,
      });
    }

    // 7. Cost optimization suggestion
    const { data: expensiveSessions } = await supabase
      .from("nexus_sessions")
      .select("project_name, model, cost_usd")
      .gte("last_activity", oneDayAgo)
      .order("cost_usd", { ascending: false })
      .limit(5);

    const opusSessions = expensiveSessions?.filter((s) =>
      s.model?.includes("opus")
    );
    if (opusSessions && opusSessions.length >= 3) {
      const totalOpusCost = opusSessions.reduce(
        (sum, s) => sum + (parseFloat(s.cost_usd) || 0), 0
      );
      if (totalOpusCost > 5) {
        quests.push({
          id: "radiant-cost-optimize",
          title: `${opusSessions.length} Opus sessions today ($${totalOpusCost.toFixed(2)})`,
          description: `Consider using Sonnet for routine tasks to reduce costs`,
          project: "general",
          worker_type: "inspector",
          priority: 60,
          category: "maintenance",
          severity: "low",
          auto_goal: `Review which tasks are using Opus vs Sonnet. Identify tasks that could use Sonnet without quality loss to reduce API costs.`,
        });
      }
    }

    // Sort by priority (lower = more urgent)
    quests.sort((a, b) => a.priority - b.priority);

    return NextResponse.json({
      quests,
      generated_at: now.toISOString(),
      count: quests.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
