import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    const now = new Date();

    const seedData = [
      {
        agent_id: `pl-engine-${Date.now()}`,
        agent_name: "PL Engine Optimizer",
        project: "pl-engine",
        status: "running",
        current_step: "Analyzing function complexity in src/core/engine.py",
        steps_completed: 2,
        total_steps: 6,
        output: null,
        started_at: new Date(now.getTime() - 45000).toISOString(),
        updated_at: now.toISOString(),
        completed_at: null,
      },
      {
        agent_id: `email-enricher-${Date.now()}`,
        agent_name: "Email Enricher",
        project: "buildkit-services",
        status: "running",
        current_step:
          "Scanning alpineoutdoor.com — found info@alpineoutdoor.com",
        steps_completed: 127,
        total_steps: 500,
        output: null,
        started_at: new Date(now.getTime() - 120000).toISOString(),
        updated_at: now.toISOString(),
        completed_at: null,
      },
      {
        agent_id: `code-review-${Date.now()}`,
        agent_name: "Code Reviewer",
        project: "ai-finance-brief",
        status: "completed",
        current_step: "Review complete",
        steps_completed: 5,
        total_steps: 5,
        output:
          "Review complete: 2 critical issues, 3 suggestions. Comments posted to PR #23.",
        started_at: new Date(now.getTime() - 300000).toISOString(),
        updated_at: new Date(now.getTime() - 60000).toISOString(),
        completed_at: new Date(now.getTime() - 60000).toISOString(),
      },
      {
        agent_id: `seo-autopilot-${Date.now()}`,
        agent_name: "SEO Autopilot",
        project: "pc-bottleneck-analyzer",
        status: "completed",
        current_step: "Published to /blog/rtx-5070-bottleneck-guide",
        steps_completed: 6,
        total_steps: 6,
        output:
          "Published: 'RTX 5070 Bottleneck Guide' — 2,847 words, 14 internal links.",
        started_at: new Date(now.getTime() - 600000).toISOString(),
        updated_at: new Date(now.getTime() - 180000).toISOString(),
        completed_at: new Date(now.getTime() - 180000).toISOString(),
      },
    ];

    const { data, error } = await supabase
      .from("agent_activity")
      .insert(seedData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Seeded ${data.length} agent activities`,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
