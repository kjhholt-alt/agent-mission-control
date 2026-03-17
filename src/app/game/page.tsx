"use client";

import { useState, useEffect, useCallback } from "react";
import { BUILDINGS, CONVEYORS } from "@/components/game3d/constants";
import { useGameData } from "@/components/game3d/useGameData";
import { CRTTerminal } from "@/components/terminal/CRTTerminal";
import { BootSequence } from "@/components/terminal/BootSequence";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { QuadrantGrid } from "@/components/terminal/QuadrantGrid";
import { DataFeed } from "@/components/terminal/DataFeed";
import { DataFlowMap } from "@/components/terminal/DataFlowMap";
import { CommandInput } from "@/components/terminal/CommandInput";
import { TerminalStatusBar } from "@/components/terminal/TerminalStatusBar";
import { BuildingDetail } from "@/components/terminal/BuildingDetail";
import { useTerminalTheme } from "@/components/terminal/useTerminalTheme";
import { useSpawnTask } from "@/components/terminal/useSpawnTask";

type RightPanel = "events" | "flows";

export default function GamePage() {
  const { workers, events, budget, isDemo } = useGameData();
  const { themeName, theme, cycleTheme } = useTerminalTheme();
  const { spawnTask } = useSpawnTask();
  const [booted, setBooted] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("events");

  const isConnected = !isDemo;

  // Command handler
  const handleCommand = useCallback((cmd: string) => {
    if (cmd === "theme") cycleTheme();
    if (cmd.startsWith("inspect:")) {
      setInspectedId(cmd.slice(8));
    }
    if (cmd.startsWith("spawn:")) {
      const parts = cmd.slice(6);
      const colonIdx = parts.indexOf(":");
      if (colonIdx > 0) {
        const projectId = parts.slice(0, colonIdx);
        const task = parts.slice(colonIdx + 1);
        spawnTask(projectId, task);
      }
    }
  }, [cycleTheme, spawnTask]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        cycleTheme();
      }
      if (e.key === "Escape" && !booted) {
        setBooted(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTheme, booted]);

  const inspectedBuilding = inspectedId ? BUILDINGS.find(b => b.id === inspectedId) : null;

  return (
    <div className="w-full" style={{ height: "calc(100vh - 40px)" }}>
      <CRTTerminal theme={theme}>
        {!booted ? (
          <BootSequence theme={theme} onComplete={() => setBooted(true)} />
        ) : (
          <div className="terminal-grid relative">
            {/* Full-screen building detail overlay */}
            {inspectedBuilding && (
              <div className="absolute inset-0 z-30">
                <BuildingDetail
                  building={inspectedBuilding}
                  workers={workers}
                  conveyors={CONVEYORS}
                  allBuildings={BUILDINGS}
                  theme={theme}
                  onClose={() => setInspectedId(null)}
                />
              </div>
            )}

            {/* Top header bar */}
            <div className="terminal-header">
              <TerminalHeader
                theme={theme}
                isConnected={isConnected}
                workerCount={workers.length}
                eventCount={events.length}
              />
            </div>

            {/* 4 project quadrants */}
            <QuadrantGrid
              buildings={BUILDINGS}
              workers={workers}
              events={events}
              conveyors={CONVEYORS}
              theme={theme}
            />

            {/* Right-side panel — tabbed between Events and Flows */}
            <div className="terminal-feed terminal-quadrant flex flex-col">
              {/* Tab switcher */}
              <div className="flex shrink-0" style={{ borderBottom: `1px solid ${theme.dim}` }}>
                <button
                  onClick={() => setRightPanel("events")}
                  className="flex-1 text-[12px] font-bold tracking-wider uppercase py-1 text-center cursor-pointer transition-colors"
                  style={{
                    color: rightPanel === "events" ? theme.primary : theme.dim,
                    backgroundColor: rightPanel === "events" ? "rgba(255,255,255,0.03)" : "transparent",
                    borderBottom: rightPanel === "events" ? `2px solid ${theme.primary}` : "2px solid transparent",
                  }}
                >
                  EVENTS
                </button>
                <button
                  onClick={() => setRightPanel("flows")}
                  className="flex-1 text-[12px] font-bold tracking-wider uppercase py-1 text-center cursor-pointer transition-colors"
                  style={{
                    color: rightPanel === "flows" ? theme.primary : theme.dim,
                    backgroundColor: rightPanel === "flows" ? "rgba(255,255,255,0.03)" : "transparent",
                    borderBottom: rightPanel === "flows" ? `2px solid ${theme.primary}` : "2px solid transparent",
                  }}
                >
                  FLOWS
                </button>
              </div>
              {/* Panel content */}
              <div className="flex-1 min-h-0">
                {rightPanel === "events" ? (
                  <DataFeed events={events} theme={theme} />
                ) : (
                  <DataFlowMap conveyors={CONVEYORS} buildings={BUILDINGS} theme={theme} />
                )}
              </div>
            </div>

            {/* Command input */}
            <div className="terminal-cmd terminal-quadrant">
              <CommandInput
                theme={theme}
                buildings={BUILDINGS}
                workers={workers}
                onCommand={handleCommand}
              />
            </div>

            {/* Bottom status bar */}
            <div className="terminal-bar">
              <TerminalStatusBar
                workers={workers}
                buildings={BUILDINGS}
                budget={budget}
                isConnected={isConnected}
                theme={theme}
                themeName={themeName}
                onCycleTheme={cycleTheme}
              />
            </div>
          </div>
        )}
      </CRTTerminal>
    </div>
  );
}
