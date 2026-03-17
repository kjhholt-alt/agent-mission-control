"use client";
import { useMemo } from "react";
import type { Building, Worker, ConveyorBelt } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { STATUS_CHARS, WORKER_ICONS } from "./terminal-constants";

interface MinimapProps {
  buildings: Building[];
  workers: Worker[];
  conveyors: ConveyorBelt[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

// Map buildings to a 30x16 ASCII grid based on their gridX/gridY coordinates
// gridX ranges 2-28, gridY ranges 2-28 → normalize to fit
const MAP_W = 36;
const MAP_H = 14;

function normalize(gridX: number, gridY: number): [number, number] {
  // gridX: 2-28 → columns 1-34
  // gridY: 2-28 → rows 1-12
  const col = Math.round(((gridX - 2) / 26) * (MAP_W - 4)) + 2;
  const row = Math.round(((gridY - 2) / 26) * (MAP_H - 3)) + 1;
  return [col, row];
}

export function Minimap({ buildings, workers, conveyors, theme }: MinimapProps) {
  // Worker count per building
  const workerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of workers) {
      map[w.currentBuildingId] = (map[w.currentBuildingId] || 0) + 1;
    }
    return map;
  }, [workers]);

  // Active conveyor lookup
  const activeConveyors = useMemo(
    () => conveyors.filter((c) => c.active),
    [conveyors],
  );

  // Build the ASCII grid
  const grid = useMemo(() => {
    // Initialize empty grid
    const rows: string[][] = [];
    const colors: (string | null)[][] = [];
    for (let r = 0; r < MAP_H; r++) {
      rows.push(new Array(MAP_W).fill(" "));
      colors.push(new Array(MAP_W).fill(null));
    }

    // Draw border
    for (let c = 0; c < MAP_W; c++) {
      rows[0][c] = c === 0 ? "┌" : c === MAP_W - 1 ? "┐" : "─";
      rows[MAP_H - 1][c] = c === 0 ? "└" : c === MAP_W - 1 ? "┘" : "─";
    }
    for (let r = 1; r < MAP_H - 1; r++) {
      rows[r][0] = "│";
      rows[r][MAP_W - 1] = "│";
    }

    // Place buildings
    const placed: { id: string; col: number; row: number }[] = [];
    for (const b of buildings) {
      const [col, row] = normalize(b.gridX, b.gridY);
      const safeRow = Math.max(1, Math.min(MAP_H - 2, row));
      const nameChars = b.shortName.split("");
      const startCol = Math.max(1, Math.min(MAP_W - nameChars.length - 2, col));

      // Status indicator
      const statusChar = STATUS_CHARS[b.status] || "○";
      if (startCol - 1 >= 1) {
        rows[safeRow][startCol - 1] = statusChar;
        colors[safeRow][startCol - 1] =
          b.status === "active"
            ? "#00ff41"
            : b.status === "warning"
              ? "#ffb000"
              : b.status === "error"
                ? "#ff3333"
                : theme.dim;
      }

      // Building shortName
      for (let i = 0; i < nameChars.length; i++) {
        if (startCol + i < MAP_W - 1) {
          rows[safeRow][startCol + i] = nameChars[i];
          colors[safeRow][startCol + i] = b.color;
        }
      }

      // Worker count indicator
      const wCount = workerCounts[b.id] || 0;
      if (wCount > 0 && startCol + nameChars.length + 1 < MAP_W - 1) {
        const countStr = `${wCount}`;
        rows[safeRow][startCol + nameChars.length] = ":";
        colors[safeRow][startCol + nameChars.length] = theme.dim;
        for (let i = 0; i < countStr.length; i++) {
          if (startCol + nameChars.length + 1 + i < MAP_W - 1) {
            rows[safeRow][startCol + nameChars.length + 1 + i] = countStr[i];
            colors[safeRow][startCol + nameChars.length + 1 + i] = theme.secondary;
          }
        }
      }

      placed.push({ id: b.id, col: startCol, row: safeRow });
    }

    return { rows, colors };
  }, [buildings, workerCounts, theme]);

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b shrink-0"
        style={{
          borderColor: theme.dim,
          fontSize: 13,
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          color: theme.secondary,
        }}
      >
        <span style={{ color: theme.primary }}>◆</span>
        MINIMAP
        <span
          className="ml-auto font-normal tracking-normal normal-case"
          style={{ color: theme.dim }}
        >
          {buildings.length} nodes · {activeConveyors.length} links
        </span>
      </div>

      {/* ASCII Map */}
      <div
        className="flex-1 overflow-y-auto terminal-scroll px-2 py-1 flex items-center justify-center"
        style={{ fontFamily: "monospace", fontSize: 12, lineHeight: "15px" }}
      >
        <pre style={{ color: theme.dim }}>
          {grid.rows.map((row, r) => (
            <div key={r}>
              {row.map((ch, c) => {
                const color = grid.colors[r][c];
                return (
                  <span key={c} style={color ? { color } : undefined}>
                    {ch}
                  </span>
                );
              })}
            </div>
          ))}
        </pre>
      </div>

      {/* Legend */}
      <div
        className="shrink-0 border-t px-3 py-1 flex flex-wrap gap-x-3"
        style={{ borderColor: theme.dim, fontSize: 11, fontFamily: "monospace" }}
      >
        <span style={{ color: "#00ff41" }}>● active</span>
        <span style={{ color: "#ffb000" }}>▲ warning</span>
        <span style={{ color: "#ff3333" }}>✖ error</span>
        <span style={{ color: theme.dim }}>○ idle</span>
      </div>
    </div>
  );
}
