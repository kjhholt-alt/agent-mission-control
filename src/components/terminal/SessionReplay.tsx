"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { TERMINAL_THEMES } from "./terminal-constants";
import type { HookEvent } from "../game3d/useGameData";

interface SessionReplayProps {
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  hookEvents: HookEvent[];
}

type ActionType = "tool" | "edit" | "read" | "bash" | "write" | "think" | "spawn" | "complete" | "stop";

function classifyEvent(e: HookEvent): ActionType {
  if (e.event_type === "Stop") return "stop";
  const tool = (e.tool_name || "").toLowerCase();
  if (tool.includes("read") || tool === "glob" || tool === "grep") return "read";
  if (tool.includes("edit")) return "edit";
  if (tool.includes("write")) return "write";
  if (tool.includes("bash")) return "bash";
  if (tool.includes("agent") || tool.includes("spawn")) return "spawn";
  if (e.event_type === "PostToolUse") return "complete";
  return "tool";
}

function modelBadge(model: string | null): string {
  if (!model) return "???";
  if (model.includes("opus")) return "OPUS";
  if (model.includes("sonnet")) return "SNNT";
  if (model.includes("haiku")) return "HAIK";
  return model.slice(0, 4).toUpperCase();
}

const ACTION_COLORS: Record<ActionType, string> = {
  read: "#60a5fa",
  edit: "#fbbf24",
  write: "#34d399",
  bash: "#a78bfa",
  think: "#94a3b8",
  spawn: "#f472b6",
  complete: "#00ff41",
  tool: "#06b6d4",
  stop: "#ef4444",
};

const ACTION_ICONS: Record<ActionType, string> = {
  read: "◎",
  edit: "✎",
  write: "✚",
  bash: "$",
  think: "◇",
  spawn: "⚡",
  complete: "✓",
  tool: "⊕",
  stop: "■",
};

export function SessionReplay({ theme, hookEvents }: SessionReplayProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(hookEvents.length);

  // Auto-scroll when new events arrive (not when paused)
  useEffect(() => {
    if (!isPaused && hookEvents.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0; // newest at top
    }
    prevLengthRef.current = hookEvents.length;
  }, [hookEvents.length, isPaused]);

  // Filter events
  const displayEvents = useMemo(() => {
    let events = hookEvents;
    if (filter) {
      events = events.filter(e =>
        (e.project_name || "").toLowerCase().includes(filter.toLowerCase()) ||
        (e.tool_name || "").toLowerCase().includes(filter.toLowerCase())
      );
    }
    return events.slice(0, 60);
  }, [hookEvents, filter]);

  // Stats
  const stats = useMemo(() => {
    const edits = hookEvents.filter(e => classifyEvent(e) === "edit").length;
    const reads = hookEvents.filter(e => classifyEvent(e) === "read").length;
    const bashes = hookEvents.filter(e => classifyEvent(e) === "bash").length;
    const sessions = new Set(hookEvents.map(e => e.session_id)).size;
    return { edits, reads, bashes, sessions };
  }, [hookEvents]);

  // Unique projects for filter
  const projects = useMemo(() => {
    const set = new Set<string>();
    hookEvents.forEach(e => { if (e.project_name) set.add(e.project_name); });
    return [...set].slice(0, 8);
  }, [hookEvents]);

  const isLive = hookEvents.length > 0;

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
          onClick={() => setIsPaused(!isPaused)}
          className="cursor-pointer hover:opacity-80 text-[11px] px-2 py-0.5 rounded-sm"
          style={{
            color: !isPaused && isLive ? "#00ff41" : theme.dim,
            border: `1px solid ${!isPaused && isLive ? "#00ff41" : theme.dim}`,
          }}
        >
          {!isPaused && isLive ? "● LIVE" : "○ PAUSED"}
        </button>
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: theme.dim }}>
          {hookEvents.length} ops
        </span>
      </div>

      {/* Project filter bar */}
      {projects.length > 1 && (
        <div className="flex gap-1 px-2 py-0.5 shrink-0 overflow-x-auto" style={{ borderBottom: `1px solid ${theme.dim}` }}>
          <button
            onClick={() => setFilter(null)}
            className="text-[9px] px-1.5 py-0.5 rounded-sm cursor-pointer shrink-0"
            style={{
              color: !filter ? theme.primary : theme.dim,
              backgroundColor: !filter ? "rgba(255,255,255,0.05)" : "transparent",
            }}
          >
            ALL
          </button>
          {projects.map(p => (
            <button
              key={p}
              onClick={() => setFilter(filter === p ? null : p)}
              className="text-[9px] px-1.5 py-0.5 rounded-sm cursor-pointer shrink-0 truncate max-w-[80px]"
              style={{
                color: filter === p ? theme.primary : theme.dim,
                backgroundColor: filter === p ? "rgba(255,255,255,0.05)" : "transparent",
              }}
            >
              {p.replace(/-/g, " ").slice(0, 12)}
            </button>
          ))}
        </div>
      )}

      {/* Stream output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto terminal-scroll px-2 py-1">
        {displayEvents.length === 0 && (
          <div className="text-center py-4" style={{ color: theme.dim, fontFamily: "monospace", fontSize: 12 }}>
            No hook events yet — start a Claude Code session to see live ops
          </div>
        )}
        {displayEvents.map((event, i) => {
          const actionType = classifyEvent(event);
          const actionColor = ACTION_COLORS[actionType];
          const icon = ACTION_ICONS[actionType];
          const time = new Date(event.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const badge = modelBadge(event.model);
          const detail = event.event_type === "Stop"
            ? `Session ended — ${event.project_name || "unknown"}`
            : event.tool_name
              ? `${event.tool_name}`
              : event.event_type;

          return (
            <div
              key={event.id}
              className="flex items-start gap-1.5 py-0.5 hover:bg-white/[0.02] transition-colors"
              style={{
                fontFamily: "monospace",
                animation: i === 0 && !isPaused ? "crt-fade-in 0.3s ease-out" : undefined,
              }}
            >
              {/* Timestamp */}
              <span className="text-[11px] tabular-nums shrink-0 w-[58px]" style={{ color: theme.dim }}>
                {time}
              </span>
              {/* Event type badge */}
              <span
                className="text-[9px] font-bold shrink-0 w-[28px] text-center py-0.5 rounded-sm uppercase"
                style={{
                  color: event.event_type === "PreToolUse" ? "#ffb000" : event.event_type === "PostToolUse" ? "#00ff41" : "#ef4444",
                  backgroundColor: "rgba(255,255,255,0.03)",
                }}
              >
                {event.event_type === "PreToolUse" ? "PRE" : event.event_type === "PostToolUse" ? "POST" : "END"}
              </span>
              {/* Action icon */}
              <span className="text-[12px] shrink-0" style={{ color: actionColor }}>
                {icon}
              </span>
              {/* Project */}
              <span className="text-[10px] shrink-0 w-[60px] truncate" style={{ color: theme.dim }}>
                {(event.project_name || "???").slice(0, 10)}
              </span>
              {/* Detail */}
              <span className="text-[12px] truncate" style={{ color: theme.secondary }}>
                {detail}
              </span>
            </div>
          );
        })}

        {/* Live cursor */}
        {!isPaused && isLive && (
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
          {stats.sessions} session{stats.sessions !== 1 ? "s" : ""}
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
