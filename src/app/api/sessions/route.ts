import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const project = searchParams.get("project");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("nexus_sessions")
      .select("*", { count: "exact" })
      .order("last_activity", { ascending: false })
      .range(offset, offset + limit - 1);

    if (project) {
      query = query.eq("project_name", project);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate cost totals
    const totalCost = data?.reduce(
      (sum, s) => sum + (parseFloat(s.cost_usd) || 0),
      0
    ) || 0;
    const totalInput = data?.reduce(
      (sum, s) => sum + (s.input_tokens || 0),
      0
    ) || 0;
    const totalOutput = data?.reduce(
      (sum, s) => sum + (s.output_tokens || 0),
      0
    ) || 0;

    return NextResponse.json({
      sessions: data || [],
      total: count || 0,
      aggregates: {
        total_cost: totalCost,
        total_input_tokens: totalInput,
        total_output_tokens: totalOutput,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
