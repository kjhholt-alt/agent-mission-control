"use client";

import { useMemo, useEffect, useRef } from "react";
import type { AgentActivity } from "@/lib/types";
import type { NexusSession } from "@/lib/collector-types";

// ── Types ─────────────────────────────────────────────────────────────

type EventType =
  | "SPAWN"
  | "DONE"
  | "TOOL"
  | "ERROR"
  | "ALERT"
  | "ACTIVE"
  | "COST"
  | "IDLE";

interface IntelEvent {
  id: string;
  timestamp: string;
  type: EventType;
  message: string;
}

interface IntelFeedProps {
  agents: AgentActivity[];
  sessions: NexusSession[];
}

// ── Constants ─────────────────────────────────────────────────────────

const MAX_EVENTS = 50;

const EVENT_COLORS: Record<EventType, string> = {
  SPAWN: "#22d3ee",
  DONE: "#34d399",
  TOOL: "#3b82f6",
  ERROR: "#f87171",
  ALERT: "#fbbf24",
  ACTIVE: "#a78bfa",
  COST: "#64748b",
  IDLE: "#334155",
};

const DIVIDER_INTERVAL = 10;

// ── Helpers ───────────────────────────────────────────────────────────

/** Format ISO timestamp to HH:MM:SS */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Pad event type to fixed 7-char width */
function padType(type: string): string {
  return type.padEnd(7);
}

/** Truncate long strings */
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

/** Extract short project name from path or full name */
function shortProject(name: string | null): string {
  if (!name) return "unknown";
  // Strip path prefixes, take last segment
  const segments = name.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] || name;
}

/** Format cost milestone text */
function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return `<$0.01`;
}

// ── Event Synthesis ───────────────────────────────────────────────────

function synthesizeEvents(
  agents: AgentActivity[],
  sessions: NexusSession[]
): IntelEvent[] {
  const events: IntelEvent[] = [];

  // ── From agents ──
  for (const agent of agents) {
    const name = truncate(agent.agent_name, 20);
    const project = shortProject(agent.project);

    switch (agent.status) {
      case "running": {
        // SPAWN event from started_at
        events.push({
          id: `agent-spawn-${agent.id}`,
          timestamp: agent.started_at,
          type: "SPAWN",
          message: `${name} deployed to ${project}`,
        });
        // If there's a current step, show progress
        if (agent.current_step) {
          const progress =
            agent.total_steps != null
              ? ` (${agent.steps_completed}/${agent.total_steps})`
              : ` (step ${agent.steps_completed})`;
          events.push({
            id: `agent-step-${agent.id}`,
            timestamp: agent.updated_at,
            type: "TOOL",
            message: `${name} \u2192 ${truncate(agent.current_step, 32)}${progress}`,
          });
        }
        break;
      }
      case "completed": {
        const detail = agent.output
          ? ` (${truncate(agent.output, 36)})`
          : ` (${agent.steps_completed} steps)`;
        events.push({
          id: `agent-done-${agent.id}`,
          timestamp: agent.completed_at ?? agent.updated_at,
          type: "DONE",
          message: `${name} completed${detail}`,
        });
        break;
      }
      case "failed": {
        const errMsg = agent.output
          ? truncate(agent.output, 40)
          : "unknown error";
        events.push({
          id: `agent-err-${agent.id}`,
          timestamp: agent.completed_at ?? agent.updated_at,
          type: "ERROR",
          message: `${name} failed: ${errMsg}`,
        });
        break;
      }
      case "idle": {
        events.push({
          id: `agent-idle-${agent.id}`,
          timestamp: agent.updated_at,
          type: "IDLE",
          message: `${name} idle on ${project}`,
        });
        break;
      }
    }
  }

  // ── From sessions ──
  for (const session of sessions) {
    const project = shortProject(session.project_name);
    const model = session.model
      ? session.model.split("/").pop()?.split("-")[0]?.toUpperCase() ?? ""
      : "";
    const modelTag = model ? ` (${model})` : "";

    switch (session.status) {
      case "active": {
        events.push({
          id: `sess-active-${session.id}`,
          timestamp: session.started_at,
          type: "ACTIVE",
          message: `Session started on ${project}${modelTag}`,
        });

        // TOOL event if currently using a tool
        if (session.current_tool) {
          events.push({
            id: `sess-tool-${session.id}`,
            timestamp: session.last_activity,
            type: "TOOL",
            message: `Session \u2192 ${session.current_tool} on ${project}`,
          });
        }

        // COST milestone events at thresholds
        if (session.cost_usd >= 1.0) {
          events.push({
            id: `sess-cost-high-${session.id}`,
            timestamp: session.last_activity,
            type: "ALERT",
            message: `Budget ${formatCost(session.cost_usd)} on ${project} session`,
          });
        } else if (session.cost_usd >= 0.25) {
          events.push({
            id: `sess-cost-${session.id}`,
            timestamp: session.last_activity,
            type: "COST",
            message: `${formatCost(session.cost_usd)} spent on ${project} session`,
          });
        }
        break;
      }
      case "idle": {
        events.push({
          id: `sess-idle-${session.id}`,
          timestamp: session.last_activity,
          type: "IDLE",
          message: `Session idle on ${project}${modelTag}`,
        });
        break;
      }
      case "completed": {
        events.push({
          id: `sess-done-${session.id}`,
          timestamp: session.last_activity,
          type: "DONE",
          message: `Session closed on ${project} \u2014 ${formatCost(session.cost_usd)}, ${session.tool_count} tools`,
        });
        break;
      }
    }
  }

  // Sort by timestamp ascending (oldest first, newest at bottom)
  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Keep only the last N events
  return events.slice(-MAX_EVENTS);
}

// ── Component ─────────────────────────────────────────────────────────

export function IntelFeed({ agents, sessions }: IntelFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const events = useMemo(
    () => synthesizeEvents(agents, sessions),
    [agents, sessions]
  );

  // Auto-scroll to bottom when events change
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  return (
    <div
      className="ops-panel"
      style={{
        width: 300,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0c1018",
        borderLeft: "1px solid #1a2235",
      }}
    >
      {/* ── Header ── */}
      <div className="ops-panel-header">
        <span
          style={{
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "0.1em",
          }}
        >
          INTEL
        </span>
        <span className="ops-count">{events.length}</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 9,
            color: "#334155",
            letterSpacing: "0.06em",
          }}
        >
          LIVE
        </span>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: events.length > 0 ? "#34d399" : "#334155",
            boxShadow:
              events.length > 0
                ? "0 0 6px rgba(52, 211, 153, 0.5)"
                : "none",
            animation:
              events.length > 0 ? "ops-pulse 2s ease-in-out infinite" : "none",
          }}
        />
      </div>

      {/* ── Feed body ── */}
      <div className="ops-panel-body" ref={bodyRef} style={{ padding: "4px 0" }}>
        {events.length === 0 && (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              color: "#334155",
              letterSpacing: "0.04em",
            }}
          >
            NO INTEL TRAFFIC
            <br />
            <span style={{ fontSize: 9, color: "#1e293b" }}>
              Awaiting agent activity...
            </span>
          </div>
        )}

        {events.map((event, index) => (
          <IntelEntry
            key={event.id}
            event={event}
            showDivider={index > 0 && index % DIVIDER_INTERVAL === 0}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ── Entry Row ─────────────────────────────────────────────────────────

function IntelEntry({
  event,
  showDivider,
}: {
  event: IntelEvent;
  showDivider: boolean;
}) {
  const typeColor = EVENT_COLORS[event.type];

  // Highlight entity names (project names, file paths, agent names)
  // by detecting common patterns and wrapping them
  const highlightedMessage = useMemo(() => {
    return highlightEntities(event.message);
  }, [event.message]);

  return (
    <>
      {showDivider && (
        <div
          style={{
            height: 1,
            background: "#1a2235",
            margin: "4px 8px",
          }}
          aria-hidden="true"
        />
      )}
      <div
        className="ops-enter"
        style={{
          display: "flex",
          alignItems: "flex-start",
          padding: "2px 8px",
          fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          fontSize: 10,
          lineHeight: "16px",
          gap: 0,
          minHeight: 16,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(34, 211, 238, 0.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Timestamp */}
        <span
          style={{
            color: "#334155",
            flexShrink: 0,
            width: 62,
            fontVariantNumeric: "tabular-nums",
            userSelect: "none",
          }}
        >
          {formatTime(event.timestamp)}
        </span>

        {/* Type badge */}
        <span
          style={{
            color: typeColor,
            fontWeight: 700,
            flexShrink: 0,
            width: 56,
            letterSpacing: "0.04em",
            userSelect: "none",
          }}
        >
          {padType(event.type)}
        </span>

        {/* Message */}
        <span
          style={{
            color: "#64748b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {highlightedMessage}
        </span>
      </div>
    </>
  );
}

// ── Entity Highlighter ────────────────────────────────────────────────

/**
 * Highlights project names, file paths, agent names, and key tokens
 * within a message string. Returns JSX with brighter spans for entities.
 */
function highlightEntities(message: string): React.ReactNode {
  // Match file paths (containing / or . with extensions), or tokens after
  // key markers like "on", "to", "->", or parenthesized groups.
  // We split on recognizable entity patterns.
  const entityPattern =
    /(\b[\w.-]+\/[\w./+-]+|[\w-]+\.(?:ts|tsx|js|jsx|py|json|css|md)\b|\$[\d.]+|\b(?:OPUS|SONNET|HAIKU|CLAUDE)\b|\d+\s*(?:steps?|tools?|tests?\s+passed))/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = entityPattern.exec(message)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(message.slice(lastIndex, match.index));
    }
    // The matched entity, rendered brighter
    parts.push(
      <span key={match.index} style={{ color: "#94a3b8" }}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < message.length) {
    parts.push(message.slice(lastIndex));
  }

  return parts.length > 0 ? parts : message;
}
