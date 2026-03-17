"use client";

import { useMemo } from "react";
import type { Building } from "../game3d/types";
import { ASCII_BUILDINGS, STATUS_CHARS } from "./terminal-constants";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface ASCIIBuildingProps {
  building: Building;
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  compact?: boolean;
}

export function ASCIIBuilding({ building, theme, compact }: ASCIIBuildingProps) {
  // Pick art size based on building.size
  const sizeKey =
    building.size >= 2.5 ? "large" : building.size >= 1.75 ? "medium" : "small";
  const art = compact ? ASCII_BUILDINGS.small : ASCII_BUILDINGS[sizeKey];

  const statusChar = STATUS_CHARS[building.status] || STATUS_CHARS.idle;
  const statusColor =
    building.status === "active"
      ? theme.primary
      : building.status === "warning"
        ? "#ffb000"
        : building.status === "error"
          ? "#ff3333"
          : theme.dim;

  const rendered = useMemo(() => {
    return art.map((line) => line.replace("{id}", building.shortName.padEnd(3)));
  }, [art, building.shortName]);

  return (
    <div className="font-mono text-[13px] leading-tight whitespace-pre select-none">
      <div className="flex items-center gap-1 mb-0.5">
        <span style={{ color: statusColor }}>{statusChar}</span>
        <span
          style={{ color: theme.primary }}
          className="text-[12px] font-bold tracking-wider uppercase"
        >
          {building.shortName}
        </span>
      </div>
      {rendered.map((line, i) => (
        <div
          key={i}
          style={{
            color: building.status === "active" ? theme.primary : theme.dim,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
