"use client";

import { useState } from "react";
import { BUILDINGS, CONVEYORS } from "@/components/game3d/constants";
import { useGameData } from "@/components/game3d/useGameData";
import { CRTTerminal } from "@/components/terminal/CRTTerminal";
import { BootSequence } from "@/components/terminal/BootSequence";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { QuadrantGrid } from "@/components/terminal/QuadrantGrid";
import { DataFeed } from "@/components/terminal/DataFeed";
import { TerminalStatusBar } from "@/components/terminal/TerminalStatusBar";
import { useTerminalTheme } from "@/components/terminal/useTerminalTheme";

export default function GamePage() {
  const { workers, events, budget, isDemo } = useGameData();
  const { themeName, theme, cycleTheme } = useTerminalTheme();
  const [booted, setBooted] = useState(false);

  const isConnected = !isDemo;

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
