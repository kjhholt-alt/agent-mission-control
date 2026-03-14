"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

interface OracleDecision {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  project: string;
  action_needed: string;
  source_type: string;
  source_id: string | null;
  status: string;
  created_at: string;
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
  decisions_needed: Array<Record<string, unknown>>;
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#e8a019",
  low: "#06b6d4",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function OracleDashboard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [decisions, setDecisions] = useState<OracleDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [redirectInput, setRedirectInput] = useState<Record<string, string>>({});
  const [showRedirectFor, setShowRedirectFor] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

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

  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch("/api/oracle/decisions");
      const data = await res.json();
      if (data.decisions) {
        setDecisions(data.decisions);
      }
    } catch (err) {
      console.error("Failed to fetch decisions:", err);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
    fetchDecisions();
    const interval = setInterval(() => {
      fetchBriefing();
      fetchDecisions();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchBriefing, fetchDecisions]);

  const handleAction = async (
    decisionId: string,
    action: "approve" | "dismiss" | "redirect",
    redirectPrompt?: string
  ) => {
    setActionInProgress(decisionId);
    try {
      const res = await fetch("/api/oracle/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_id: decisionId,
          action,
          redirect_prompt: redirectPrompt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          action === "approve"
            ? "Decision approved"
            : action === "dismiss"
              ? "Decision dismissed"
              : "Decision redirected"
        );
        // Remove from local state with animation
        setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
        setShowRedirectFor(null);
      } else {
        showToast(`Error: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Action error:", err);
      showToast("Failed to process action");
    } finally {
      setActionInProgress(null);
    }
  };

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
      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            style={{
              position: "fixed",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1a1a2e",
              border: `1px solid ${GOLD_DIM}60`,
              color: GOLD,
              padding: "10px 24px",
              borderRadius: "8px",
              fontSize: "13px",
              zIndex: 1000,
              boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

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
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <a
              href="/oracle/chat"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DIM})`,
                border: "none",
                color: "#0a0a0f",
                padding: "4px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "inherit",
                textDecoration: "none",
                fontWeight: "bold",
                boxShadow: `0 0 10px ${GOLD}30`,
              }}
            >
              Chat with Oracle
            </a>
            <button
              onClick={() => {
                fetchBriefing();
                fetchDecisions();
              }}
              style={{
                background: "transparent",
                border: `1px solid ${GOLD_DIM}40`,
                color: GOLD_DIM,
                padding: "4px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "inherit",
              }}
            >
              Refresh
            </button>
          </div>
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

      {/* ── DECISION QUEUE (full width) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ marginBottom: "24px" }}
      >
        <SectionHeader title="DECISION QUEUE" count={decisions.length} />
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <AnimatePresence mode="popLayout">
            {decisions.length === 0 ? (
              <EmptyState text="No decisions pending. Everything is running smoothly." />
            ) : (
              decisions.map((d, i) => {
                const sevColor =
                  SEVERITY_COLORS[d.severity] || SEVERITY_COLORS.medium;
                const isProcessing = actionInProgress === d.id;

                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100, height: 0, marginBottom: 0, padding: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    style={{
                      background: CARD_BG,
                      border: `1px solid ${sevColor}30`,
                      borderLeft: `4px solid ${sevColor}`,
                      borderRadius: "8px",
                      padding: "16px",
                      opacity: isProcessing ? 0.5 : 1,
                      pointerEvents: isProcessing ? "none" : "auto",
                    }}
                  >
                    {/* Top row: severity + title + time */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "bold",
                          color: sevColor,
                          background: `${sevColor}20`,
                          padding: "2px 8px",
                          borderRadius: "3px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {SEVERITY_LABELS[d.severity] || d.severity.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "bold",
                          color: "#ddd",
                          flex: 1,
                        }}
                      >
                        {d.title}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#555",
                        }}
                      >
                        {timeAgo(d.created_at)}
                      </span>
                    </div>

                    {/* Description */}
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#888",
                        marginBottom: "10px",
                        lineHeight: "1.5",
                      }}
                    >
                      {d.description}
                    </div>

                    {/* Meta row: project + source type */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#06b6d4",
                          background: "rgba(6, 182, 212, 0.1)",
                          padding: "2px 8px",
                          borderRadius: "3px",
                        }}
                      >
                        {d.project || "nexus"}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#666",
                          background: "rgba(255,255,255,0.05)",
                          padding: "2px 8px",
                          borderRadius: "3px",
                        }}
                      >
                        {d.source_type?.replace(/_/g, " ") || "unknown"}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleAction(d.id, "approve")}
                        style={{
                          background: "rgba(16, 185, 129, 0.15)",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          color: "#10b981",
                          padding: "6px 16px",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                          fontFamily: "inherit",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(d.id, "dismiss")}
                        style={{
                          background: "transparent",
                          border: "1px solid #333",
                          color: "#666",
                          padding: "6px 16px",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontFamily: "inherit",
                        }}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() =>
                          setShowRedirectFor(
                            showRedirectFor === d.id ? null : d.id
                          )
                        }
                        style={{
                          background: "rgba(59, 130, 246, 0.15)",
                          border: "1px solid rgba(59, 130, 246, 0.4)",
                          color: "#3b82f6",
                          padding: "6px 16px",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontFamily: "inherit",
                        }}
                      >
                        Redirect
                      </button>
                    </div>

                    {/* Redirect input */}
                    <AnimatePresence>
                      {showRedirectFor === d.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{
                            marginTop: "10px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                            }}
                          >
                            <input
                              type="text"
                              placeholder="New instructions..."
                              value={redirectInput[d.id] || ""}
                              onChange={(e) =>
                                setRedirectInput((prev) => ({
                                  ...prev,
                                  [d.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  redirectInput[d.id]?.trim()
                                ) {
                                  handleAction(
                                    d.id,
                                    "redirect",
                                    redirectInput[d.id]
                                  );
                                }
                              }}
                              style={{
                                flex: 1,
                                background: "#0a0a0f",
                                border: "1px solid #333",
                                color: "#ddd",
                                padding: "8px 12px",
                                borderRadius: "5px",
                                fontSize: "12px",
                                fontFamily: "inherit",
                                outline: "none",
                              }}
                            />
                            <button
                              onClick={() => {
                                if (redirectInput[d.id]?.trim()) {
                                  handleAction(
                                    d.id,
                                    "redirect",
                                    redirectInput[d.id]
                                  );
                                }
                              }}
                              style={{
                                background: "#3b82f6",
                                border: "none",
                                color: "#fff",
                                padding: "8px 16px",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: "bold",
                                fontFamily: "inherit",
                              }}
                            >
                              Send
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Two-column: Highlights + Health/Budget ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {/* ── Today's Highlights ── */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
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
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#555",
                        marginTop: "2px",
                      }}
                    >
                      {h.project}
                      {h.completed_at && ` - ${timeAgo(h.completed_at)}`}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* ── Right column: Budget + Next Steps stacked ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Budget */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
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
                    <span>{briefing.budget.tasks_completed} completed</span>
                    <span>{briefing.budget.tasks_failed} failed</span>
                  </div>
                </>
              ) : (
                <EmptyState text="No budget data." />
              )}
            </div>
          </motion.div>

          {/* Next Steps */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
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
      </div>

      {/* ── Project Health (full width) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{ marginBottom: "24px" }}
      >
        <SectionHeader title="PROJECT HEALTH" />
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "6px",
            padding: "16px",
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
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
                  gap: "8px",
                  fontSize: "12px",
                }}
              >
                <HealthDot status={status} />
                <span style={{ color: "#aaa" }}>{proj}</span>
              </div>
            ))
          ) : (
            <EmptyState text="No active projects tracked." />
          )}
        </div>
      </motion.div>

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
  const c = colors[status] || colors.unknown;

  return (
    <div
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: c,
        boxShadow: status === "green" ? `0 0 6px ${c}60` : undefined,
      }}
    />
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
