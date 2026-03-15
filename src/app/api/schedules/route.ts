import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("nexus_schedules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, goal, project, worker_type, priority, cron_expression } = body;

  if (!name || !goal || !cron_expression) {
    return NextResponse.json({ error: "Missing name, goal, or cron_expression" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("nexus_schedules")
    .insert({
      name,
      goal,
      project: project || "nexus",
      worker_type: worker_type || "scout",
      priority: priority || 50,
      cron_expression,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedule: data });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("nexus_schedules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
