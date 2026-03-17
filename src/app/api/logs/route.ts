import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface LogEntry {
  id: string;
  created_at: string;
  task_id?: string;
  session_id?: string;
  event: string;
  details: string;
  project?: string;
  severity?: string;
  source: "task_log" | "hook_events" | "sessions";
}

/**
 * GET /api/logs — Unified log query across swarm_task_log, nexus_hook_events, and nexus_sessions
 *
 * Query params:
 *   project   — filter by project name
 *   severity  — filter by severity (info, warn, error)
 *   search    — text search in details
 *   start     — start date (ISO format)
 *   end       — end date (ISO format)
 *   limit     — max results (default 100, max 500)
 *   offset    — pagination offset (default 0)
 *   source    — filter by log source (task_log, hook_events, sessions)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const project = url.searchParams.get("project");
    const severity = url.searchParams.get("severity");
    const search = url.searchParams.get("search");
    const startDate = url.searchParams.get("start");
    const endDate = url.searchParams.get("end");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sourceFilter = url.searchParams.get("source");

    const logs: LogEntry[] = [];

    // Query swarm_task_log
    if (!sourceFilter || sourceFilter === "task_log") {
      let taskLogQuery = supabase
        .from("swarm_task_log")
        .select("*")
        .order("created_at", { ascending: false });

      if (startDate) taskLogQuery = taskLogQuery.gte("created_at", startDate);
      if (endDate) taskLogQuery = taskLogQuery.lte("created_at", endDate);

      const { data: taskLogs } = await taskLogQuery;

      if (taskLogs) {
        logs.push(
          ...taskLogs.map((log: any) => {
            // Extract project from details if present
            const projectMatch = log.details?.match(/^\[([^\]]+)\]/);
            const logProject = projectMatch ? projectMatch[1] : "";

            // Infer severity from event type
            let logSeverity = "info";
            if (log.event.includes("error") || log.event.includes("fail")) {
              logSeverity = "error";
            } else if (
              log.event.includes("warn") ||
              log.event.includes("approval") ||
              log.event.includes("blocked")
            ) {
              logSeverity = "warn";
            }

            return {
              id: log.id,
              created_at: log.created_at,
              task_id: log.task_id,
              event: log.event,
              details: log.details || "",
              project: logProject,
              severity: logSeverity,
              source: "task_log" as const,
            };
          })
        );
      }
    }

    // Query nexus_hook_events
    if (!sourceFilter || sourceFilter === "hook_events") {
      let hookQuery = supabase
        .from("nexus_hook_events")
        .select("*")
        .order("timestamp", { ascending: false });

      if (startDate) hookQuery = hookQuery.gte("timestamp", startDate);
      if (endDate) hookQuery = hookQuery.lte("timestamp", endDate);

      const { data: hookEvents } = await hookQuery;

      if (hookEvents) {
        logs.push(
          ...hookEvents.map((log: any) => ({
            id: log.id,
            created_at: log.timestamp,
            session_id: log.session_id,
            event: log.tool_name || "unknown",
            details: JSON.stringify(log.result || {}),
            project: log.working_directory?.split("/").pop() || "",
            severity: log.error ? "error" : "info",
            source: "hook_events" as const,
          }))
        );
      }
    }

    // Query nexus_sessions for session-level events
    if (!sourceFilter || sourceFilter === "sessions") {
      let sessionQuery = supabase
        .from("nexus_sessions")
        .select("*")
        .order("started_at", { ascending: false });

      if (startDate) sessionQuery = sessionQuery.gte("started_at", startDate);
      if (endDate) sessionQuery = sessionQuery.lte("started_at", endDate);

      const { data: sessions } = await sessionQuery;

      if (sessions) {
        logs.push(
          ...sessions.map((session: any) => ({
            id: session.id,
            created_at: session.started_at,
            session_id: session.id,
            event: session.status || "session",
            details: `Session: ${session.working_directory}`,
            project: session.working_directory?.split("/").pop() || "",
            severity: session.status === "error" ? "error" : "info",
            source: "sessions" as const,
          }))
        );
      }
    }

    // Sort all logs by timestamp descending
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply filters
    let filtered = logs;

    if (project) {
      filtered = filtered.filter((log) => log.project?.toLowerCase().includes(project.toLowerCase()));
    }

    if (severity) {
      filtered = filtered.filter((log) => log.severity === severity);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.details.toLowerCase().includes(searchLower) ||
          log.event.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    // Build aggregates
    const severityCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    for (const log of filtered) {
      severityCounts[log.severity || "info"] = (severityCounts[log.severity || "info"] || 0) + 1;
      if (log.project) {
        projectCounts[log.project] = (projectCounts[log.project] || 0) + 1;
      }
      sourceCounts[log.source] = (sourceCounts[log.source] || 0) + 1;
    }

    return NextResponse.json({
      logs: paginated,
      total: filtered.length,
      limit,
      offset,
      aggregates: {
        by_severity: severityCounts,
        by_project: projectCounts,
        by_source: sourceCounts,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
