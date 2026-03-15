"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Radio, Wifi, WifiOff } from "lucide-react";
import { useCommandData } from "@/lib/use-command-data";
import { useGameData } from "@/components/game3d/useGameData";
import { MiniKanban } from "@/components/command/MiniKanban";
import { LiveWorkLog } from "@/components/command/LiveWorkLog";
import { TaskInputBar } from "@/components/command/TaskInputBar";
import { DetectionList } from "@/components/ops/DetectionList";

// Dynamic import for 3D canvas -- cannot SSR
const GameCanvas = dynamic(() => import("@/components/game3d/GameCanvas"), {
  ssr: false,
});

export default function CommandCenter() {
  const {
    tasks,
    workers: opsWorkers,
    agentActivity,
    connected,
    lastUpdated,
    deployTask,
  } = useCommandData();

  const gameData = useGameData();

  // Game interaction state
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Recent deployed tasks
  const [recentDeployedTasks, setRecentDeployedTasks] = useState<string[]>([]);

  // Handlers
  const handleClickBuilding = useCallback((id: string) => {
    setSelectedBuilding((prev) => (prev === id ? null : id));
    setSelectedWorkerId(null);
  }, []);

  const handleClickWorker = useCallback((id: string) => {
    setSelectedWorkerId((prev) => (prev === id ? null : id));
    setSelectedBuilding(null);
  }, []);

  const handleWorkLogWorkerClick = useCallback(
    (workerId: string) => {
      // Find the worker in game data and highlight them
      const worker = gameData.workers.find((w) => w.id === workerId);
      if (worker) {
        setSelectedWorkerId(workerId);
        setSelectedBuilding(null);
      } else {
        // If not in game workers, still select in the log
        setSelectedWorkerId((prev) => (prev === workerId ? null : workerId));
      }
    },
    [gameData.workers]
  );

  const handleDeployTask = useCallback(
    async (goal: string) => {
      await deployTask(goal);
      setRecentDeployedTasks((prev) => [goal, ...prev].slice(0, 10));
    },
    [deployTask]
  );

  // Format the last updated time
  const lastUpdatedStr = useMemo(() => {
    return lastUpdated.toLocaleTimeString("en-US", { hour12: false });
  }, [lastUpdated]);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#0a0a12" }}
    >
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline-overlay pointer-events-none z-50 opacity-[0.01]" />

      {/* Connection status bar */}
      <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-between border-b border-zinc-800/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-cyan-500" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-cyan-400 uppercase">
              Command Center
            </span>
          </div>
          <div className="flex items-center gap-1">
            {connected ? (
              <Wifi className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-2.5 h-2.5 text-red-400" />
            )}
            <span
              className={`text-[8px] uppercase tracking-wider ${
                connected ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] text-zinc-600 tabular-nums">
            {opsWorkers.filter((w) => w.status !== "dead").length} workers |{" "}
            {tasks.filter((t) => t.status === "in_progress").length} running |{" "}
            {tasks.filter((t) => t.status === "completed").length} done
          </span>
          <span className="text-[8px] text-zinc-700 tabular-nums">
            {lastUpdatedStr}
          </span>
        </div>
      </div>

      {/* MAIN CONTENT -- 40/60 split */}
      <div className="flex-1 min-h-0 flex">
        {/* LEFT: 3D Factory View (40%) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-[40%] flex-shrink-0 relative border-r border-zinc-800/30"
        >
          {/* Factory label */}
          <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[8px] font-bold tracking-[0.15em] text-zinc-500 uppercase">
              Factory View
            </span>
          </div>

          {/* 3D Canvas */}
          <div className="w-full h-full">
            <GameCanvas
              hoveredBuilding={hoveredBuilding}
              selectedBuilding={selectedBuilding}
              selectedWorker={selectedWorkerId}
              workers={gameData.workers}
              buildings={gameData.buildings}
              conveyors={gameData.conveyors}
              onHoverBuilding={setHoveredBuilding}
              onClickBuilding={handleClickBuilding}
              onClickWorker={handleClickWorker}
              isMobile={false}
              isStandupActive={false}
            />
          </div>

          {/* Selected building info overlay */}
          {selectedBuilding && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-3 left-3 right-3 p-2.5 rounded-lg border border-zinc-800/60"
              style={{
                background: "rgba(10,10,18,0.92)",
                backdropFilter: "blur(12px)",
              }}
            >
              {(() => {
                const b = gameData.buildings.find(
                  (b) => b.id === selectedBuilding
                );
                if (!b) return null;
                return (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ background: b.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-zinc-200 truncate">
                        {b.name}
                      </p>
                      <p className="text-[8px] text-zinc-500 truncate">
                        {b.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                          b.status === "active"
                            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                            : b.status === "warning"
                              ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                              : "text-zinc-500 bg-zinc-800/50 border border-zinc-700/30"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </motion.div>

        {/* RIGHT: Panels (60%) */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* TOP RIGHT: Mini Kanban */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="h-[35%] flex-shrink-0 p-2 border-b border-zinc-800/30"
          >
            <div
              className="h-full rounded-lg border border-zinc-800/40 p-2"
              style={{
                background: "rgba(10,10,18,0.5)",
                backdropFilter: "blur(8px)",
              }}
            >
              <MiniKanban tasks={tasks} />
            </div>
          </motion.div>

          {/* BOTTOM RIGHT: Live Work Log + Detection List */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex-1 min-h-0 p-2 flex flex-col gap-2"
          >
            <div
              className="flex-1 min-h-0 rounded-lg border border-zinc-800/40 p-2"
              style={{
                background: "rgba(10,10,18,0.5)",
                backdropFilter: "blur(8px)",
              }}
            >
              <LiveWorkLog
                workers={opsWorkers}
                tasks={tasks}
                agentActivity={agentActivity}
                selectedWorkerId={selectedWorkerId}
                onWorkerClick={handleWorkLogWorkerClick}
              />
            </div>
            <div
              className="flex-shrink-0 rounded-lg border border-zinc-800/40 overflow-hidden"
              style={{
                background: "rgba(10,10,18,0.5)",
                backdropFilter: "blur(8px)",
                maxHeight: "280px",
              }}
            >
              <DetectionList />
            </div>
          </motion.div>
        </div>
      </div>

      {/* BOTTOM: Task Input Bar */}
      <div className="flex-shrink-0 px-2 pb-2">
        <TaskInputBar
          onDeployTask={handleDeployTask}
          recentTasks={recentDeployedTasks}
        />
      </div>
    </div>
  );
}
