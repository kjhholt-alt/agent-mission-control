"use client";

import { useState, useEffect, useCallback } from "react";
import { BUILDINGS, CONVEYORS } from "@/components/game3d/constants";
import { useGameData } from "@/components/game3d/useGameData";
import { CRTTerminal } from "@/components/terminal/CRTTerminal";
import { BootSequence } from "@/components/terminal/BootSequence";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { QuadrantGrid } from "@/components/terminal/QuadrantGrid";
import { DataFeed } from "@/components/terminal/DataFeed";
import { CommandInput } from "@/components/terminal/CommandInput";
import { TerminalStatusBar } from "@/components/terminal/TerminalStatusBar";
import { useTerminalTheme } from "@/components/terminal/useTerminalTheme";

export default function GamePage() {
  const { workers, events, budget, isDemo } = useGameData();
  const { themeName, theme, cycleTheme } = useTerminalTheme();
  const [booted, setBooted] = useState(false);

  const isConnected = !isDemo;

  // Keyboard shortcuts
  const handleCommand = useCallback((cmd: string) => {
    if (cmd === "theme") cycleTheme();
  }, [cycleTheme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T = cycle theme
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        cycleTheme();
      }
      // Escape = skip boot
      if (e.key === "Escape" && !booted) {
        setBooted(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTheme, booted]);

  return (
    <div className="w-full" style={{ height: "calc(100vh - 40px)" }}>
      <CRTTerminal theme={theme}>
        {!booted ? (
          <BootSequence theme={theme} onComplete={() => setBooted(true)} />
        ) : (
          <div className="terminal-grid">
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

            {/* Right-side event feed */}
            <div className="terminal-feed terminal-quadrant">
              <DataFeed events={events} theme={theme} />
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
