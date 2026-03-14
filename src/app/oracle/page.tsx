"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

interface Decision {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  task_id?: string;
  project?: string;
  actions: string[];
}

interface Highlight {
  title: string;
  project: string;
  completed_at?: string;
  summary?: string;
}

interface BudgetStatus {
  api_spent: number;
  api_limit: number;
  api_pct: number;
  tasks_completed: number;
  tasks_failed: number;
}

interface Briefing {
  type: string;
  timestamp: string;
  greeting: string;
  decisions_needed: Decision[];
  highlights: Highlight[];
  budget: BudgetStatus;
  project_health: Record<string, string>;
  next_steps: string[];
  summary: string;
  today_completed?: number;
  today_failed?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GOLD = "#e8a019";
const GOLD_DIM = "#b87a0d";
const GOLD_GLOW = "rgba(232, 160, 25, 0.15)";
const BG = "#0a0a0f";
const CARD_BG = "#111118";
const CARD_BORDER = "#1a1a2e";

// ── Component ────────────────────────────────────────────────────────────────

export default function OracleDashboard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedDecisions, setDismissedDecisions] = useState<Set<string>>(
    new Set()
  );
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchBriefing = useCallback(async () => {
    try {
      const res = await fetch("/api/oracle?type=live");
      const data = await res.json();
      if (data.briefing) {
        setBriefing(data.briefing);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch Oracle briefing:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
    const interval = setInterval(fetchBriefing, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBriefing]);

  const dismissDecision = (title: string) => {
    setDismissedDecisions((prev) => new Set([...prev, title]));
  };

  const activeDecisions =
    briefing?.decisions_needed.filter(
      (d) => !dismissedDecisions.has(d.title)
    ) || [];

  if (loading) {
    return (
      <div
        style={{
          background: BG,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ color: GOLD, fontSize: "16px" }}
        >
          Oracle is gathering intelligence...
        </motion.div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#e0e0e0",
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
          borderBottom: `1px solid ${GOLD_DIM}40`,
          paddingBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              boxShadow: `0 0 20px ${GOLD}40`,
            }}
          >
            <span style={{ filter: "brightness(0)" }}>&#9673;</span>
          </div>
          <div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: GOLD,
                margin: 0,
                textShadow: `0 0 20px ${GOLD}30`,
              }}
            >
              ORACLE
            </h1>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
              Personal AI Assistant | Nexus Hive
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#555" }}>
            Last updated:{" "}
            {lastRefresh.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <button
            onClick={fetchBriefing}
            style={{
              background: "transparent",
              border: `1px solid ${GOLD_DIM}40`,
              color: GOLD_DIM,
              padding: "4px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
              marginTop: "4px",
            }}
          >
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Current Briefing ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: GOLD_GLOW,
          border: `1px solid ${GOLD_DIM}30`,
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            color: GOLD,
            marginBottom: "8px",
            fontWeight: "bold",
          }}
        >
          {briefing?.greeting || "Oracle is ready."}
        </div>
        <div style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.6" }}>
          {briefing?.summary || "No data available."}
        </div>
      </motion.div>

      {/* ── Two-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {/* ── Decisions Needed ── */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SectionHeader title="DECISIONS NEEDED" count={activeDecisions.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <AnimatePresence>
              {activeDecisions.length === 0 ? (
                <EmptyState text="No decisions needed. Everything is running smoothly." />
              ) : (
                activeDecisions.map((d, i) => (
                  <motion.div
                    key={d.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      background: CARD_BG,
                      border: `1px solid ${severityColor(d.severity)}30`,
                      borderLeft: `3px solid ${severityColor(d.severity)}`,
                      borderRadius: "6px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <SeverityBadge severity={d.severity} />
                      <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ddd" }}>
                        {d.title}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#888",
                        marginBottom: "8px",
                        lineHeight: "1.4",
                      }}
                    >
                      {d.detail}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {d.actions.map((action) => (
                        <ActionButton
                          key={action}
                          action={action}
                          onClick={() => {
                            if (action === "dismiss") {
                              dismissDecision(d.title);
                            }
                            // Other actions would trigger API calls
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Today's Highlights ── */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SectionHeader
            title="TODAY'S HIGHLIGHTS"
            count={briefing?.highlights?.length || 0}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {!briefing?.highlights?.length ? (
              <EmptyState text="No completed tasks yet today." />
            ) : (
              briefing.highlights.slice(0, 5).map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: "6px",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      color: "#10b981",
                      fontSize: "14px",
                      marginTop: "1px",
                      flexShrink: 0,
                    }}
                  >
                    &#10003;
                  </span>
                  <div>
                    <div style={{ fontSize: "12px", color: "#ccc" }}>
                      {h.title}
                    </div>
                    <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
                      {h.project}
                      {h.completed_at &&
                        ` - ${timeAgo(h.completed_at)}`}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Bottom row: Budget + Health + Next Steps ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {/* Budget */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <SectionHeader title="BUDGET STATUS" />
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "6px",
              padding: "16px",
            }}
          >
            {briefing?.budget ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#888" }}>API Spend</span>
                  <span
                    style={{
                      color:
                        briefing.budget.api_pct >= 80
                          ? "#ef4444"
                          : briefing.budget.api_pct >= 50
                            ? GOLD
                            : "#10b981",
                    }}
                  >
                    ${(briefing.budget.api_spent / 100).toFixed(2)} / $
                    {(briefing.budget.api_limit / 100).toFixed(2)}
                  </span>
                </div>
                <ProgressBar
                  value={briefing.budget.api_pct}
                  color={
                    briefing.budget.api_pct >= 80
                      ? "#ef4444"
                      : briefing.budget.api_pct >= 50
                        ? GOLD
                        : "#10b981"
                  }
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "12px",
                    fontSize: "11px",
                    color: "#666",
                  }}
                >
                  <span>
                    {briefing.budget.tasks_completed} completed
                  </span>
                  <span>
                    {briefing.budget.tasks_failed} failed
                  </span>
                </div>
              </>
            ) : (
              <EmptyState text="No budget data." />
            )}
          </div>
        </motion.div>

        {/* Health Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <SectionHeader title="PROJECT HEALTH" />
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "6px",
              padding: "16px",
            }}
          >
            {briefing?.project_health &&
            Object.keys(briefing.project_health).length > 0 ? (
              Object.entries(briefing.project_health).map(([proj, status]) => (
                <div
                  key={proj}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#aaa" }}>{proj}</span>
                  <HealthDot status={status} />
                </div>
              ))
            ) : (
              <EmptyState text="No active projects tracked." />
            )}
          </div>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <SectionHeader title="NEXT STEPS" />
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "6px",
              padding: "16px",
            }}
          >
            {briefing?.next_steps?.length ? (
              briefing.next_steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "4px 0",
                    fontSize: "11px",
                    color: "#aaa",
                  }}
                >
                  <span style={{ color: GOLD_DIM, flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <span>{step}</span>
                </div>
              ))
            ) : (
              <EmptyState text="No tasks queued." />
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          textAlign: "center",
          fontSize: "10px",
          color: "#333",
          padding: "16px 0",
          borderTop: `1px solid ${CARD_BORDER}`,
        }}
      >
        Oracle | Nexus Hive | Briefings every 2h | Daily digest at 6pm |
        Weekly report on Sundays
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "8px",
      }}
    >
      <h2
        style={{
          fontSize: "11px",
          fontWeight: "bold",
          color: GOLD_DIM,
          letterSpacing: "1px",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {count !== undefined && (
        <span
          style={{
            fontSize: "10px",
            color: count > 0 ? GOLD : "#444",
            background: count > 0 ? `${GOLD}15` : "transparent",
            padding: "2px 8px",
            borderRadius: "10px",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = severityColor(severity);
  const labels: Record<string, string> = {
    critical: "CRIT",
    high: "HIGH",
    medium: "MED",
    low: "LOW",
  };
  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: "bold",
        color,
        background: `${color}20`,
        padding: "1px 6px",
        borderRadius: "3px",
        letterSpacing: "0.5px",
      }}
    >
      {labels[severity] || severity.toUpperCase()}
    </span>
  );
}

function ActionButton({
  action,
  onClick,
}: {
  action: string;
  onClick: () => void;
}) {
  const labels: Record<string, string> = {
    retry: "Retry",
    redirect: "Redirect",
    dismiss: "Dismiss",
    cancel: "Cancel",
    investigate: "Investigate",
    restart_swarm: "Restart",
    increase_budget: "Increase",
    pause_workers: "Pause",
  };

  const isDismiss = action === "dismiss";

  return (
    <button
      onClick={onClick}
      style={{
        background: isDismiss ? "transparent" : `${GOLD}15`,
        border: `1px solid ${isDismiss ? "#333" : GOLD_DIM}40`,
        color: isDismiss ? "#666" : GOLD_DIM,
        padding: "3px 10px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "10px",
        fontFamily: "inherit",
      }}
    >
      {labels[action] || action}
    </button>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      style={{
        height: "6px",
        background: "#1a1a2e",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          height: "100%",
          background: color,
          borderRadius: "3px",
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
    </div>
  );
}

function HealthDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    green: "#10b981",
    yellow: "#e8a019",
    red: "#ef4444",
    idle: "#555",
    unknown: "#333",
  };
  const labels: Record<string, string> = {
    green: "Healthy",
    yellow: "Warning",
    red: "Critical",
    idle: "Idle",
    unknown: "Unknown",
  };
  const c = colors[status] || colors.unknown;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: "10px", color: c }}>
        {labels[status] || status}
      </span>
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: c,
          boxShadow: status === "green" ? `0 0 6px ${c}60` : undefined,
        }}
      />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "6px",
        padding: "16px",
        textAlign: "center",
        fontSize: "11px",
        color: "#444",
      }}
    >
      {text}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#e8a019",
    low: "#555",
  };
  return colors[severity] || "#555";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
