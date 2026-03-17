"use client";
import { useMemo, useState } from "react";
import type { Building, Worker, AlertEvent, ConveyorBelt } from "../game3d/types";
import { WORKER_TYPE_CONFIG } from "../game3d/constants";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { STATUS_CHARS, WORKER_ICONS } from "./terminal-constants";
import { BuildingDetail } from "./BuildingDetail";

interface ProjectQuadrantProps {
  title: string;
  buildings: Building[];
  workers: Worker[];
  events: AlertEvent[];
  conveyors: ConveyorBelt[];
  allBuildings: Building[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

export function ProjectQuadrant({
  title,
  buildings,
  workers,
  events,
  conveyors,
  allBuildings,
  theme,
}: ProjectQuadrantProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Map workers to their current buildings
  const workersByBuilding = useMemo(() => {
    const map: Record<string, Worker[]> = {};
    workers.forEach(w => {
      if (!map[w.currentBuildingId]) map[w.currentBuildingId] = [];
      map[w.currentBuildingId].push(w);
    });
    return map;
  }, [workers]);

  // Get recent events relevant to these buildings
  const relevantEvents = useMemo(() => {
    const buildingNames = buildings.map(b => b.name.toLowerCase());
    return events
      .filter(e => buildingNames.some(name => e.message.toLowerCase().includes(name.split(" ")[0])))
      .slice(-3);
  }, [events, buildings]);

  // Active conveyors touching these buildings
  const activeFlows = useMemo(() => {
    const ids = new Set(buildings.map(b => b.id));
    return conveyors.filter(c => c.active && (ids.has(c.fromBuildingId) || ids.has(c.toBuildingId)));
  }, [buildings, conveyors]);

  const expandedBuilding = expandedId ? buildings.find(b => b.id === expandedId) : null;

  return (
    <div className="terminal-quadrant flex flex-col h-full relative">
      {/* Expanded building detail overlay */}
      {expandedBuilding && (
        <BuildingDetail
          building={expandedBuilding}
          workers={workers}
          conveyors={conveyors}
          allBuildings={allBuildings}
          theme={theme}
          onClose={() => setExpandedId(null)}
        />
      )}

      {/* Quadrant header */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b text-[13px] font-bold tracking-[0.15em] uppercase shrink-0"
        style={{ borderColor: theme.dim, color: theme.secondary }}
      >
        <span style={{ color: theme.primary }}>■</span>
        {title}
        <span className="ml-auto flex items-center gap-2 text-[12px]">
          {activeFlows.length > 0 && (
            <span style={{ color: theme.dim }}>
              {activeFlows.length} flow{activeFlows.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="tabular-nums" style={{ color: theme.primary }}>
            {activeFlows.reduce((sum, f) => sum + f.throughput, 0)}/s
          </span>
        </span>
      </div>

      {/* Building rows */}
      <div className="flex-1 overflow-y-auto terminal-scroll px-2 py-1">
        {buildings.map(building => {
          const bWorkers = workersByBuilding[building.id] || [];
          const statusChar = STATUS_CHARS[building.status] || STATUS_CHARS.idle;
          const statusColor = building.status === "active" ? "#00ff41"
            : building.status === "warning" ? "#ffb000"
            : building.status === "error" ? "#ff3333"
            : theme.dim;

          return (
            <div
              key={building.id}
              className="mb-1.5 py-1 rounded-sm hover:bg-white/[0.04] transition-colors flex cursor-pointer"
              onClick={() => setExpandedId(building.id)}
            >
              {/* Color accent bar */}
              <div
                className="w-[3px] shrink-0 rounded-sm mr-2"
                style={{
                  backgroundColor: building.status === "active" ? building.color : "transparent",
                  opacity: building.status === "active" ? 0.6 : 0,
                }}
              />
              <div className="flex-1 min-w-0">
                {/* Building header line */}
                <div className="flex items-center gap-2 text-[14px] font-mono">
                  <span style={{ color: statusColor }}>{statusChar}</span>
                  <span style={{ color: theme.primary }} className="font-bold tracking-wider">
                    {building.shortName}
                  </span>
                  <span style={{ color: theme.dim }} className="text-[12px] truncate">
                    {building.name}
                  </span>
                  <span className="ml-auto text-[12px] tabular-nums" style={{ color: theme.dim }}>
                    {building.stats.uptime}
                  </span>
                </div>

                {/* Description */}
                <div className="text-[11px] mt-0.5 pl-4 truncate" style={{ color: theme.dim }}>
                  {building.description}
                </div>

                {/* Stats line */}
                <div className="flex items-center gap-3 text-[12px] mt-0.5 pl-4" style={{ color: theme.dim }}>
                  <span>tests:{building.stats.tests}</span>
                  <span>deploys:{building.stats.deploys}</span>
                  {bWorkers.length > 0 && (
                    <span style={{ color: theme.secondary }}>
                      agents:{bWorkers.length}
                    </span>
                  )}
                </div>

                {/* Workers assigned */}
                {bWorkers.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5 pl-4">
                    {bWorkers.map(w => {
                      const icon = WORKER_ICONS[w.type] || "?";
                      const workerColor = WORKER_TYPE_CONFIG[w.type]?.color || theme.primary;
                      return (
                        <div key={w.id} className="flex items-center gap-1 text-[12px]">
                          <span style={{ color: workerColor }}>{icon}</span>
                          <span style={{ color: theme.secondary }}>{w.name}</span>
                          {w.status === "working" && (
                            <>
                              <span className="tabular-nums" style={{ color: theme.dim }}>
                                {w.progress}%
                              </span>
                              {/* ASCII progress bar */}
                              <span style={{ color: theme.dim }}>
                                [
                                <span style={{ color: workerColor }}>
                                  {"█".repeat(Math.floor(w.progress / 10))}
                                </span>
                                {"░".repeat(10 - Math.floor(w.progress / 10))}
                                ]
                              </span>
                            </>
                          )}
                          {w.status === "moving" && (
                            <span style={{ color: theme.dim }} className="text-[11px]">
                              → {w.task.slice(0, 20)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini event ticker at bottom */}
      {relevantEvents.length > 0 && (
        <div className="shrink-0 border-t px-3 py-0.5" style={{ borderColor: theme.dim }}>
          {relevantEvents.slice(-1).map(e => (
            <div key={e.id} className="text-[11px] truncate" style={{ color: theme.dim }}>
              <span className="tabular-nums">{e.time}</span>{" "}
              <span style={{ color: e.type === "error" ? "#ff3333" : e.type === "success" ? "#00ff41" : theme.dim }}>
                {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
