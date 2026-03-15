import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Building ID → project key mapping
const BUILDING_TO_PROJECT: Record<string, string> = {
  "command-center": "nexus",
  "buildkit": "buildkit-services",
  "email-finder": "email-finder",
  "barrelhouse": "BarrelHouseCRM",
  "pc-bottleneck": "pc-bottleneck-analyzer",
  "outdoor-crm": "outdoor-crm",
  "chess-academy": "ai-chess-coach",
  "finance-brief": "ai-finance-brief",
  "automation-hub": "automation-playground",
  "pl-engine": "pl-engine",
  "mcp-array": "mcp-servers",
  "nexus-hq": "nexus",
};

export async function GET(req: NextRequest) {
  const buildingId = req.nextUrl.searchParams.get("building");
  const workerId = req.nextUrl.searchParams.get("worker");

  if (!buildingId && !workerId) {
    return NextResponse.json({ error: "building or worker param required" }, { status: 400 });
  }

  try {
    if (workerId) {
      // Fetch tasks for a specific worker
      const [tasksRes, statsRes] = await Promise.all([
        sb
          .from("swarm_tasks")
          .select("id, title, status, task_type, completed_at, updated_at")
          .eq("assigned_worker_id", workerId)
          .order("updated_at", { ascending: false })
          .limit(5),
        sb
          .from("swarm_tasks")
          .select("status")
          .eq("assigned_worker_id", workerId),
      ]);

      const tasks = tasksRes.data ?? [];
      const allTasks = statsRes.data ?? [];
      const completed = allTasks.filter((t) => t.status === "completed").length;
      const failed = allTasks.filter((t) => t.status === "failed").length;

      return NextResponse.json({ tasks, stats: { completed, failed, total: allTasks.length } });
    }

    // Fetch tasks for a building/project
    const projectKey = BUILDING_TO_PROJECT[buildingId!] ?? buildingId;

    const [tasksRes, statsRes] = await Promise.all([
      sb
        .from("swarm_tasks")
        .select("id, title, status, task_type, completed_at, updated_at")
        .eq("project", projectKey)
        .order("updated_at", { ascending: false })
        .limit(5),
      sb
        .from("swarm_tasks")
        .select("status")
        .eq("project", projectKey),
    ]);

    const tasks = tasksRes.data ?? [];
    const allTasks = statsRes.data ?? [];
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const failed = allTasks.filter((t) => t.status === "failed").length;
    const lastActivity = tasks.length > 0 ? tasks[0].updated_at : null;

    return NextResponse.json({ tasks, stats: { completed, failed, total: allTasks.length, lastActivity } });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
