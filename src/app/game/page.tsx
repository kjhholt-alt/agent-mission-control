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
import { AgentRoster } from "@/components/terminal/AgentRoster";
import { SystemMonitor } from "@/components/terminal/SystemMonitor";
import { CommandInput } from "@/components/terminal/CommandInput";
import { TerminalStatusBar } from "@/components/terminal/TerminalStatusBar";
import { BuildingDetail } from "@/components/terminal/BuildingDetail";
import { useTerminalTheme } from "@/components/terminal/useTerminalTheme";
import { useSpawnTask } from "@/components/terminal/useSpawnTask";

type RightPanel = "events" | "flows" | "agents" | "system";

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
    if (cmd.startsWith("focus:")) {
      const tab = cmd.slice(6) as RightPanel;
      setRightPanel(tab);
    }
    // move and alert commands could update Supabase in the future
    // For now they just trigger visual feedback via CommandInput output
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
                {(["events", "flows", "agents", "system"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightPanel(tab)}
                    className="flex-1 text-[11px] font-bold tracking-wider uppercase py-1 text-center cursor-pointer transition-colors"
                    style={{
                      color: rightPanel === tab ? theme.primary : theme.dim,
                      backgroundColor: rightPanel === tab ? "rgba(255,255,255,0.03)" : "transparent",
                      borderBottom: rightPanel === tab ? `2px solid ${theme.primary}` : "2px solid transparent",
                    }}
                  >
                    {tab === "system" ? "SYS" : tab}
                  </button>
                ))}
              </div>
              {/* Panel content */}
              <div className="flex-1 min-h-0">
                {rightPanel === "events" && <DataFeed events={events} theme={theme} />}
                {rightPanel === "flows" && <DataFlowMap conveyors={CONVEYORS} buildings={BUILDINGS} theme={theme} />}
                {rightPanel === "agents" && <AgentRoster workers={workers} buildings={BUILDINGS} theme={theme} />}
                {rightPanel === "system" && (
                  <SystemMonitor workers={workers} buildings={BUILDINGS} events={events} budget={budget} theme={theme} />
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
