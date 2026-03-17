"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface SessionReplayProps {
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

interface SessionLine {
  id: string;
  time: string;
  agent: string;
  action: string;
  detail: string;
  type: "tool" | "edit" | "read" | "bash" | "write" | "think" | "spawn" | "complete";
}

// Simulated session replay data — in production this comes from nexus_hook_events via Supabase
const DEMO_SESSION_LINES: SessionLine[] = [
  { id: "s1", time: "14:32:01", agent: "OPUS", action: "Read", detail: "src/app/game/page.tsx", type: "read" },
  { id: "s2", time: "14:32:02", agent: "OPUS", action: "Think", detail: "Analyzing terminal grid layout and component structure", type: "think" },
  { id: "s3", time: "14:32:04", agent: "OPUS", action: "Edit", detail: "src/components/terminal/CommandInput.tsx:46-98", type: "edit" },
  { id: "s4", time: "14:32:06", agent: "OPUS", action: "Write", detail: "src/components/terminal/AgentChat.tsx (new)", type: "write" },
  { id: "s5", time: "14:32:08", agent: "SONNET", action: "Bash", detail: "npm run build — 0 errors, 45 pages", type: "bash" },
  { id: "s6", time: "14:32:10", agent: "OPUS", action: "Edit", detail: "src/app/game/page.tsx:25-87", type: "edit" },
  { id: "s7", time: "14:32:12", agent: "OPUS", action: "Spawn", detail: "code-reviewer → 21 terminal components", type: "spawn" },
  { id: "s8", time: "14:32:14", agent: "HAIKU", action: "Read", detail: "src/components/terminal/AgentRoster.tsx", type: "read" },
  { id: "s9", time: "14:32:16", agent: "SONNET", action: "Bash", detail: "git add -A && git commit -m 'Phase 3'", type: "bash" },
  { id: "s10", time: "14:32:18", agent: "OPUS", action: "Think", detail: "Planning Session Replay component architecture", type: "think" },
  { id: "s11", time: "14:32:20", agent: "HAIKU", action: "Read", detail: "src/components/terminal/SystemMonitor.tsx", type: "read" },
  { id: "s12", time: "14:32:22", agent: "OPUS", action: "Edit", detail: "src/components/terminal/QuadrantGrid.tsx:7-12", type: "edit" },
  { id: "s13", time: "14:32:24", agent: "SONNET", action: "Bash", detail: "npx tsc --noEmit — clean", type: "bash" },
  { id: "s14", time: "14:32:26", agent: "OPUS", action: "Write", detail: "src/components/terminal/SessionReplay.tsx (new)", type: "write" },
  { id: "s15", time: "14:32:28", agent: "OPUS", action: "Done", detail: "Phase 3 complete — 6/6 features shipped", type: "complete" },
];

const ACTION_COLORS: Record<SessionLine["type"], string> = {
  read: "#60a5fa",    // blue
  edit: "#fbbf24",    // amber
  write: "#34d399",   // emerald
  bash: "#a78bfa",    // violet
  think: "#94a3b8",   // gray
  spawn: "#f472b6",   // pink
  complete: "#00ff41", // green
  tool: "#06b6d4",    // cyan
};

const ACTION_ICONS: Record<SessionLine["type"], string> = {
  read: "◎",
  edit: "✎",
  write: "✚",
  bash: "$",
  think: "◇",
  spawn: "⚡",
  complete: "✓",
  tool: "⊕",
};

export function SessionReplay({ theme }: SessionReplayProps) {
  const [lines, setLines] = useState<SessionLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineIndexRef = useRef(0);

  // Stream lines one by one for replay effect
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      if (lineIndexRef.current >= DEMO_SESSION_LINES.length) {
        // Loop back to start after a pause
        setTimeout(() => {
          lineIndexRef.current = 0;
          setLines([]);
        }, 3000);
        return;
      }

      setLines(prev => [...prev, DEMO_SESSION_LINES[lineIndexRef.current]]);
      lineIndexRef.current++;
    }, 800 + Math.random() * 600);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Stats
  const stats = useMemo(() => {
    const edits = lines.filter(l => l.type === "edit").length;
    const reads = lines.filter(l => l.type === "read").length;
    const bashes = lines.filter(l => l.type === "bash").length;
    const agents = new Set(lines.map(l => l.agent)).size;
    return { edits, reads, bashes, agents };
  }, [lines]);

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b shrink-0"
        style={{ borderColor: theme.dim, fontFamily: "monospace", fontSize: 13 }}
      >
        <span style={{ color: theme.primary, fontWeight: 700, letterSpacing: "0.15em" }}>
          ◆ SESSION REPLAY
        </span>
        <button
          onClick={() => setIsStreaming(!isStreaming)}
          className="cursor-pointer hover:opacity-80 text-[11px] px-2 py-0.5 rounded-sm"
          style={{
            color: isStreaming ? "#00ff41" : theme.dim,
            border: `1px solid ${isStreaming ? "#00ff41" : theme.dim}`,
          }}
        >
          {isStreaming ? "● LIVE" : "○ PAUSED"}
        </button>
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: theme.dim }}>
          {lines.length} ops
        </span>
      </div>

      {/* Stream output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto terminal-scroll px-2 py-1">
        {lines.map((line, i) => {
          const actionColor = ACTION_COLORS[line.type];
          const icon = ACTION_ICONS[line.type];
          return (
            <div
              key={`${line.id}-${i}`}
              className="flex items-start gap-1.5 py-0.5 hover:bg-white/[0.02] transition-colors"
              style={{
                fontFamily: "monospace",
                animation: i === lines.length - 1 ? "crt-fade-in 0.3s ease-out" : undefined,
              }}
            >
              {/* Timestamp */}
              <span className="text-[11px] tabular-nums shrink-0 w-[58px]" style={{ color: theme.dim }}>
                {line.time}
              </span>
              {/* Agent badge */}
              <span
                className="text-[10px] font-bold shrink-0 w-[44px] text-center py-0.5 rounded-sm"
                style={{
                  color: line.agent === "OPUS" ? "#e879f9" : line.agent === "SONNET" ? "#60a5fa" : "#94a3b8",
                  backgroundColor: "rgba(255,255,255,0.03)",
                }}
              >
                {line.agent}
              </span>
              {/* Action */}
              <span className="text-[12px] shrink-0" style={{ color: actionColor }}>
                {icon}
              </span>
              <span className="text-[12px] font-bold shrink-0 w-[40px]" style={{ color: actionColor }}>
                {line.action}
              </span>
              {/* Detail */}
              <span className="text-[12px] truncate" style={{ color: theme.secondary }}>
                {line.detail}
              </span>
            </div>
          );
        })}

        {/* Streaming cursor */}
        {isStreaming && (
          <div className="flex items-center gap-1 py-0.5" style={{ fontFamily: "monospace" }}>
            <span
              className="inline-block w-[6px] h-[12px]"
              style={{ backgroundColor: theme.primary, animation: "crt-cursor 1s step-end infinite" }}
            />
            <span className="text-[11px]" style={{ color: theme.dim }}>
              awaiting next operation...
            </span>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div
        className="flex items-center gap-4 px-3 py-1 border-t shrink-0"
        style={{ borderColor: theme.dim, fontFamily: "monospace", fontSize: 11 }}
      >
        <span style={{ color: ACTION_COLORS.edit }}>✎ {stats.edits}</span>
        <span style={{ color: ACTION_COLORS.read }}>◎ {stats.reads}</span>
        <span style={{ color: ACTION_COLORS.bash }}>$ {stats.bashes}</span>
        <span className="ml-auto" style={{ color: theme.dim }}>
          {stats.agents} agent{stats.agents !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Fade-in keyframe */}
      <style>{`
        @keyframes crt-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
