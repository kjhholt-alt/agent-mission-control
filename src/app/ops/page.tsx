"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useOpsData } from "@/lib/use-ops-data";
import type { OpsTask, OpsWorker } from "@/lib/ops-types";
import { StatusRibbon } from "@/components/ops/StatusRibbon";
import { PipelineView } from "@/components/ops/PipelineView";
import { KanbanBoard } from "@/components/ops/KanbanBoard";
import { WorkerFleet } from "@/components/ops/WorkerFleet";
import { TimelinePanel } from "@/components/ops/TimelinePanel";
import { BottomBar } from "@/components/ops/BottomBar";
import { OpsPageLoading } from "@/components/loading-states";

export default function OpsCenter() {
  const {
    tasks,
    workers,
    budget,
    events,
    connected,
    loading,
    lastUpdated,
    updateTaskStatus,
    assignTaskToWorker,
    cancelTask,
  } = useOpsData();

  const [selectedTask, setSelectedTask] = useState<OpsTask | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<OpsWorker | null>(null);
  const [draggedTask, setDraggedTask] = useState<OpsTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Selection handlers ──
  const handleTaskSelect = useCallback((task: OpsTask) => {
    setSelectedTask(task);
    setSelectedWorker(null);
  }, []);

  const handleWorkerSelect = useCallback((worker: OpsWorker) => {
    setSelectedWorker(worker);
    setSelectedTask(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTask(null);
    setSelectedWorker(null);
  }, []);

  // ── DnD handlers ──
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { task?: OpsTask }
        | undefined;
      if (data?.task) {
        setDraggedTask(data.task);
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const overData = over.data.current as
        | {
            column?: string;
            trash?: boolean;
            workerId?: string;
          }
        | undefined;

      if (!overData) return;

      if (overData.trash) {
        cancelTask(taskId);
        return;
      }

      if (overData.workerId) {
        assignTaskToWorker(taskId, overData.workerId);
        return;
      }

      if (overData.column) {
        const statusMap: Record<string, string> = {
          queued: "queued",
          running: "in_progress",
          blocked: "blocked",
          complete: "completed",
        };
        const newStatus = statusMap[overData.column];
        if (newStatus) {
          updateTaskStatus(taskId, newStatus);
        }
        return;
      }
    },
    [cancelTask, assignTaskToWorker, updateTaskStatus]
  );

  const handleDeploySwarm = useCallback((goal: string) => {
    // TODO: POST to /api/swarm/deploy with goal
    console.log("Deploy swarm with goal:", goal);
  }, []);

  // ── Workflow pipeline extraction ──
  // Filter tasks that have "[" in their title (workflow tasks)
  const workflowTasks = tasks.filter((t) => t.title.includes("["));

  // Group workflow tasks by workflow name (text inside brackets)
  const workflowGroups: Record<string, typeof tasks> = {};
  for (const t of workflowTasks) {
    const match = t.title.match(/^\[([^\]]+)\]/);
    if (match) {
      const name = match[1];
      if (!workflowGroups[name]) workflowGroups[name] = [];
      workflowGroups[name].push(t);
    }
  }

  // Find the first active workflow (has at least one in_progress or queued task)
  const activeWorkflowEntry = Object.entries(workflowGroups).find(([, group]) =>
    group.some((t) => t.status === "in_progress" || t.status === "queued" || t.status === "pending")
  );
  // Fallback to first workflow group if no active one
  const pipelineEntry = activeWorkflowEntry || Object.entries(workflowGroups)[0];
  const pipelineName = pipelineEntry ? pipelineEntry[0] : "";
  const pipelineTasks = pipelineEntry ? pipelineEntry[1] : [];

  // Task overlay for drag
  const dragOverlayContent = draggedTask ? (
    <div
      className="p-2.5 rounded-md border border-cyan-500/40 shadow-lg shadow-cyan-500/10"
      style={{
        background: "rgba(10,10,18,0.95)",
        backdropFilter: "blur(8px)",
        width: 240,
      }}
    >
      <p className="text-[11px] text-zinc-200 leading-tight line-clamp-2">
        {draggedTask.title}
      </p>
      {draggedTask.project && (
        <span className="text-[8px] uppercase tracking-wider text-cyan-400 mt-1 inline-block">
          {draggedTask.project}
        </span>
      )}
    </div>
  ) : null;

  if (loading) {
    return <OpsPageLoading />;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{ backgroundColor: "#0a0a12" }}
      >
        {/* Scanline overlay */}
        <div className="fixed inset-0 scanline-overlay pointer-events-none z-50 opacity-[0.01]" />

        {/* TOP BAR — Status Ribbon */}
        <div className="flex-shrink-0 p-2">
          <StatusRibbon
            workers={workers}
            tasks={tasks}
            budget={budget}
            connected={connected}
            lastUpdated={lastUpdated}
          />
        </div>

        {/* PIPELINE VIEW — Workflow progression */}
        {pipelineTasks.length > 0 && (
          <div className="flex-shrink-0 px-2">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-lg border border-zinc-800/40 p-3"
              style={{
                background: "rgba(10,10,18,0.5)",
                backdropFilter: "blur(8px)",
              }}
            >
              <PipelineView
                workflowTasks={pipelineTasks}
                workflowName={pipelineName}
              />
            </motion.div>
          </div>
        )}

        {/* MAIN CONTENT — 3-panel layout */}
        <div className="flex-1 min-h-0 px-2 pb-2 flex gap-2">
          {/* LEFT — Kanban (40%) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="w-[35%] min-w-0 flex-shrink-0 rounded-lg border border-zinc-800/40 p-2"
            style={{
              background: "rgba(10,10,18,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <KanbanBoard
              tasks={tasks}
              onTaskStatusChange={updateTaskStatus}
              onTaskCancel={cancelTask}
              onTaskSelect={handleTaskSelect}
            />
          </motion.div>

          {/* CENTER — Worker Fleet (30%) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-[30%] min-w-0 flex-shrink-0 rounded-lg border border-zinc-800/40 p-2"
            style={{
              background: "rgba(10,10,18,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <WorkerFleet
              workers={workers}
              tasks={tasks}
              onWorkerSelect={handleWorkerSelect}
              onTaskDropOnWorker={assignTaskToWorker}
            />
          </motion.div>

          {/* RIGHT — Timeline & Details (35%) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex-1 min-w-0 rounded-lg border border-zinc-800/40 p-2"
            style={{
              background: "rgba(10,10,18,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <TimelinePanel
              events={events}
              tasks={tasks}
              workers={workers}
              selectedTask={selectedTask}
              selectedWorker={selectedWorker}
              onClearSelection={handleClearSelection}
            />
          </motion.div>
        </div>

        {/* BOTTOM BAR — Quick Actions + Budget */}
        <div className="flex-shrink-0 px-2 pb-2">
          <BottomBar budget={budget} onDeploySwarm={handleDeploySwarm} />
        </div>
      </div>

      <DragOverlay>{dragOverlayContent}</DragOverlay>
    </DndContext>
  );
}
