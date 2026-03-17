"use client";

import { useMemo } from "react";
import type { ConveyorBelt, Building } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface DataFlowMapProps {
  conveyors: ConveyorBelt[];
  buildings: Building[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

export function DataFlowMap({ conveyors, buildings, theme }: DataFlowMapProps) {
  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  const activeCount = useMemo(() => conveyors.filter((c) => c.active).length, [conveyors]);

  const sortedGroups = useMemo(() => {
    const grouped = new Map<string, ConveyorBelt[]>();
    for (const c of conveyors) {
      const existing = grouped.get(c.fromBuildingId) ?? [];
      existing.push(c);
      grouped.set(c.fromBuildingId, existing);
    }
    return [...grouped.entries()].sort((a, b) => {
      const nameA = buildingMap.get(a[0])?.shortName ?? "";
      const nameB = buildingMap.get(b[0])?.shortName ?? "";
      return nameA.localeCompare(nameB);
    });
  }, [conveyors, buildingMap]);

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b text-[13px] font-bold tracking-[0.15em] uppercase shrink-0"
        style={{ borderColor: theme.dim, color: theme.secondary }}
      >
        <span style={{ color: theme.primary }}>◆</span>
        DATA FLOWS
        <span className="ml-auto font-normal tracking-normal normal-case" style={{ color: theme.dim }}>
          {activeCount}/{conveyors.length} active
        </span>
      </div>

      {/* Flow lines */}
      <div className="flex-1 overflow-y-auto terminal-scroll px-3 py-1.5 font-mono text-[13px] leading-relaxed">
        {sortedGroups.map(([sourceId, flows]) => {
          const source = buildingMap.get(sourceId);
          if (!source) return null;

          return (
            <div key={sourceId} className="mb-2">
              {/* Source building label */}
              <div
                className="text-[13px] font-bold mb-0.5"
                style={{ color: theme.secondary }}
              >
                {source.shortName}
              </div>

              {/* Individual flows from this source */}
              {flows.map((flow) => {
                const target = buildingMap.get(flow.toBuildingId);
                if (!target) return null;

                const arrow = flow.active ? "\u2192" : "x";
                const lineChar = "\u2500";
                const throughputLabel = flow.active
                  ? `${flow.throughput}/s`
                  : "";

                return (
                  <div
                    key={flow.id}
                    className="flex items-center gap-0 text-[13px] pl-2"
                    style={{
                      color: flow.active ? theme.primary : theme.dim,
                      opacity: flow.active ? 1 : 0.5,
                    }}
                  >
                    <span className="w-[36px] text-right shrink-0" style={{ color: flow.active ? source.color : theme.dim }}>
                      {source.shortName}
                    </span>
                    <span className="mx-1">
                      {` ${lineChar}${lineChar}[${flow.dataType}]${lineChar}${lineChar}${arrow} `}
                    </span>
                    <span className="shrink-0" style={{ color: flow.active ? target.color : theme.dim }}>
                      {target.shortName}
                    </span>
                    {throughputLabel && (
                      <span className="ml-2 tabular-nums" style={{ color: theme.dim }}>
                        {throughputLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
