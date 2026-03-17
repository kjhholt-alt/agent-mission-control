"use client";

import { useState, useEffect } from "react";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface TerminalHeaderProps {
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  isConnected: boolean;
  workerCount: number;
  eventCount: number;
}

export function TerminalHeader({ theme, isConnected, workerCount, eventCount }: TerminalHeaderProps) {
  const [uptime, setUptime] = useState("00:00:00");
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - startTime;
      const h = Math.floor(elapsed / 3600000).toString().padStart(2, "0");
      const m = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, "0");
      const s = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, "0");
      setUptime(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div
      className="flex items-center justify-between px-4 h-full text-[13px] font-mono select-none"
      style={{
        borderBottom: `1px solid ${theme.dim}`,
        backgroundColor: "rgba(0,0,0,0.3)",
      }}
    >
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <span className="crt-glow font-bold text-[16px] tracking-[0.25em]" style={{ color: theme.primary }}>
          NEXUS
        </span>
        <span style={{ color: theme.dim }}>|</span>
        <span style={{ color: theme.secondary }} className="tracking-wider">
          TERMINAL v1.0
        </span>
        <span style={{ color: theme.dim }}>|</span>
        <span style={{ color: isConnected ? "#00ff41" : "#ff3333" }} className="tracking-wider">
          {isConnected ? "LIVE" : "DEMO"}
        </span>
      </div>

      {/* Center: ASCII divider */}
      <div className="hidden md:flex items-center gap-3" style={{ color: theme.dim }}>
        <span>{"─".repeat(8)}</span>
        <span style={{ color: theme.secondary }}>
          [{workerCount} AGENTS]
        </span>
        <span>{"─".repeat(4)}</span>
        <span style={{ color: theme.secondary }}>
          [{eventCount} EVENTS]
        </span>
        <span>{"─".repeat(8)}</span>
      </div>

      {/* Right: Session uptime */}
      <div className="flex items-center gap-3">
        <span style={{ color: theme.dim }}>UPTIME:</span>
        <span className="tabular-nums tracking-wider" style={{ color: theme.primary }}>
          {uptime}
        </span>
      </div>
    </div>
  );
}
