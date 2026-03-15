import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateCost } from "@/lib/pricing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function deriveProjectName(workspacePath?: string): string | null {
  if (!workspacePath) return null;
  const parts = workspacePath.replace(/\\/g, "/").split("/");
  const projIdx = parts.findIndex((p) => p.toLowerCase() === "projects");
  if (projIdx >= 0 && projIdx + 1 < parts.length) return parts[projIdx + 1];
  return parts.filter(Boolean).pop() || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both Nexus format AND raw Claude Code hook format
    // Claude Code sends: { session_id, event/hook_event_name, tool_name/tool.name, cwd, model }
    // Nexus expects:     { session_id, event_type, tool_name, workspace_path, model }
    const session_id = body.session_id;
    const event_type =
      body.event_type ||
      body.event ||
      body.hook_event_name ||
      null;
    const tool_name =
      body.tool_name ||
      body.tool?.name ||
      null;
    const workspace_path =
      body.workspace_path ||
      body.cwd ||
      null;
    const model = body.model || null;

    if (!session_id || !event_type) {
      return NextResponse.json(
        { error: "Missing session_id or event_type" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const projectName =
      body.project_name || deriveProjectName(workspace_path);

    // Log the hook event (fire-and-forget)
    supabase
      .from("nexus_hook_events")
      .insert({
        session_id,
        event_type,
        tool_name,
        project_name: projectName,
        model,
      })
      .then(() => {});

    // Build base session fields
    const baseSession = {
      session_id,
      project_name: projectName,
      workspace_path: workspace_path || null,
      model: model || null,
      last_activity: now,
    };

    if (event_type === "Stop") {
      // Session ended — record final token usage + cost
      const inputTokens = body.input_tokens || 0;
      const outputTokens = body.output_tokens || 0;
      const cacheRead = body.cache_read_tokens || 0;
      const cacheWrite = body.cache_write_tokens || 0;
      const cost = calculateCost(
        model || "claude-sonnet-4-6",
        inputTokens,
        outputTokens,
        cacheWrite,
        cacheRead
      );

      await supabase.from("nexus_sessions").upsert(
        {
          ...baseSession,
          status: "completed",
          completed_at: now,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheRead,
          cache_write_tokens: cacheWrite,
          cost_usd: cost,
          current_tool: null,
        },
        { onConflict: "session_id" }
      );
    } else if (event_type === "PreToolUse") {
      // Tool starting — mark session active, track current tool
      const { data: existing } = await supabase
        .from("nexus_sessions")
        .select("tool_count")
        .eq("session_id", session_id)
        .maybeSingle();

      await supabase.from("nexus_sessions").upsert(
        {
          ...baseSession,
          status: "active",
          current_tool: tool_name,
          tool_count: (existing?.tool_count || 0) + 1,
        },
        { onConflict: "session_id" }
      );
    } else {
      // PostToolUse, Notification, SubagentStart/Stop — update last activity
      await supabase.from("nexus_sessions").upsert(
        {
          ...baseSession,
          status: "active",
          current_tool: null,
        },
        { onConflict: "session_id" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
