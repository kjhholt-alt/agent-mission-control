"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { AgentActivity } from "@/lib/types";
import type { NexusSession } from "@/lib/collector-types";

// ── Props ────────────────────────────────────────────────────────────

interface ParallelOpsProps {
  agents: AgentActivity[];
  sessions: NexusSession[];
  selectedAgentId: string | null;
}

// ── Unified operation type ───────────────────────────────────────────

type OpStatus = "running" | "completed" | "failed" | "idle";

interface UnifiedOp {
  id: string;
  kind: "agent" | "session";
  name: string;
  project: string;
  model: string | null;
  status: OpStatus;
  currentAction: string | null;
  outputLines: string[];
  stepsCompleted: number;
  totalSteps: number | null;
  startedAt: string;
  costUsd: number;
  tokens: number;
  toolCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return v % 1 === 0 ? `${v}M` : `${v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return v % 1 === 0 ? `${v}K` : `${v.toFixed(1)}K`;
  }
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function mapSessionStatus(s: "active" | "idle" | "completed"): OpStatus {
  if (s === "active") return "running";
  if (s === "idle") return "idle";
  return "completed";
}

function friendlyTool(tool: string | null): string {
  if (!tool) return "Thinking...";
  const map: Record<string, string> = {
    Read: "Reading file",
    Edit: "Editing file",
    Write: "Writing file",
    Bash: "Running command",
    Grep: "Searching codebase",
    Glob: "Finding files",
    WebFetch: "Fetching URL",
    WebSearch: "Searching web",
  };
  return map[tool] ?? tool;
}

// ── Elapsed time hook ────────────────────────────────────────────────

function useElapsedSeconds(startedAt: string): string {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startedAt).getTime();
  const diff = Math.max(0, Math.floor((now - start) / 1000));

  if (diff >= 3600) {
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// ── Sweep keyframes (injected once) ─────────────────────────────────

const SWEEP_STYLE_ID = "ops-sweep-keyframes";

function ensureSweepKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SWEEP_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SWEEP_STYLE_ID;
  style.textContent = `
@keyframes ops-sweep {
  0%   { background-position: -200% top; }
  100% { background-position: 200% top;  }
}
@keyframes ops-fade-line {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;
  document.head.appendChild(style);
}

// ── Sub-components ───────────────────────────────────────────────────

function ElapsedBadge({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <span
      style={{
        color: "#64748b",
        fontSize: 10,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 500,
      }}
    >
      {elapsed}
    </span>
  );
}

function StatusDot({ status }: { status: OpStatus }) {
  if (status === "running") return <div className="ops-dot-live" />;
  if (status === "failed") return <div className="ops-dot-error" />;
  if (status === "completed") {
    return (
      <span style={{ color: "#34d399", fontSize: 11, lineHeight: 1 }}>
        &#10003;
      </span>
    );
  }
  return <div className="ops-dot-idle" />;
}

function ProgressBar({
  completed,
  total,
  status,
}: {
  completed: number;
  total: number | null;
  status: OpStatus;
}) {
  const pct =
    total && total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  if (!total || total <= 0) return null;

  const fillClass =
    status === "completed"
      ? "ops-progress-fill ops-progress-fill-success"
      : status === "failed"
        ? "ops-progress-fill ops-progress-fill-error"
        : "ops-progress-fill";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <div className="ops-progress" style={{ flex: 1 }}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
      </div>
      <span
        style={{
          color: "#64748b",
          fontSize: 10,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          minWidth: 30,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Operation card ───────────────────────────────────────────────────

function OpCard({
  op,
  isSelected,
}: {
  op: UnifiedOp;
  isSelected: boolean;
}) {
  const isRunning = op.status === "running";
  const isFailed = op.status === "failed";
  const isCompleted = op.status === "completed";

  // Build the action stream: current action + output lines
  const actionLines = useMemo(() => {
    const lines: { text: string; isCurrent: boolean }[] = [];
    if (op.currentAction) {
      lines.push({ text: op.currentAction, isCurrent: true });
    }
    // Show last 4 output lines (excluding current action if it duplicates)
    const outputToShow = op.outputLines
      .filter((l) => l !== op.currentAction)
      .slice(-4);
    for (const line of outputToShow) {
      lines.push({ text: line, isCurrent: false });
    }
    return lines;
  }, [op.currentAction, op.outputLines]);

  // Model display: shorten common model names
  const modelLabel = useMemo(() => {
    if (!op.model) return null;
    const m = op.model.toLowerCase();
    if (m.includes("opus")) return "Opus";
    if (m.includes("sonnet")) return "Sonnet";
    if (m.includes("haiku")) return "Haiku";
    // Trim provider prefix
    if (m.includes("/")) return op.model.split("/").pop() ?? op.model;
    return op.model;
  }, [op.model]);

  return (
    <div
      className="ops-enter"
      style={{
        background: "#0c1018",
        border: "1px solid #1a2235",
        borderLeft: isSelected ? "2px solid #22d3ee" : "1px solid #1a2235",
        borderRadius: 4,
        overflow: "hidden",
        position: "relative",
        // Sweep gradient for running cards
        ...(isRunning
          ? {
              backgroundImage:
                "linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent)",
              backgroundSize: "200% 2px",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "top",
              animation: "ops-sweep 3s ease-in-out infinite",
            }
          : {}),
        // Subtle glow for selected
        ...(isSelected
          ? {
              boxShadow:
                "inset 0 0 12px rgba(34,211,238,0.05), 0 0 8px rgba(34,211,238,0.03)",
            }
          : {}),
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* ── Card header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 10px 6px",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <StatusDot status={op.status} />
          <span
            style={{
              color: "#e2e8f0",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {op.project || op.name}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {modelLabel && (
            <span
              style={{
                color: "#64748b",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {modelLabel}
            </span>
          )}
          <ElapsedBadge startedAt={op.startedAt} />
        </div>
      </div>

      {/* ── Thin separator ── */}
      <div
        style={{
          height: 1,
          background: isRunning
            ? "linear-gradient(90deg, transparent 0%, #1e3a5f 50%, transparent 100%)"
            : "#1a2235",
          margin: "0 10px",
        }}
      />

      {/* ── Action stream (the money shot) ── */}
      <div
        style={{
          padding: "8px 10px 4px",
          minHeight: 56,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {actionLines.length === 0 && isRunning && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "#334155", fontSize: 10 }}>&gt;</span>
            <span style={{ color: "#22d3ee", fontSize: 10 }}>
              Initializing...
            </span>
            <span className="ops-cursor" />
          </div>
        )}
        {actionLines.length === 0 && !isRunning && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "#334155", fontSize: 10 }}>&gt;</span>
            <span style={{ color: "#64748b", fontSize: 10 }}>
              {isCompleted ? "Completed" : isFailed ? "Failed" : "Idle"}
            </span>
          </div>
        )}
        {actionLines.map((line, i) => (
          <div
            key={`${i}-${line.text.slice(0, 20)}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 4,
              animation: "ops-fade-line 0.25s ease-out",
            }}
          >
            <span
              style={{
                color: "#1e293b",
                fontSize: 10,
                lineHeight: "15px",
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              &gt;
            </span>
            <span
              style={{
                color: line.isCurrent ? "#22d3ee" : "#475569",
                fontSize: 10,
                lineHeight: "15px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {line.text}
            </span>
            {line.isCurrent && isRunning && (
              <span className="ops-cursor" style={{ flexShrink: 0 }} />
            )}
          </div>
        ))}

        {/* ── Stats line ── */}
        {(op.tokens > 0 || op.costUsd > 0 || op.toolCount > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <span style={{ color: "#1e293b", fontSize: 10 }}>&gt;</span>
            <span style={{ color: "#334155", fontSize: 9 }}>
              {op.tokens > 0 && (
                <span>{formatTokens(op.tokens)} tokens</span>
              )}
              {op.tokens > 0 && op.costUsd > 0 && (
                <span style={{ margin: "0 3px" }}>&middot;</span>
              )}
              {op.costUsd > 0 && <span>{formatCost(op.costUsd)}</span>}
              {op.toolCount > 0 && (
                <>
                  <span style={{ margin: "0 3px" }}>&middot;</span>
                  <span>{op.toolCount} tools</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div style={{ padding: "0 10px 8px" }}>
        <ProgressBar
          completed={op.stepsCompleted}
          total={op.totalSteps}
          status={op.status}
        />
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 32,
      }}
    >
      <pre
        style={{
          color: "#334155",
          fontSize: 11,
          lineHeight: 1.6,
          textAlign: "center",
          fontFamily: "inherit",
          userSelect: "none",
        }}
      >
        {[
          "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557",
          "\u2551     ALL SYSTEMS NOMINAL     \u2551",
          "\u2551                              \u2551",
          "\u2551  No active operations       \u2551",
          "\u2551  Press Ctrl+K to deploy     \u2551",
          "\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D",
        ].join("\n")}
      </pre>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function ParallelOps({
  agents,
  sessions,
  selectedAgentId,
}: ParallelOpsProps) {
  // Inject keyframes on mount
  useEffect(() => {
    ensureSweepKeyframes();
  }, []);

  // Merge agents + sessions into unified operations list
  const operations: UnifiedOp[] = useMemo(() => {
    const ops: UnifiedOp[] = [];

    for (const a of agents) {
      const outputLines = a.output
        ? a.output
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [];
      ops.push({
        id: a.id,
        kind: "agent",
        name: a.agent_name,
        project: a.project,
        model: null,
        status: a.status,
        currentAction: a.current_step,
        outputLines,
        stepsCompleted: a.steps_completed,
        totalSteps: a.total_steps,
        startedAt: a.started_at,
        costUsd: 0,
        tokens: 0,
        toolCount: 0,
      });
    }

    for (const s of sessions) {
      ops.push({
        id: s.id,
        kind: "session",
        name: s.session_id,
        project: s.project_name ?? "unknown",
        model: s.model,
        status: mapSessionStatus(s.status),
        currentAction: friendlyTool(s.current_tool),
        outputLines: [],
        stepsCompleted: s.tool_count,
        totalSteps: null,
        startedAt: s.started_at,
        costUsd: s.cost_usd,
        tokens: s.input_tokens + s.output_tokens,
        toolCount: s.tool_count,
      });
    }

    // Sort: running first, then by started_at descending
    const statusOrder: Record<OpStatus, number> = {
      running: 0,
      idle: 1,
      completed: 2,
      failed: 3,
    };
    ops.sort((a, b) => {
      const sd = statusOrder[a.status] - statusOrder[b.status];
      if (sd !== 0) return sd;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

    return ops;
  }, [agents, sessions]);

  // Count active (running) operations
  const activeCount = useMemo(
    () => operations.filter((o) => o.status === "running").length,
    [operations]
  );

  // Determine grid columns based on count
  const gridColumns = useCallback((count: number): string => {
    if (count === 0) return "1fr";
    if (count === 1) return "1fr";
    if (count === 2) return "repeat(2, 1fr)";
    if (count <= 4) return "repeat(2, 1fr)";
    return "repeat(3, 1fr)";
  }, []);

  return (
    <div
      className="ops-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Panel header ── */}
      <div className="ops-panel-header">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <rect x="0" y="0" width="5" height="5" rx="1" fill="#64748b" />
          <rect x="7" y="0" width="5" height="5" rx="1" fill="#64748b" />
          <rect x="0" y="7" width="5" height="5" rx="1" fill="#64748b" />
          <rect x="7" y="7" width="5" height="5" rx="1" fill="#64748b" />
        </svg>
        <span>Operations</span>
        {activeCount > 0 && (
          <span className="ops-count">{activeCount}</span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="ops-panel-body" style={{ padding: 8 }}>
        {operations.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns(operations.length),
              gap: 6,
              alignContent: "start",
            }}
          >
            {operations.map((op) => (
              <OpCard
                key={op.id}
                op={op}
                isSelected={selectedAgentId === op.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
