"use client";
import { useState, useEffect } from "react";
import type { Worker, Building } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface TerminalStatusBarProps {
  workers: Worker[];
  buildings: Building[];
  budget: { daily_budget: number; spent_today: number };
  isConnected: boolean;
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  themeName: string;
  onCycleTheme: () => void;
}

export function TerminalStatusBar({
  workers,
  buildings,
  budget,
  isConnected,
  theme,
  themeName,
  onCycleTheme,
}: TerminalStatusBarProps) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeWorkers = workers.filter(w => w.status === "working").length;
  const activeBuildings = buildings.filter(b => b.status === "active").length;
  const spentPct = budget.daily_budget > 0 ? ((budget.spent_today / budget.daily_budget) * 100).toFixed(0) : "0";

  return (
    <div
      className="flex items-center justify-between px-3 h-full text-[10px] font-mono select-none"
      style={{
        backgroundColor: theme.dim + "33",
        borderTop: `1px solid ${theme.dim}`,
        color: theme.primary,
      }}
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Connection */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isConnected ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isConnected ? "#00ff41" : "#ff3333" }}
          />
          <span style={{ color: isConnected ? "#00ff41" : "#ff3333" }}>
            {isConnected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>

        {/* Agents */}
        <span>
          <span style={{ color: theme.dim }}>AGENTS:</span>{" "}
          <span style={{ color: theme.primary }}>{activeWorkers}</span>
          <span style={{ color: theme.dim }}>/{workers.length}</span>
        </span>

        {/* Buildings */}
        <span>
          <span style={{ color: theme.dim }}>PROJECTS:</span>{" "}
          <span style={{ color: theme.primary }}>{activeBuildings}</span>
          <span style={{ color: theme.dim }}>/{buildings.length}</span>
        </span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-4">
        <span>
          <span style={{ color: theme.dim }}>SPEND:</span>{" "}
          <span style={{ color: Number(spentPct) > 80 ? "#ff3333" : Number(spentPct) > 50 ? "#ffb000" : "#00ff41" }}>
            ${budget.spent_today.toFixed(2)}
          </span>
          <span style={{ color: theme.dim }}>/${budget.daily_budget.toFixed(0)} ({spentPct}%)</span>
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={onCycleTheme}
          className="hover:opacity-80 uppercase tracking-wider cursor-pointer"
          style={{ color: theme.secondary }}
          title="Cycle terminal theme"
        >
          [{themeName}]
        </button>

        {/* Clock */}
        <span className="tabular-nums tracking-wider" style={{ color: theme.primary }}>
          {clock}
        </span>
      </div>
    </div>
  );
}
