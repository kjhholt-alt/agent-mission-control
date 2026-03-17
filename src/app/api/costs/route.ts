import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/costs — Log a cost entry
 *
 * Body:
 *   project: string
 *   task_id?: string (UUID)
 *   model?: string
 *   tokens_in: number
 *   tokens_out: number
 *   cost_usd: number
 *   operation_type?: string
 *   metadata?: object
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      project,
      task_id,
      model,
      tokens_in,
      tokens_out,
      cost_usd,
      operation_type,
      metadata,
    } = body;

    if (!project || tokens_in === undefined || tokens_out === undefined || cost_usd === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: project, tokens_in, tokens_out, cost_usd" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("cost_tracking")
      .insert({
        project,
        task_id: task_id || null,
        model: model || null,
        tokens_in,
        tokens_out,
        cost_usd,
        operation_type: operation_type || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check budget alerts
    await checkBudgetAlerts(project, cost_usd);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/costs — Query cost data
 *
 * Query params:
 *   project?: string
 *   model?: string
 *   start_date?: ISO date string
 *   end_date?: ISO date string
 *   limit?: number (default 100)
 *   group_by?: 'day' | 'project' | 'model' | 'none' (default 'none')
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const project = url.searchParams.get("project");
    const model = url.searchParams.get("model");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const groupBy = url.searchParams.get("group_by") || "none";

    // For aggregated views, use the pre-built views
    if (groupBy === "day") {
      let query = supabase.from("daily_cost_summary").select("*");
      if (project) query = query.eq("project", project);
      if (model) query = query.eq("model", model);
      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);
      query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ data, aggregation: "daily" });
    }

    if (groupBy === "project") {
      const { data, error } = await supabase
        .from("project_cost_summary")
        .select("*")
        .limit(limit);
      if (error) throw error;
      return NextResponse.json({ data, aggregation: "project" });
    }

    // Raw cost entries
    let query = supabase
      .from("cost_tracking")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (project) query = query.eq("project", project);
    if (model) query = query.eq("model", model);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, error } = await query;
    if (error) throw error;

    // Calculate summary stats
    const totalCost = data?.reduce((sum, entry) => sum + parseFloat(entry.cost_usd || "0"), 0) || 0;
    const totalTokensIn = data?.reduce((sum, entry) => sum + (entry.tokens_in || 0), 0) || 0;
    const totalTokensOut = data?.reduce((sum, entry) => sum + (entry.tokens_out || 0), 0) || 0;

    return NextResponse.json({
      data,
      summary: {
        total_cost_usd: totalCost,
        total_tokens_in: totalTokensIn,
        total_tokens_out: totalTokensOut,
        entry_count: data?.length || 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Check if any budget alerts should be triggered
 */
async function checkBudgetAlerts(project: string, newCost: number) {
  try {
    // Get enabled alerts
    const { data: alerts } = await supabase
      .from("cost_budget_alerts")
      .select("*")
      .eq("enabled", true);

    if (!alerts || alerts.length === 0) return;

    const now = new Date();

    for (const alert of alerts) {
      // Skip if project filter doesn't match
      if (alert.project_filter && alert.project_filter !== project) continue;

      // Calculate period start date
      let startDate: Date;
      if (alert.period === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (alert.period === "weekly") {
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
      } else {
        // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Query total cost for this period
      let query = supabase
        .from("cost_tracking")
        .select("cost_usd")
        .gte("created_at", startDate.toISOString());

      if (alert.project_filter) {
        query = query.eq("project", alert.project_filter);
      }

      const { data: costs } = await query;
      const totalCost = costs?.reduce((sum, c) => sum + parseFloat(c.cost_usd || "0"), 0) || 0;

      // Check threshold
      if (totalCost >= parseFloat(alert.threshold_usd)) {
        // Send Discord notification
        await fetch(process.env.DISCORD_WEBHOOK_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🚨 **Budget Alert: ${alert.name}**\n\n` +
              `**Period:** ${alert.period}\n` +
              `**Threshold:** $${alert.threshold_usd}\n` +
              `**Current Spend:** $${totalCost.toFixed(2)}\n` +
              `**Project:** ${alert.project_filter || "All projects"}\n` +
              `**Latest Cost:** $${newCost.toFixed(4)} from ${project}`,
          }),
        });

        // Update last triggered timestamp
        await supabase
          .from("cost_budget_alerts")
          .update({ last_triggered_at: now.toISOString() })
          .eq("id", alert.id);
      }
    }
  } catch (err) {
    console.error("Error checking budget alerts:", err);
    // Don't throw - we don't want to fail the cost logging request
  }
}
