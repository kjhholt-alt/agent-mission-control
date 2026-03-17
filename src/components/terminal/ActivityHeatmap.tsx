"use client";
import { useState, useEffect, useMemo } from "react";
import type { Building, AlertEvent } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface ActivityHeatmapProps {
  buildings: Building[];
  events: AlertEvent[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

const BUCKET_COUNT = 12;
const BUCKET_SECONDS = 5;

function getBlockChar(count: number): string {
  if (count === 0) return "·";
  if (count === 1) return "░";
  if (count <= 3) return "▒";
  return "█";
}

function getBlockColor(
  count: number,
  theme: ActivityHeatmapProps["theme"],
): string {
  if (count === 0) return theme.dim;
  if (count === 1) return theme.dim;
  if (count <= 3) return theme.secondary;
  return theme.primary;
}

/**
 * Extract the first word of a building name for matching against event messages.
 */
function buildingKeyword(building: Building): string {
  return building.name.split(/\s+/)[0].toLowerCase();
}

export function ActivityHeatmap({
  buildings,
  events,
  theme,
}: ActivityHeatmapProps) {
  // Map<buildingId, number[]> — each array has BUCKET_COUNT entries
  const [buckets, setBuckets] = useState<Map<string, number[]>>(() => {
    const m = new Map<string, number[]>();
    for (const b of buildings) {
      m.set(b.id, new Array(BUCKET_COUNT).fill(0));
    }
    return m;
  });

  // Track the event count snapshot at each tick so we can diff
  const [lastEventCount, setLastEventCount] = useState(events.length);

  // Re-initialise rows when the building list changes
  useEffect(() => {
    setBuckets((prev) => {
      const next = new Map<string, number[]>();
      for (const b of buildings) {
        next.set(
          b.id,
          prev.get(b.id) ?? new Array(BUCKET_COUNT).fill(0),
        );
      }
      return next;
    });
  }, [buildings]);

  // Every BUCKET_SECONDS, shift the window and count new events
  useEffect(() => {
    const interval = setInterval(() => {
      setBuckets((prev) => {
        const next = new Map<string, number[]>();
        // Count new events since last tick
        const newEvents = events.slice(lastEventCount);

        for (const b of buildings) {
          const keyword = buildingKeyword(b);
          const count = newEvents.filter((e) =>
            e.message.toLowerCase().includes(keyword),
          ).length;

          const old = prev.get(b.id) ?? new Array(BUCKET_COUNT).fill(0);
          // Shift left, push new count
          const shifted = [...old.slice(1), count];
          next.set(b.id, shifted);
        }

        return next;
      });
      setLastEventCount(events.length);
    }, BUCKET_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [buildings, events, lastEventCount]);

  // Hottest building + total events
  const { hottest, totalEvents } = useMemo(() => {
    let maxSum = 0;
    let hottestBuilding: Building | null = null;
    let total = 0;

    for (const b of buildings) {
      const row = buckets.get(b.id);
      if (!row) continue;
      const sum = row.reduce((a, c) => a + c, 0);
      total += sum;
      if (sum > maxSum) {
        maxSum = sum;
        hottestBuilding = b;
      }
    }

    return {
      hottest: hottestBuilding,
      totalEvents: total,
    };
  }, [buildings, buckets]);

  // Column headers: 0s  5s  10s ... 55s
  const colHeaders = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const s = String(i * BUCKET_SECONDS) + "s";
      labels.push(s.padEnd(4));
    }
    return labels;
  }, []);

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b text-[13px] font-bold tracking-widest uppercase"
        style={{ borderColor: theme.dim, color: theme.dim }}
      >
        <span style={{ color: theme.primary }}>◆</span>
        ACTIVITY HEATMAP
        <span
          className="ml-auto tabular-nums"
          style={{ color: theme.secondary, fontSize: 13 }}
        >
          last 60s
        </span>
      </div>

      {/* Grid */}
      <div
        className="terminal-scroll flex-1 overflow-y-auto px-3 py-1.5"
        style={{ whiteSpace: "pre", fontFamily: "monospace", fontSize: 12 }}
      >
        {/* Column headers */}
        <div className="flex" style={{ color: theme.dim }}>
          {/* Spacer for row labels */}
          <span style={{ display: "inline-block", width: "5ch" }} />
          {colHeaders.map((label, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: "4ch",
                textAlign: "center",
              }}
            >
              {label.trimEnd()}
            </span>
          ))}
        </div>

        {/* Building rows */}
        {buildings.map((b) => {
          const row = buckets.get(b.id) ?? new Array(BUCKET_COUNT).fill(0);
          return (
            <div key={b.id} className="flex items-center" style={{ lineHeight: "18px" }}>
              {/* Row label */}
              <span
                style={{
                  display: "inline-block",
                  width: "5ch",
                  color: b.color,
                  overflow: "hidden",
                }}
              >
                {b.shortName.slice(0, 4).padEnd(4)}
              </span>
              {/* Cells */}
              {row.map((count, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    width: "4ch",
                    textAlign: "center",
                    color: getBlockColor(count, theme),
                    transition: "color 0.3s ease",
                  }}
                >
                  {getBlockChar(count)}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* Bottom stats */}
      <div
        className="flex items-center gap-4 px-3 py-1 border-t"
        style={{
          borderColor: theme.dim,
          fontSize: 11,
          fontFamily: "monospace",
          color: theme.dim,
        }}
      >
        <span>
          HOTTEST:{" "}
          <span style={{ color: hottest?.color ?? theme.secondary }}>
            {hottest?.shortName ?? "---"}
          </span>
        </span>
        <span>
          TOTAL:{" "}
          <span style={{ color: theme.secondary }}>
            {totalEvents}
          </span>{" "}
          events
        </span>
      </div>
    </div>
  );
}
