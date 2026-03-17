"use client";

import type { Building, Worker, ConveyorBelt } from "../game3d/types";
import { WORKER_TYPE_CONFIG } from "../game3d/constants";
import { ASCII_BUILDINGS, STATUS_CHARS, WORKER_ICONS } from "./terminal-constants";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface BuildingDetailProps {
  building: Building;
  workers: Worker[];
  conveyors: ConveyorBelt[];
  allBuildings: Building[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  onClose: () => void;
}

export function BuildingDetail({
  building,
  workers,
  conveyors,
  allBuildings,
  theme,
  onClose,
}: BuildingDetailProps) {
  const statusChar = STATUS_CHARS[building.status] || STATUS_CHARS.idle;
  const statusColor =
    building.status === "active" ? "#00ff41"
    : building.status === "warning" ? "#ffb000"
    : building.status === "error" ? "#ff3333"
    : theme.dim;

  // Workers at this building
  const localWorkers = workers.filter(w => w.currentBuildingId === building.id);
  const inbound = workers.filter(w => w.targetBuildingId === building.id && w.status === "moving");

  // Conveyors connected
  const flows = conveyors.filter(c => c.fromBuildingId === building.id || c.toBuildingId === building.id);
  const activeFlows = flows.filter(c => c.active);

  // Escape handled by parent GamePage — no duplicate listener needed

  // ASCII art
  const sizeKey = building.size >= 2.5 ? "large" : building.size >= 1.75 ? "medium" : "small";
  const art = ASCII_BUILDINGS[sizeKey].map(line => line.replace("{id}", building.shortName.padEnd(3)));

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col overflow-y-auto terminal-scroll"
      style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
        style={{ borderColor: theme.dim }}
      >
        <span style={{ color: statusColor }} className="text-[16px]">{statusChar}</span>
        <span className="crt-glow font-bold text-[16px] tracking-wider" style={{ color: theme.primary }}>
          {building.shortName}
        </span>
        <span style={{ color: theme.secondary }} className="text-[14px]">
          {building.name}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-[13px] tracking-wider hover:opacity-80 cursor-pointer px-2 py-0.5"
          style={{ color: theme.dim, border: `1px solid ${theme.dim}` }}
        >
          [ESC] CLOSE
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 grid grid-cols-2 gap-6">
        {/* Left: ASCII art + status */}
        <div>
          {/* ASCII Building */}
          <div className="font-mono text-[14px] leading-tight whitespace-pre mb-4" style={{ color: building.status === "active" ? theme.primary : theme.dim }}>
            {art.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

          {/* Status block */}
          <div className="space-y-1.5 text-[13px]">
            <div>
              <span style={{ color: theme.dim }}>STATUS: </span>
              <span style={{ color: statusColor }} className="font-bold uppercase">{building.status}</span>
            </div>
            <div>
              <span style={{ color: theme.dim }}>UPTIME: </span>
              <span style={{ color: theme.primary }}>{building.stats.uptime}</span>
            </div>
            <div>
              <span style={{ color: theme.dim }}>TESTS:  </span>
              <span style={{ color: theme.primary }}>{building.stats.tests}</span>
            </div>
            <div>
              <span style={{ color: theme.dim }}>DEPLOY: </span>
              <span style={{ color: theme.primary }}>{building.stats.deploys}</span>
            </div>
            <div className="pt-1">
              <span style={{ color: theme.dim }}>DESC:   </span>
              <span style={{ color: theme.secondary }} className="text-[12px]">{building.description}</span>
            </div>
          </div>
        </div>

        {/* Right: Workers + Flows */}
        <div>
          {/* Workers section */}
          <div className="mb-4">
            <div className="text-[13px] font-bold tracking-wider mb-1.5" style={{ color: theme.secondary }}>
              AGENTS ({localWorkers.length})
            </div>
            {localWorkers.length === 0 ? (
              <div className="text-[12px]" style={{ color: theme.dim }}>No agents assigned</div>
            ) : (
              <div className="space-y-1">
                {localWorkers.map(w => {
                  const icon = WORKER_ICONS[w.type] || "?";
                  const wColor = WORKER_TYPE_CONFIG[w.type]?.color || theme.primary;
                  return (
                    <div key={w.id} className="text-[13px]">
                      <span style={{ color: wColor }}>{icon} {w.name}</span>
                      <span style={{ color: theme.dim }}> ({w.type}) </span>
                      {w.status === "working" && (
                        <span>
                          <span style={{ color: theme.dim }}>[</span>
                          <span style={{ color: wColor }}>{"█".repeat(Math.floor(w.progress / 10))}</span>
                          <span style={{ color: theme.dim }}>{"░".repeat(10 - Math.floor(w.progress / 10))}] {w.progress}%</span>
                        </span>
                      )}
                      {w.status === "idle" && (
                        <span style={{ color: theme.dim }}>IDLE</span>
                      )}
                      <div className="text-[11px] pl-4" style={{ color: theme.dim }}>{w.task}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inbound agents */}
            {inbound.length > 0 && (
              <div className="mt-2">
                <div className="text-[12px]" style={{ color: theme.dim }}>
                  INBOUND ({inbound.length}):
                </div>
                {inbound.map(w => (
                  <div key={w.id} className="text-[12px] pl-2" style={{ color: theme.secondary }}>
                    → {w.name} ({w.type})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data flows */}
          <div>
            <div className="text-[13px] font-bold tracking-wider mb-1.5" style={{ color: theme.secondary }}>
              DATA FLOWS ({activeFlows.length} active)
            </div>
            {flows.length === 0 ? (
              <div className="text-[12px]" style={{ color: theme.dim }}>No connections</div>
            ) : (
              <div className="space-y-1">
                {flows.map(f => {
                  const fromB = allBuildings.find(b => b.id === f.fromBuildingId);
                  const toB = allBuildings.find(b => b.id === f.toBuildingId);
                  const isOutbound = f.fromBuildingId === building.id;
                  return (
                    <div key={f.id} className="text-[12px] flex items-center gap-1">
                      <span style={{ color: f.active ? theme.primary : theme.dim }}>
                        {f.active ? "●" : "○"}
                      </span>
                      <span style={{ color: theme.secondary }}>
                        {isOutbound ? building.shortName : (fromB?.shortName || "?")}
                      </span>
                      <span style={{ color: theme.dim }}>→</span>
                      <span style={{ color: theme.secondary }}>
                        {isOutbound ? (toB?.shortName || "?") : building.shortName}
                      </span>
                      <span style={{ color: theme.dim }}>
                        [{f.dataType}]
                      </span>
                      {f.active && (
                        <span className="tabular-nums" style={{ color: theme.primary }}>
                          {f.throughput}/s
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
