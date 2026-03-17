"use client";

import { useMemo } from "react";
import type { AgentActivity } from "@/lib/types";
import type { NexusSession } from "@/lib/collector-types";

interface TimelineStripProps {
  agents: AgentActivity[];
  sessions: NexusSession[];
}

/**
 * Bottom timeline strip — 32px tall, shows 24h activity as a dense bar.
 * Each event is a tiny colored tick mark on the timeline.
 */
export function TimelineStrip({ agents, sessions }: TimelineStripProps) {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000; // 24 hours
  const startTime = now - windowMs;

  const ticks = useMemo(() => {
    const items: Array<{
      id: string;
      time: number;
      color: string;
      label: string;
    }> = [];

    for (const agent of agents) {
      const t = new Date(agent.started_at).getTime();
      if (t < startTime) continue;
      const color =
        agent.status === "completed"
          ? "#34d399"
          : agent.status === "failed"
            ? "#f87171"
            : agent.status === "running"
              ? "#22d3ee"
              : "#334155";
      items.push({ id: agent.id, time: t, color, label: agent.agent_name });
    }

    for (const session of sessions) {
      const t = new Date(session.started_at).getTime();
      if (t < startTime) continue;
      const color =
        session.status === "active"
          ? "#a78bfa"
          : session.status === "completed"
            ? "#34d399"
            : "#334155";
      items.push({
        id: session.session_id,
        time: t,
        color,
        label: session.project_name || "session",
      });
    }

    return items.sort((a, b) => a.time - b.time);
  }, [agents, sessions, startTime]);

  // Hour markers
  const hours = useMemo(() => {
    const h: Array<{ label: string; pct: number }> = [];
    const d = new Date(startTime);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    while (d.getTime() < now) {
      const pct = ((d.getTime() - startTime) / windowMs) * 100;
      h.push({
        label: d.getHours().toString().padStart(2, "0") + ":00",
        pct,
      });
      d.setHours(d.getHours() + 1);
    }
    return h;
  }, [startTime, now, windowMs]);

  return (
    <div
      className="ops-timeline"
      style={{
        background: "#080b12",
        borderTop: "1px solid #1a2235",
        height: 32,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 8,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
          color: "#334155",
          flexShrink: 0,
          width: 56,
        }}
      >
        24H
      </span>

      {/* Timeline bar */}
      <div
        style={{
          flex: 1,
          height: 16,
          position: "relative",
          background: "#0c1018",
          borderRadius: 2,
          border: "1px solid #1a2235",
          overflow: "hidden",
        }}
      >
        {/* Hour markers */}
        {hours.map((h) => (
          <div
            key={h.label}
            style={{
              position: "absolute",
              left: `${h.pct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: "#1a2235",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -1,
                left: 2,
                fontSize: 7,
                color: "#1e3a5f",
                whiteSpace: "nowrap" as const,
              }}
            >
              {h.label}
            </span>
          </div>
        ))}

        {/* Event ticks */}
        {ticks.map((tick) => {
          const pct = ((tick.time - startTime) / windowMs) * 100;
          return (
            <div
              key={tick.id}
              title={tick.label}
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: 2,
                bottom: 2,
                width: 3,
                borderRadius: 1,
                background: tick.color,
                opacity: 0.7,
              }}
            />
          );
        })}

        {/* "Now" marker */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "#22d3ee",
            boxShadow: "0 0 4px rgba(34,211,238,0.5)",
          }}
        />
      </div>

      {/* Event count */}
      <span
        style={{
          fontSize: 9,
          color: "#334155",
          flexShrink: 0,
        }}
      >
        {ticks.length} events
      </span>
    </div>
  );
}
