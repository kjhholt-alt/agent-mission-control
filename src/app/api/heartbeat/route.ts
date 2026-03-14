import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      agent_name,
      project,
      status,
      current_step,
      steps_completed,
      total_steps,
      output,
    } = body;

    if (!agent_id || !agent_name || !project || !status) {
      return NextResponse.json(
        { error: "Missing required fields: agent_id, agent_name, project, status" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const isTerminal = status === "completed" || status === "failed";

    // Upsert by agent_id
    const { data, error } = await supabase
      .from("agent_activity")
      .upsert(
        {
          agent_id,
          agent_name,
          project,
          status,
          current_step: current_step || null,
          steps_completed: steps_completed || 0,
          total_steps: total_steps || null,
          output: output || null,
          updated_at: now,
          ...(isTerminal ? { completed_at: now } : {}),
        },
        { onConflict: "agent_id" }
      )
      .select()
      .single();

    if (error) {
      // If upsert fails (no unique constraint on agent_id), try insert
      const { data: insertData, error: insertError } = await supabase
        .from("agent_activity")
        .insert({
          agent_id,
          agent_name,
          project,
          status,
          current_step: current_step || null,
          steps_completed: steps_completed || 0,
          total_steps: total_steps || null,
          output: output || null,
          started_at: now,
          updated_at: now,
          ...(isTerminal ? { completed_at: now } : {}),
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, data: insertData });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
