"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

interface StatusRibbonProps {
  connected: boolean;
  activeAgents: number;
  activeSessions: number;
  totalCost: number;
  totalTokens: number;
  onCommandOpen: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return String(n);
}

function Divider() {
  return (
    <span
      style={{ color: "#1a2235", userSelect: "none" }}
      aria-hidden="true"
    >
      |
    </span>
  );
}

export function StatusRibbon({
  connected,
  activeAgents,
  activeSessions,
  totalCost,
  totalTokens,
  onCommandOpen,
}: StatusRibbonProps) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="ops-status"
      style={{
        background: "#080b12",
        borderBottom: "1px solid #1a2235",
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontFamily: "inherit",
        fontSize: 11,
        whiteSpace: "nowrap",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* ── LEFT: brand + system status ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          className="ops-glow-cyan"
          style={{
            color: "#22d3ee",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.12em",
          }}
        >
          NEXUS
        </span>

        <Divider />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className={connected ? "ops-dot-live" : "ops-dot-error"} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: connected ? "#34d399" : "#fbbf24",
            }}
          >
            {connected ? "OPERATIONAL" : "DEGRADED"}
          </span>
        </div>
      </div>

      {/* ── CENTER: metrics ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Metric label="AGENTS" value={String(activeAgents)} />
        <Divider />
        <Metric label="SESSIONS" value={String(activeSessions)} />
        <Divider />
        <Metric label="COST" value={`$${totalCost.toFixed(2)}`} />
        <Divider />
        <Metric label="TOKENS" value={formatTokens(totalTokens)} />
      </div>

      {/* ── RIGHT: clock + command hint ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            color: "#e2e8f0",
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: "0.06em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {clock}
        </span>

        <button
          type="button"
          onClick={onCommandOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(34, 211, 238, 0.06)",
            border: "1px solid rgba(34, 211, 238, 0.15)",
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
            color: "#64748b",
            fontSize: 10,
            fontFamily: "inherit",
            lineHeight: 1,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(34, 211, 238, 0.4)";
            e.currentTarget.style.color = "#94a3b8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(34, 211, 238, 0.15)";
            e.currentTarget.style.color = "#64748b";
          }}
        >
          <Shield style={{ width: 10, height: 10 }} />
          <kbd
            style={{
              fontSize: 9,
              fontFamily: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      </div>
    </div>
  );
}

/* ── small metric cell ── */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          color: "#64748b",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: "#e2e8f0",
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}
