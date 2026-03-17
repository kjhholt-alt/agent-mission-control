"use client";

import { useMemo } from "react";
import type { AgentActivity } from "@/lib/types";
import type { NexusSession } from "@/lib/collector-types";

// ── Props ────────────────────────────────────────────────────────────

interface FleetSidebarProps {
  agents: AgentActivity[];
  sessions: NexusSession[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatElapsed(startStr: string): string {
  const diff = Date.now() - new Date(startStr).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatTokens(input: number, output: number): string {
  const total = input + output;
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M tok`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k tok`;
  return `${total} tok`;
}

function truncate(str: string | null, max: number): string {
  if (!str) return "--";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

/** Extract model shortname for badge display */
function modelBadge(model: string | null): { label: string; color: string } | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes("opus")) return { label: "OPUS", color: "#a78bfa" };
  if (m.includes("sonnet")) return { label: "SONNET", color: "#22d3ee" };
  if (m.includes("haiku")) return { label: "HAIKU", color: "#fbbf24" };
  return { label: model.split("/").pop()?.toUpperCase() ?? "?", color: "#64748b" };
}

function statusDotClass(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "ops-dot-live";
    case "failed":
      return "ops-dot-error";
    default:
      return "ops-dot-idle";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "ops-badge ops-badge-active";
    case "failed":
      return "ops-badge ops-badge-error";
    case "idle":
      return "ops-badge ops-badge-idle";
    case "completed":
      return "ops-badge ops-badge-idle";
    default:
      return "ops-badge ops-badge-idle";
  }
}

// ── Component ────────────────────────────────────────────────────────

export function FleetSidebar({
  agents,
  sessions,
  selectedAgentId,
  onSelectAgent,
}: FleetSidebarProps) {
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions],
  );

  const totalCount = activeSessions.length + agents.length;

  return (
    <div className="ops-panel ops-fleet" style={{ display: "flex", flexDirection: "column" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="ops-panel-header">
        <span>FLEET</span>
        <span className="ops-count">{totalCount}</span>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="ops-panel-body">
        {totalCount === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 120,
              color: "var(--color-ops-text-muted)",
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}
          >
            No active agents
          </div>
        ) : (
          <>
            {/* ── Active Sessions ─────────────────────────────── */}
            {activeSessions.length > 0 && (
              <div>
                <SectionLabel label="SESSIONS" count={activeSessions.length} />
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isSelected={selectedAgentId === session.session_id}
                    onClick={() =>
                      onSelectAgent(
                        selectedAgentId === session.session_id ? null : session.session_id,
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* ── Agent Tasks ─────────────────────────────────── */}
            {agents.length > 0 && (
              <div>
                <SectionLabel label="AGENTS" count={agents.length} />
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgentId === agent.agent_id}
                    onClick={() =>
                      onSelectAgent(
                        selectedAgentId === agent.agent_id ? null : agent.agent_id,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Section Label ────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        padding: "6px 12px 4px",
        fontSize: 9,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--color-ops-text-muted)",
        borderBottom: "1px solid var(--color-ops-border)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        userSelect: "none",
      }}
    >
      {label}
      <span style={{ color: "var(--color-ops-text-dim)", fontWeight: 400 }}>{count}</span>
    </div>
  );
}

// ── Session Card ─────────────────────────────────────────────────────

function SessionCard({
  session,
  isSelected,
  onClick,
}: {
  session: NexusSession;
  isSelected: boolean;
  onClick: () => void;
}) {
  const badge = modelBadge(session.model);
  const progressPct = session.tool_count > 0 ? Math.min(100, session.tool_count * 3) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "6px 10px 6px 12px",
        background: isSelected ? "rgba(34, 211, 238, 0.04)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--color-ops-cyan)" : "2px solid transparent",
        borderTop: "none",
        borderRight: "none",
        borderBottom: "1px solid rgba(26, 34, 53, 0.5)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "monospace",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "var(--color-ops-panel-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Row 1: dot + project + model badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 3,
        }}
      >
        <span className={statusDotClass(session.status)} />
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ops-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {truncate(session.project_name, 16)}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: badge.color,
              background: `${badge.color}15`,
              border: `1px solid ${badge.color}30`,
              padding: "0 4px",
              borderRadius: 2,
              lineHeight: "14px",
            }}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Row 2: current tool + cost */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 3,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 10,
            color: "var(--color-ops-text-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {truncate(session.current_tool, 18)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--color-ops-amber)",
            whiteSpace: "nowrap",
          }}
        >
          {formatCost(session.cost_usd)}
        </span>
      </div>

      {/* Row 3: progress bar + token count */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div className="ops-progress" style={{ flex: 1 }}>
          <div
            className="ops-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span
          style={{
            fontSize: 9,
            color: "var(--color-ops-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {formatTokens(session.input_tokens, session.output_tokens)}
        </span>
      </div>
    </button>
  );
}

// ── Agent Card ───────────────────────────────────────────────────────

function AgentCard({
  agent,
  isSelected,
  onClick,
}: {
  agent: AgentActivity;
  isSelected: boolean;
  onClick: () => void;
}) {
  const progressPct =
    agent.total_steps && agent.total_steps > 0
      ? Math.round((agent.steps_completed / agent.total_steps) * 100)
      : 0;

  const stepsLabel =
    agent.total_steps != null
      ? `${agent.steps_completed}/${agent.total_steps}`
      : `${agent.steps_completed}`;

  const progressFillClass =
    agent.status === "completed"
      ? "ops-progress-fill ops-progress-fill-success"
      : agent.status === "failed"
        ? "ops-progress-fill ops-progress-fill-error"
        : "ops-progress-fill";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "5px 10px 5px 12px",
        background: isSelected ? "rgba(34, 211, 238, 0.04)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--color-ops-cyan)" : "2px solid transparent",
        borderTop: "none",
        borderRight: "none",
        borderBottom: "1px solid rgba(26, 34, 53, 0.5)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "monospace",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "var(--color-ops-panel-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Row 1: dot + name + status badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 2,
        }}
      >
        <span className={statusDotClass(agent.status)} />
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ops-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {truncate(agent.agent_name, 14)}
        </span>
        <span className={statusBadgeClass(agent.status)}>
          {agent.status.toUpperCase()}
        </span>
      </div>

      {/* Row 2: project + steps + elapsed */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 3,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 10,
            color: "var(--color-ops-text-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={agent.current_step ?? undefined}
        >
          {truncate(agent.project, 12)}
        </span>
        <span style={{ fontSize: 9, color: "var(--color-ops-text-dim)", whiteSpace: "nowrap" }}>
          {stepsLabel}
        </span>
        <span style={{ fontSize: 9, color: "var(--color-ops-text-muted)", whiteSpace: "nowrap" }}>
          {formatElapsed(agent.started_at)}
        </span>
      </div>

      {/* Row 3: progress bar */}
      <div className="ops-progress">
        <div
          className={progressFillClass}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </button>
  );
}
