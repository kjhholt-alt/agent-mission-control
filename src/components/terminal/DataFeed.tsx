"use client";
import { useRef, useEffect } from "react";
import type { AlertEvent } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface DataFeedProps {
  events: AlertEvent[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  maxLines?: number;
  title?: string;
}

export function DataFeed({ events, theme, maxLines = 50, title = "EVENT LOG" }: DataFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const typePrefix = (type: AlertEvent["type"]) => {
    switch (type) {
      case "success": return { char: "\u2713", color: "#00ff41" };
      case "error":   return { char: "\u2716", color: "#ff3333" };
      case "warning": return { char: "\u25B2", color: "#ffb000" };
      case "info":    return { char: "\u25CF", color: theme.primary };
    }
  };

  const visibleEvents = events.slice(-maxLines);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b text-[10px] font-bold tracking-widest uppercase"
        style={{ borderColor: theme.dim, color: theme.dim }}
      >
        <span style={{ color: theme.primary }}>{"\u25B8"}</span>
        {title}
        <span className="ml-auto tabular-nums" style={{ color: theme.secondary }}>
          [{visibleEvents.length}]
        </span>
      </div>

      {/* Scrolling log */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px] leading-relaxed"
        style={{ scrollbarWidth: "thin", scrollbarColor: `${theme.dim} transparent` }}
      >
        {visibleEvents.map((event) => {
          const prefix = typePrefix(event.type);
          return (
            <div key={event.id} className="flex gap-2 py-px hover:bg-white/[0.02]">
              <span className="tabular-nums shrink-0" style={{ color: theme.dim }}>
                {event.time}
              </span>
              <span style={{ color: prefix.color }}>{prefix.char}</span>
              <span style={{ color: event.type === "error" ? "#ff3333" : theme.primary }} className="break-all">
                {event.message}
              </span>
            </div>
          );
        })}
        {/* Blinking cursor at bottom */}
        <div className="flex items-center gap-1 py-px">
          <span style={{ color: theme.dim }}>{">"}</span>
          <span
            className="inline-block w-[7px] h-[13px] animate-pulse"
            style={{ backgroundColor: theme.primary }}
          />
        </div>
      </div>
    </div>
  );
}
