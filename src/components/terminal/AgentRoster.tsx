"use client";
import { useMemo } from "react";
import type { Worker, Building } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { WORKER_ICONS } from "./terminal-constants";
import { WORKER_TYPE_CONFIG } from "../game3d/constants";

interface AgentRosterProps {
  workers: Worker[];
  buildings: Building[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  selectedAgentId?: string | null;
  onSelectAgent?: (workerId: string | null) => void;
}

const STATUS_ORDER: Record<Worker["status"], number> = {
  working: 0,
  moving: 1,
  idle: 2,
};

function buildProgressBar(progress: number, color: string): React.ReactNode {
  const filled = Math.floor(progress / 10);
  const empty = 10 - filled;
  return (
    <span>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>[</span>
      <span style={{ color }}>{"█".repeat(filled)}</span>
      <span style={{ color: "rgba(255,255,255,0.15)" }}>{"░".repeat(empty)}</span>
      <span style={{ color: "rgba(255,255,255,0.25)" }}>]</span>
      <span style={{ color, marginLeft: 4, fontSize: 11 }}>{progress}%</span>
    </span>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function AgentRoster({ workers, buildings, theme, selectedAgentId, onSelectAgent }: AgentRosterProps) {
  const buildingMap = useMemo(() => {
    const map: Record<string, Building> = {};
    for (const b of buildings) {
      map[b.id] = b;
    }
    return map;
  }, [buildings]);

  const sorted = useMemo(
    () => [...workers].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [workers],
  );

  const activeCount = useMemo(
    () => workers.filter((w) => w.status === "working" || w.status === "moving").length,
    [workers],
  );

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* ── Injected transit animation keyframes ── */}
      <style>{`
        @keyframes crt-transit-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .crt-transit {
          animation: crt-transit-pulse 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b shrink-0"
        style={{
          borderColor: theme.dim,
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        <span style={{ color: theme.primary, fontWeight: 700, letterSpacing: "0.15em" }}>
          ◆ AGENT ROSTER
        </span>
        <span
          style={{
            marginLeft: "auto",
            color: theme.secondary,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          <span style={{ color: theme.primary, fontWeight: 700 }}>{activeCount}</span>
          <span style={{ color: theme.dim }}>/{workers.length} active</span>
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto terminal-scroll px-2 py-1">
        {sorted.map((w) => {
          const icon = WORKER_ICONS[w.type] || "?";
          const typeConfig = WORKER_TYPE_CONFIG[w.type];
          const workerColor = typeConfig?.color || theme.primary;
          const currentBuilding = buildingMap[w.currentBuildingId];
          const targetBuilding = buildingMap[w.targetBuildingId];

          const statusLabel =
            w.status === "working"
              ? "WORKING"
              : w.status === "moving"
                ? "TRANSIT"
                : "IDLE";

          const statusColor =
            w.status === "working"
              ? "#00ff41"
              : w.status === "moving"
                ? "#ffb000"
                : theme.dim;

          const isSelected = selectedAgentId === w.id;

          return (
            <div
              key={w.id}
              className="rounded-sm hover:bg-white/[0.04] transition-colors py-1.5 px-1 cursor-pointer"
              style={{
                fontFamily: "monospace",
                backgroundColor: isSelected ? "rgba(255,255,255,0.08)" : undefined,
                borderLeft: isSelected ? `2px solid ${theme.primary}` : "2px solid transparent",
              }}
              onClick={() => onSelectAgent?.(isSelected ? null : w.id)}
            >
              {/* ── Row 1: Icon, Name, Level, Status badge ── */}
              <div className="flex items-center gap-2" style={{ fontSize: 14 }}>
                <span style={{ color: workerColor, fontSize: 14 }}>{icon}</span>
                <span style={{ color: theme.primary, fontWeight: 700, fontSize: 14 }}>
                  {w.name}
                </span>
                <span style={{ color: theme.dim, fontSize: 11 }}>LVL {w.level}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    border: `1px solid ${statusColor}`,
                    padding: "0 5px",
                    borderRadius: 2,
                    lineHeight: "18px",
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {/* ── Row 2+: Status-specific detail lines ── */}
              {w.status === "working" && (
                <div className="pl-5 mt-0.5">
                  {/* Building location */}
                  {currentBuilding && (
                    <div style={{ fontSize: 12, color: theme.dim }}>
                      <span style={{ color: currentBuilding.color }}>
                        @ {currentBuilding.shortName}
                      </span>
                    </div>
                  )}
                  {/* Task */}
                  <div style={{ fontSize: 12, color: theme.dim }}>{truncate(w.task, 30)}</div>
                  {/* Progress bar */}
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    {buildProgressBar(w.progress, workerColor)}
                  </div>
                </div>
              )}

              {w.status === "moving" && (
                <div className="pl-5 mt-0.5">
                  {/* Transit animation line */}
                  <div style={{ fontSize: 13, letterSpacing: "0.05em" }}>
                    <span style={{ color: currentBuilding?.color || theme.dim, fontWeight: 700 }}>
                      {currentBuilding?.shortName || "???"}
                    </span>
                    <span style={{ color: theme.primary }}> ═══</span>
                    <span className="crt-transit" style={{ color: theme.primary }}>
                      ▸▸▸
                    </span>
                    <span style={{ color: theme.primary }}>═══→ </span>
                    <span style={{ color: targetBuilding?.color || theme.dim, fontWeight: 700 }}>
                      {targetBuilding?.shortName || "???"}
                    </span>
                  </div>
                  {/* Task */}
                  <div style={{ fontSize: 12, color: theme.dim, marginTop: 1 }}>
                    {truncate(w.task, 30)}
                  </div>
                </div>
              )}

              {w.status === "idle" && (
                <div className="pl-5 mt-0.5">
                  {/* Last location */}
                  {currentBuilding && (
                    <div style={{ fontSize: 12, color: theme.dim }}>
                      @ {currentBuilding.shortName}
                    </div>
                  )}
                  {/* Task or fallback */}
                  <div style={{ fontSize: 12, color: theme.dim }}>
                    {w.task ? truncate(w.task, 30) : "Awaiting mission"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selection hint */}
      {selectedAgentId && (
        <div
          className="shrink-0 border-t px-3 py-1 text-center"
          style={{
            borderColor: theme.dim,
            fontSize: 11,
            fontFamily: "monospace",
            color: theme.primary,
            animation: "crt-transit-pulse 1.2s ease-in-out infinite",
          }}
        >
          ▸ Click a building to assign agent ▸
        </div>
      )}
    </div>
  );
}
