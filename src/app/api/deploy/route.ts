import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Project → deploy config mapping
const DEPLOY_CONFIG: Record<string, { target: string; dir: string; repo?: string }> = {
  "nexus": { target: "vercel", dir: "nexus", repo: "kjhholt-alt/nexus" },
  "admin-dashboard": { target: "vercel", dir: "admin-dashboard" },
  "ai-finance-brief": { target: "vercel", dir: "ai-finance-brief" },
  "ai-chess-coach": { target: "vercel", dir: "ai-chess-coach" },
  "trade-journal": { target: "vercel", dir: "trade-journal" },
  "buildkit-services": { target: "vercel", dir: "buildkit-services" },
  "pc-bottleneck-analyzer": { target: "vercel", dir: "pc-bottleneck-analyzer" },
  "email-finder-app": { target: "vercel", dir: "email-finder-app" },
  "outdoor-crm": { target: "vercel", dir: "outdoor-crm" },
  "BarrelHouseCRM": { target: "vercel", dir: "BarrelHouseCRM" },
  "MoneyPrinter": { target: "railway", dir: "MoneyPrinter/bot" },
};

/**
 * POST /api/deploy — Trigger a deploy for a project.
 * Body: { project, target?: "vercel" | "railway" }
 *
 * For Vercel: triggers git push (Vercel auto-deploys on push)
 * For Railway: creates a task to run `railway up`
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project } = body;

    if (!project) {
      return NextResponse.json(
        { error: "Missing required field: project" },
        { status: 400 }
      );
    }

    const config = DEPLOY_CONFIG[project];
    const target = body.target || config?.target || "vercel";
    const now = new Date().toISOString();
    const deployId = crypto.randomUUID();

    // Log the deploy as a swarm task
    const { data, error } = await supabase
      .from("swarm_tasks")
      .insert({
        id: deployId,
        title: `Deploy ${project} to ${target}`,
        description: `Automated deploy triggered from Nexus dashboard`,
        project,
        priority: 10,
        status: "queued",
        task_type: "deploy",
        created_at: now,
        updated_at: now,
        retry_count: 0,
        max_retries: 1,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the deploy event
    supabase
      .from("swarm_task_log")
      .insert({
        task_id: deployId,
        event_type: "deploy_triggered",
        title: `Deploy ${project} → ${target}`,
        details: JSON.stringify({
          target,
          dir: config?.dir || project,
          source: "nexus-dashboard",
        }),
        project,
      })
      .then(() => {});

    return NextResponse.json({
      ok: true,
      deploy_id: deployId,
      project,
      target,
      status: "queued",
      message: `Deploy queued: ${project} → ${target}`,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deploy — List recent deploys
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("swarm_tasks")
      .select("*")
      .eq("task_type", "deploy")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deploys: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
