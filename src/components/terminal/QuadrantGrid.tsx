"use client";
import { useMemo } from "react";
import type { Building, Worker, AlertEvent, ConveyorBelt } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { ProjectQuadrant } from "./ProjectQuadrant";

const QUADRANT_GROUPS: Record<string, string[]> = {
  COMMAND:  ["command-center", "nexus-hq", "buildkit"],
  PRODUCTS: ["pc-bottleneck", "finance-brief", "chess-academy"],
  CLIENTS:  ["barrelhouse", "outdoor-crm", "email-finder"],
  OPS:      ["automation-hub", "mcp-array", "pl-engine"],
};

interface QuadrantGridProps {
  buildings: Building[];
  workers: Worker[];
  events: AlertEvent[];
  conveyors: ConveyorBelt[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

export function QuadrantGrid({ buildings, workers, events, conveyors, theme }: QuadrantGridProps) {
  const quadrants = useMemo(() => {
    return Object.entries(QUADRANT_GROUPS).map(([title, ids]) => ({
      title,
      buildings: ids.map(id => buildings.find(b => b.id === id)).filter(Boolean) as Building[],
    }));
  }, [buildings]);

  const gridAreas = ["terminal-q1", "terminal-q2", "terminal-q3", "terminal-q4"];

  return (
    <>
      {quadrants.map((q, i) => (
        <div key={q.title} className={gridAreas[i]}>
          <ProjectQuadrant
            title={q.title}
            buildings={q.buildings}
            workers={workers}
            events={events}
            conveyors={conveyors}
            allBuildings={buildings}
            theme={theme}
          />
        </div>
      ))}
    </>
  );
}
