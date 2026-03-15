import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Active sessions (last activity within 10 minutes)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from("nexus_sessions")
      .select("*")
      .or(`status.eq.active,last_activity.gte.${tenMinAgo}`)
      .order("last_activity", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate stats
    const active = sessions?.filter((s) => s.status === "active") || [];
    const totalCost = sessions?.reduce(
      (sum, s) => sum + (parseFloat(s.cost_usd) || 0),
      0
    );
    const totalTools = sessions?.reduce(
      (sum, s) => sum + (s.tool_count || 0),
      0
    );

    return NextResponse.json({
      sessions: sessions || [],
      stats: {
        active_count: active.length,
        total_sessions: sessions?.length || 0,
        total_cost: totalCost,
        total_tools: totalTools,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
