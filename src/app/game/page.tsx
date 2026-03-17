"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Minimap } from "@/components/terminal/Minimap";
import { CommandInput } from "@/components/terminal/CommandInput";
import { TerminalStatusBar } from "@/components/terminal/TerminalStatusBar";
import { BuildingDetail } from "@/components/terminal/BuildingDetail";
import { useTerminalTheme } from "@/components/terminal/useTerminalTheme";
import { useSpawnTask } from "@/components/terminal/useSpawnTask";
import { TerminalToast } from "@/components/terminal/TerminalToast";
import { useToasts } from "@/components/terminal/useToasts";

type RightPanel = "events" | "flows" | "agents" | "system" | "map";

export default function GamePage() {
  const { workers, events, budget, isDemo } = useGameData();
  const { themeName, theme, cycleTheme } = useTerminalTheme();
  const { spawnTask } = useSpawnTask();
  const { toasts, addToast, dismissToast } = useToasts();
  const [booted, setBooted] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("events");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const prevEventCount = useRef(events.length);

  const isConnected = !isDemo;

  // Toast on new events
  useEffect(() => {
    if (!booted) return;
    if (events.length > prevEventCount.current) {
      const newest = events[0];
      if (newest) {
        addToast(newest.message, newest.type);
      }
    }
    prevEventCount.current = events.length;
  }, [events, booted, addToast]);

  // Handle agent assignment — click agent in roster, then click building in quadrant
  const handleAssignAgent = useCallback((buildingId: string) => {
    if (!selectedAgentId) return;
    const agent = workers.find(w => w.id === selectedAgentId);
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (agent && building) {
      addToast(`${agent.name} → ${building.shortName}`, "success");
      // In live mode, this could update Supabase. For now it's visual feedback.
      spawnTask(buildingId, `Reassigned ${agent.name} to ${building.name}`);
    }
    setSelectedAgentId(null);
  }, [selectedAgentId, workers, addToast, spawnTask]);

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
    if (cmd.startsWith("alert:")) {
      addToast(cmd.slice(6), "warning");
    }
  }, [cycleTheme, spawnTask, addToast]);

  // Keyboard shortcuts
  const PANEL_KEYS: Record<string, RightPanel> = {
    "1": "events", "2": "flows", "3": "agents", "4": "system", "5": "map",
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        cycleTheme();
        return;
      }

      // Ctrl+1-5 to switch right panel tabs (works even in input)
      if (e.ctrlKey && PANEL_KEYS[e.key]) {
        e.preventDefault();
        setRightPanel(PANEL_KEYS[e.key]);
        return;
      }

      if (e.key === "Escape") {
        if (inspectedId) {
          setInspectedId(null);
        } else if (selectedAgentId) {
          setSelectedAgentId(null);
        } else if (!booted) {
          setBooted(true);
        }
        return;
      }

      // Backtick to focus command input (when not already in input)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        const cmdInput = document.querySelector<HTMLInputElement>(".terminal-cmd input");
        cmdInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTheme, booted, selectedAgentId, inspectedId]);

  const inspectedBuilding = inspectedId ? BUILDINGS.find(b => b.id === inspectedId) : null;

  return (
    <div className="w-full" style={{ height: "calc(100vh - 40px)" }}>
      <CRTTerminal theme={theme}>
        {!booted ? (
          <BootSequence theme={theme} onComplete={() => setBooted(true)} />
        ) : (
          <div className="terminal-grid relative">
            {/* Toast notifications */}
            <TerminalToast toasts={toasts} theme={theme} onDismiss={dismissToast} />

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
              selectedAgentId={selectedAgentId}
              onAssignAgent={handleAssignAgent}
            />

            {/* Right-side panel — tabbed between Events and Flows */}
            <div className="terminal-feed terminal-quadrant flex flex-col">
              {/* Tab switcher */}
              <div className="flex shrink-0" style={{ borderBottom: `1px solid ${theme.dim}` }}>
                {(["events", "flows", "agents", "system", "map"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightPanel(tab)}
                    className="flex-1 text-[10px] font-bold tracking-wider uppercase py-1 text-center cursor-pointer transition-colors"
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
                {rightPanel === "agents" && (
                  <AgentRoster
                    workers={workers}
                    buildings={BUILDINGS}
                    theme={theme}
                    selectedAgentId={selectedAgentId}
                    onSelectAgent={setSelectedAgentId}
                  />
                )}
                {rightPanel === "system" && (
                  <SystemMonitor workers={workers} buildings={BUILDINGS} events={events} budget={budget} theme={theme} />
                )}
                {rightPanel === "map" && (
                  <Minimap buildings={BUILDINGS} workers={workers} conveyors={CONVEYORS} theme={theme} />
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
