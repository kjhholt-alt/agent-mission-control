"use client";
import { useMemo, useState, useEffect } from "react";
import type { Worker, Building, AlertEvent } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface SystemMonitorProps {
  workers: Worker[];
  buildings: Building[];
  events: AlertEvent[];
  budget: {
    apiSpent: number;
    apiLimit: number;
    minutesUsed: number;
    minutesLimit: number;
    tasksCompleted: number;
    tasksFailed: number;
  } | null;
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

const BAR_WIDTH = 16;

function buildBar(ratio: number): { filled: string; empty: string } {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filledCount = Math.round(clamped * BAR_WIDTH);
  return {
    filled: "\u2588".repeat(filledCount),
    empty: "\u2591".repeat(BAR_WIDTH - filledCount),
  };
}

function gaugeColor(ratio: number, theme: SystemMonitorProps["theme"]): string {
  if (ratio > 0.8) return "#ff3333";
  if (ratio >= 0.5) return "#ffb000";
  return theme.primary;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SystemMonitor({
  workers,
  buildings,
  events,
  budget,
  theme,
}: SystemMonitorProps) {
  const [uptimeSeconds, setUptimeSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Agent load
  const agentLoad = useMemo(() => {
    const total = workers.length;
    if (total === 0) return { ratio: 0, active: 0, total: 0 };
    const active = workers.filter(
      (w) => w.status === "working" || w.status === "moving"
    ).length;
    return { ratio: active / total, active, total };
  }, [workers]);

  // API budget
  const apiBudget = useMemo(() => {
    if (!budget) return null;
    const ratio =
      budget.apiLimit > 0 ? budget.apiSpent / budget.apiLimit : 0;
    return {
      ratio,
      spent: (budget.apiSpent / 100).toFixed(2),
      limit: (budget.apiLimit / 100).toFixed(2),
    };
  }, [budget]);

  // Task rate
  const taskRate = useMemo(() => {
    if (!budget) return null;
    const total = budget.tasksCompleted + budget.tasksFailed;
    const ratio = total > 0 ? budget.tasksCompleted / total : 0;
    return {
      ratio,
      completed: budget.tasksCompleted,
      failed: budget.tasksFailed,
    };
  }, [budget]);

  // Quick stats
  const activeBuildings = useMemo(
    () => buildings.filter((b) => b.status === "active").length,
    [buildings]
  );
  const onlineAgents = useMemo(
    () => workers.filter((w) => w.status !== "idle").length,
    [workers]
  );

  // Recent events sparkline (last 10)
  const sparkline = useMemo(() => {
    return events.slice(-10).map((e) => ({
      id: e.id,
      type: e.type,
    }));
  }, [events]);

  const sectionBorder = { borderBottom: `1px solid ${theme.dim}` };
  const labelStyle = { color: theme.dim, fontSize: 13, fontFamily: "monospace" };
  const valueStyle = { color: theme.primary, fontSize: 13, fontFamily: "monospace" };

  // Build gauge bars
  const agentBar = buildBar(agentLoad.ratio);
  const agentPercent = Math.round(agentLoad.ratio * 100);
  const agentColor = gaugeColor(agentLoad.ratio, theme);

  const apiBar = apiBudget ? buildBar(apiBudget.ratio) : null;
  const apiColor = apiBudget ? gaugeColor(apiBudget.ratio, theme) : theme.dim;

  const taskBar = taskRate ? buildBar(taskRate.ratio) : null;

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1 shrink-0"
        style={{
          ...sectionBorder,
          color: theme.secondary,
          fontSize: 13,
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: theme.primary }}>{"\u25C6"}</span>
        SYSTEM MONITOR
      </div>

      <div className="flex-1 overflow-y-auto terminal-scroll">
        {/* AGENT LOAD gauge */}
        <div className="px-3 py-1.5" style={sectionBorder}>
          <div style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "pre" }}>
            <span style={labelStyle}>AGENT LOAD </span>
            <span style={labelStyle}>[</span>
            <span style={{ color: agentColor }}>{agentBar.filled}</span>
            <span style={{ color: theme.dim }}>{agentBar.empty}</span>
            <span style={labelStyle}>]</span>
            <span style={{ color: agentColor }}> {agentPercent}%</span>
          </div>
        </div>

        {/* API BUDGET gauge */}
        <div className="px-3 py-1.5" style={sectionBorder}>
          <div style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "pre" }}>
            <span style={labelStyle}>API BUDGET </span>
            {apiBar ? (
              <>
                <span style={labelStyle}>[</span>
                <span style={{ color: apiColor }}>{apiBar.filled}</span>
                <span style={{ color: theme.dim }}>{apiBar.empty}</span>
                <span style={labelStyle}>]</span>
                <span style={{ color: apiColor }}>
                  {" "}${apiBudget!.spent}/${apiBudget!.limit}
                </span>
              </>
            ) : (
              <>
                <span style={labelStyle}>[</span>
                <span style={{ color: theme.dim }}>{"\u2591".repeat(BAR_WIDTH)}</span>
                <span style={labelStyle}>]</span>
                <span style={{ color: theme.dim }}> N/A</span>
              </>
            )}
          </div>
        </div>

        {/* TASK RATE gauge */}
        <div className="px-3 py-1.5" style={sectionBorder}>
          <div style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "pre" }}>
            <span style={labelStyle}>TASK RATE  </span>
            {taskBar && taskRate ? (
              <>
                <span style={labelStyle}>[</span>
                <span style={{ color: "#00ff41" }}>{taskBar.filled}</span>
                <span style={{ color: theme.dim }}>{taskBar.empty}</span>
                <span style={labelStyle}>]</span>
                <span style={{ color: "#00ff41" }}>
                  {" "}{taskRate.completed} done
                </span>
                <span style={{ color: theme.dim }}> / </span>
                <span style={{ color: taskRate.failed > 0 ? "#ff3333" : theme.dim }}>
                  {taskRate.failed} fail
                </span>
              </>
            ) : (
              <>
                <span style={labelStyle}>[</span>
                <span style={{ color: theme.dim }}>{"\u2591".repeat(BAR_WIDTH)}</span>
                <span style={labelStyle}>]</span>
                <span style={{ color: theme.dim }}> N/A</span>
              </>
            )}
          </div>
        </div>

        {/* Quick stats 2x2 grid */}
        <div className="px-3 py-1.5" style={sectionBorder}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px 16px",
              fontSize: 13,
              fontFamily: "monospace",
            }}
          >
            <div>
              <span style={labelStyle}>BUILDINGS  </span>
              <span style={valueStyle}>{activeBuildings} active</span>
            </div>
            <div>
              <span style={labelStyle}>AGENTS  </span>
              <span style={valueStyle}>{onlineAgents} online</span>
            </div>
            <div>
              <span style={labelStyle}>EVENTS     </span>
              <span style={valueStyle}>{events.length} total</span>
            </div>
            <div>
              <span style={labelStyle}>UPTIME  </span>
              <span style={valueStyle}>{formatUptime(uptimeSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Mini event sparkline */}
        <div className="px-3 py-1.5">
          <div style={{ fontSize: 13, fontFamily: "monospace" }}>
            <span style={labelStyle}>RECENT </span>
            {sparkline.length > 0 ? (
              sparkline.map((e) => {
                let color: string;
                let char: string;
                switch (e.type) {
                  case "success":
                    color = "#00ff41";
                    char = "\u25CF";
                    break;
                  case "error":
                    color = "#ff3333";
                    char = "\u25CF";
                    break;
                  case "warning":
                    color = "#ffb000";
                    char = "\u25CF";
                    break;
                  case "info":
                  default:
                    color = theme.dim;
                    char = "\u25CB";
                    break;
                }
                return (
                  <span key={e.id} style={{ color }}>
                    {char}
                  </span>
                );
              })
            ) : (
              <span style={{ color: theme.dim }}>---</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
