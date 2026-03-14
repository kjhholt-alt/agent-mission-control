"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface SwarmWorker {
  id: string;
  worker_name: string;
  worker_type: string;
  tier: string;
  status: string;
  current_task_id: string | null;
  tasks_completed: number;
  tasks_failed: number;
  xp: number;
  total_cost_cents: number;
  total_tokens: number;
  last_heartbeat: string;
}

interface SwarmTask {
  id: string;
  task_type: string;
  title: string;
  status: string;
  project: string;
  cost_tier: string;
  priority: number;
  parent_task_id: string | null;
  actual_cost_cents: number | null;
  tokens_used: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  output_data: Record<string, unknown> | null;
}

interface SwarmBudget {
  api_spent_cents: number;
  daily_api_budget_cents: number;
  tasks_completed: number;
  tasks_failed: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const WORKER_NAMES = [
  "Builder",
  "Miner",
  "Inspector",
  "Scout",
  "Forger",
  "Sentinel",
  "Pathfinder",
  "Warden",
];
const GREEK = [
  "\u03b1",
  "\u03b2",
  "\u03b3",
  "\u03b4",
  "\u03b5",
  "\u03b6",
  "\u03b7",
  "\u03b8",
];

function workerDisplayName(w: SwarmWorker, idx: number): string {
  const name = WORKER_NAMES[idx % WORKER_NAMES.length];
  const letter = GREEK[idx % GREEK.length];
  return `${name}-${letter}`;
}

function xpLevel(xp: number): number {
  return Math.floor(xp / 30) + 1;
}

function progressBar(current: number, total: number, width = 10): string {
  const filled = total > 0 ? Math.round((current / total) * width) : 0;
  const empty = width - filled;
  return "[" + "\u2588".repeat(filled) + "\u2591".repeat(empty) + "]";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ── ASCII Art ────────────────────────────────────────────────────────────────

const NEXUS_ASCII = `
 _   _ _____ __  __ _   _ ____
| \\ | | ____|  \\/  | | | / ___|
|  \\| |  _| \\  /\\  / | | \\___ \\
| |\\  | |___ /  \\  \\ |_| |___) |
|_| \\_|_____/_/\\_\\_\\___/|____/
`;

// ── Component ────────────────────────────────────────────────────────────────

export default function MobileCommandCenter() {
  const [workers, setWorkers] = useState<SwarmWorker[]>([]);
  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [budget, setBudget] = useState<SwarmBudget | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandOutput, setCommandOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventsRef = useRef<string[]>([]);

  const addEvent = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const entry = `[${timestamp}] ${msg}`;
    eventsRef.current = [entry, ...eventsRef.current].slice(0, 20);
    setEvents([...eventsRef.current]);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      // Fetch workers
      const wResp = await supabase
        .from("swarm_workers")
        .select("*")
        .neq("status", "dead")
        .order("spawned_at", { ascending: false });

      if (wResp.data) setWorkers(wResp.data);

      // Fetch tasks
      const tResp = await supabase
        .from("swarm_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (tResp.data) {
        const prev = tasks;
        setTasks(tResp.data);

        // Detect newly completed tasks for events
        for (const t of tResp.data) {
          if (
            t.status === "completed" &&
            t.task_type !== "meta" &&
            !prev.find(
              (p) => p.id === t.id && p.status === "completed"
            )
          ) {
            if (prev.length > 0) {
              addEvent(`Task completed: "${t.title.slice(0, 40)}"`);
            }
          }
        }
      }

      // Fetch budget
      const today = new Date().toISOString().split("T")[0];
      const bResp = await supabase
        .from("swarm_budgets")
        .select("*")
        .eq("budget_date", today)
        .limit(1);

      if (bResp.data && bResp.data.length > 0) setBudget(bResp.data[0]);

      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addEvent]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);

    // Subscribe to realtime changes on swarm_tasks
    const channel = supabase
      .channel("mobile-swarm")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_tasks" },
        (payload) => {
          const task = payload.new as SwarmTask;
          if (task?.status === "completed" && task.task_type !== "meta") {
            addEvent(`Task completed: "${task.title?.slice(0, 40)}"`);
          } else if (task?.status === "failed") {
            addEvent(`Task FAILED: "${task.title?.slice(0, 40)}"`);
          } else if (task?.status === "running") {
            addEvent(`Worker picked up: "${task.title?.slice(0, 40)}"`);
          }
          fetchAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "swarm_workers" },
        () => {
          addEvent("New worker spawned");
          fetchAll();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchAll, addEvent]);

  // ── Command handler ──────────────────────────────────────────────────────

  const handleCommand = async () => {
    const cmd = commandInput.trim().toLowerCase();
    if (!cmd) return;

    setCommandInput("");
    addEvent(`> ${cmd}`);

    if (cmd === "status" || cmd === "s") {
      const queued = tasks.filter((t) => t.status === "queued").length;
      const running = tasks.filter((t) => t.status === "running").length;
      const completed = tasks.filter((t) => t.status === "completed").length;
      const failed = tasks.filter((t) => t.status === "failed").length;
      setCommandOutput(
        `Queued: ${queued} | Running: ${running} | Done: ${completed} | Failed: ${failed}`
      );
    } else if (cmd === "budget" || cmd === "b") {
      if (budget) {
        setCommandOutput(
          `Spent: $${(budget.api_spent_cents / 100).toFixed(2)} / $${(budget.daily_api_budget_cents / 100).toFixed(2)}`
        );
      } else {
        setCommandOutput("No budget data");
      }
    } else if (cmd === "workers" || cmd === "w") {
      setCommandOutput(
        `Active workers: ${workers.length} (${workers.filter((w) => w.status === "working").length} working)`
      );
    } else if (cmd === "refresh" || cmd === "r") {
      await fetchAll();
      setCommandOutput("Refreshed.");
    } else if (cmd === "help" || cmd === "h") {
      setCommandOutput(
        "Commands: status(s), budget(b), workers(w), refresh(r), help(h)"
      );
    } else {
      setCommandOutput(`Unknown command: ${cmd}. Type 'help' for commands.`);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const totalTasks = tasks.filter((t) => t.task_type !== "meta").length;
  const completedTasks = tasks.filter(
    (t) => t.status === "completed" && t.task_type !== "meta"
  ).length;
  const failedTasks = tasks.filter((t) => t.status === "failed").length;
  const progressPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Find the root goal
  const rootGoal = tasks.find((t) => t.task_type === "meta" && !t.parent_task_id);
  const goalTitle = rootGoal
    ? rootGoal.title.replace("Goal: ", "")
    : "No active mission";

  const totalSpent = budget ? budget.api_spent_cents / 100 : 0;
  const totalBudget = budget ? budget.daily_api_budget_cents / 100 : 5;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: "#0a0a0f",
        color: "#33ff33",
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: "12px",
        lineHeight: "1.4",
        minHeight: "100vh",
        padding: "8px",
        maxWidth: "100vw",
        overflow: "hidden",
      }}
    >
      {/* ASCII Header */}
      <pre
        style={{
          color: "#00ff88",
          fontSize: "10px",
          lineHeight: "1.1",
          textAlign: "center",
          margin: "0 0 4px 0",
          whiteSpace: "pre",
        }}
      >
        {NEXUS_ASCII}
      </pre>
      <div
        style={{
          textAlign: "center",
          color: "#666",
          fontSize: "10px",
          marginBottom: "8px",
          borderBottom: "1px solid #1a1a2e",
          paddingBottom: "4px",
        }}
      >
        SWARM COMMAND CENTER v1.0
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>
          Connecting to swarm...
        </div>
      ) : (
        <>
          {/* ── PARTY STATUS ── */}
          <Section title="PARTY STATUS">
            {workers.length === 0 ? (
              <div style={{ color: "#555", padding: "4px 0" }}>
                No active workers. Swarm is dormant.
              </div>
            ) : (
              workers.map((w, i) => {
                const name = workerDisplayName(w, i);
                const lvl = xpLevel(w.xp);
                const xpInLevel = w.xp % 30;
                const bar = progressBar(xpInLevel, 30);
                const statusColor =
                  w.status === "working"
                    ? "#ffaa00"
                    : w.status === "idle"
                      ? "#33ff33"
                      : "#ff4444";
                const statusText =
                  w.status === "working"
                    ? "Working..."
                    : w.status === "idle"
                      ? "Idle"
                      : w.status;
                const taskInfo =
                  w.status === "working" && w.current_task_id
                    ? tasks.find((t) => t.id === w.current_task_id)?.title?.slice(0, 25) || ""
                    : "";

                return (
                  <div key={w.id} style={{ padding: "2px 0" }}>
                    <span style={{ color: "#00ccff" }}>
                      {name.padEnd(14)}
                    </span>
                    <span style={{ color: "#888" }}>{bar}</span>
                    <span style={{ color: "#aaa" }}> Lv.{lvl} </span>
                    <span style={{ color: statusColor }}>{statusText}</span>
                    {taskInfo && (
                      <div style={{ color: "#666", paddingLeft: "16px" }}>
                        {"\u2514"} &quot;{taskInfo}&quot;
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div style={{ color: "#444", fontSize: "10px", marginTop: "4px" }}>
              {workers.reduce((a, w) => a + w.tasks_completed, 0)} tasks done |{" "}
              {workers.reduce((a, w) => a + w.xp, 0)} XP total
            </div>
          </Section>

          {/* ── JOURNEY PROGRESS ── */}
          <Section title="JOURNEY">
            <div style={{ color: "#aaa", marginBottom: "4px" }}>
              {goalTitle.length > 45
                ? goalTitle.slice(0, 45) + "..."
                : goalTitle}
            </div>
            <div>
              {progressBar(completedTasks, totalTasks, 20)} {progressPct}%{" "}
              <span style={{ color: "#888" }}>
                {completedTasks}/{totalTasks} tasks
              </span>
            </div>
            {failedTasks > 0 && (
              <div style={{ color: "#ff4444" }}>
                {failedTasks} task{failedTasks > 1 ? "s" : ""} failed
              </div>
            )}
            <div style={{ color: "#888", marginTop: "2px" }}>
              Budget: ${totalSpent.toFixed(2)}/${totalBudget.toFixed(2)}
              {budget && (
                <span>
                  {" "}
                  | {budget.tasks_completed} OK / {budget.tasks_failed} fail
                  today
                </span>
              )}
            </div>
          </Section>

          {/* ── TASK QUEUE ── */}
          <Section title="TASK QUEUE">
            {tasks
              .filter((t) => t.task_type !== "meta")
              .slice(0, 8)
              .map((t) => {
                const icon =
                  t.status === "completed"
                    ? "\u2713"
                    : t.status === "failed"
                      ? "\u2717"
                      : t.status === "running"
                        ? "\u25b6"
                        : t.status === "blocked"
                          ? "\u25a0"
                          : "\u25cb";
                const color =
                  t.status === "completed"
                    ? "#33ff33"
                    : t.status === "failed"
                      ? "#ff4444"
                      : t.status === "running"
                        ? "#ffaa00"
                        : t.status === "blocked"
                          ? "#ff6666"
                          : "#888";
                return (
                  <div key={t.id} style={{ padding: "1px 0" }}>
                    <span style={{ color }}>{icon} </span>
                    <span style={{ color: "#aaa" }}>
                      {t.title.length > 38
                        ? t.title.slice(0, 38) + "..."
                        : t.title}
                    </span>
                    {t.tokens_used ? (
                      <span style={{ color: "#555", fontSize: "10px" }}>
                        {" "}
                        ({t.tokens_used}tk)
                      </span>
                    ) : null}
                  </div>
                );
              })}
            {tasks.filter((t) => t.task_type !== "meta").length === 0 && (
              <div style={{ color: "#555" }}>No tasks in queue.</div>
            )}
          </Section>

          {/* ── EVENTS LOG ── */}
          <Section title="TRAIL LOG">
            {events.length === 0 ? (
              <div style={{ color: "#555" }}>
                Waiting for trail events...
              </div>
            ) : (
              events.slice(0, 8).map((evt, i) => (
                <div
                  key={i}
                  style={{
                    color: evt.includes("FAILED")
                      ? "#ff4444"
                      : evt.includes("completed")
                        ? "#33ff33"
                        : evt.includes(">")
                          ? "#00ccff"
                          : "#888",
                    padding: "1px 0",
                    fontSize: "11px",
                  }}
                >
                  {"\u250a"} {evt}
                </div>
              ))
            )}
          </Section>

          {/* ── COMMAND INPUT ── */}
          <div
            style={{
              borderTop: "1px solid #1a1a2e",
              marginTop: "8px",
              paddingTop: "8px",
            }}
          >
            {commandOutput && (
              <div
                style={{
                  color: "#00ccff",
                  marginBottom: "4px",
                  fontSize: "11px",
                }}
              >
                {commandOutput}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: "#33ff33" }}>{">"}</span>
              <input
                ref={inputRef}
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommand();
                }}
                placeholder="type command..."
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#33ff33",
                  fontFamily: "inherit",
                  fontSize: "12px",
                  flex: 1,
                  caretColor: "#33ff33",
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div
              style={{
                color: "#333",
                fontSize: "9px",
                marginTop: "4px",
              }}
            >
              status(s) budget(b) workers(w) refresh(r) help(h)
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Section component ────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div
        style={{
          color: "#00ff88",
          fontSize: "11px",
          fontWeight: "bold",
          marginBottom: "2px",
        }}
      >
        {title}
      </div>
      <div
        style={{
          borderTop: "1px solid #1a3a1a",
          paddingTop: "4px",
        }}
      >
        {children}
      </div>
    </div>
  );
}
