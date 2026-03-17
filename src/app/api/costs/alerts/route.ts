import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/costs/alerts — List budget alerts
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("cost_budget_alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/costs/alerts — Create a budget alert
 *
 * Body:
 *   name: string
 *   threshold_usd: number
 *   period: 'daily' | 'weekly' | 'monthly'
 *   project_filter?: string
 *   enabled?: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, threshold_usd, period, project_filter, enabled } = body;

    if (!name || !threshold_usd || !period) {
      return NextResponse.json(
        { error: "Missing required fields: name, threshold_usd, period" },
        { status: 400 }
      );
    }

    if (!["daily", "weekly", "monthly"].includes(period)) {
      return NextResponse.json(
        { error: "Invalid period. Must be: daily, weekly, or monthly" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("cost_budget_alerts")
      .insert({
        name,
        threshold_usd,
        period,
        project_filter: project_filter || null,
        enabled: enabled !== undefined ? enabled : true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/costs/alerts?id=<uuid> — Delete a budget alert
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const { error } = await supabase
      .from("cost_budget_alerts")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
