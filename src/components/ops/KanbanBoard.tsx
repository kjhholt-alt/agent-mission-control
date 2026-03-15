"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { OpsTask } from "@/lib/ops-types";
import {
  KANBAN_COLUMNS,
  getProjectColor,
  formatTimeAgo,
  type KanbanColumn,
} from "@/lib/ops-types";

interface Props {
  tasks: OpsTask[];
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
  onTaskCancel: (taskId: string) => void;
  onTaskSelect: (task: OpsTask) => void;
  onTaskDropOnWorker?: (taskId: string) => void;
}

function mapStatusToColumn(status: string): KanbanColumn | null {
  switch (status) {
    case "pending":
    case "queued":
      return "queued";
    case "in_progress":
    case "running":
      return "running";
    case "blocked":
      return "blocked";
    case "completed":
      return "complete";
    default:
      return null; // failed tasks don't show
  }
}

function columnToStatus(col: KanbanColumn): string {
  switch (col) {
    case "queued":
      return "queued";
    case "running":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "complete":
      return "completed";
  }
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onSelect,
  isDragging,
}: {
  task: OpsTask;
  onSelect: (t: OpsTask) => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 50,
      }
    : undefined;

  const projectColor = getProjectColor(task.project);
  const workerType = task.worker_type || "general";
  const priority = task.priority || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(task)}
      className={`group relative p-2.5 rounded-md border border-zinc-800/60 cursor-grab active:cursor-grabbing transition-all hover:border-cyan-500/30 ${
        isDragging ? "opacity-50" : ""
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(task);
      }}
    >
      <div
        className="absolute inset-0 rounded-md opacity-[0.03]"
        style={{ background: projectColor }}
      />

      {/* Title */}
      <p className="text-[11px] text-zinc-200 leading-tight mb-1.5 line-clamp-2 relative">
        {task.title}
      </p>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap relative">
        {/* Project badge */}
        {task.project && (
          <span
            className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: projectColor,
              background: `${projectColor}15`,
              border: `1px solid ${projectColor}30`,
            }}
          >
            {task.project.replace(/-/g, " ").slice(0, 15)}
          </span>
        )}

        {/* Worker type badge */}
        <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500 border border-zinc-700/30">
          {workerType}
        </span>

        {/* Priority */}
        {priority > 0 && (
          <span
            className={`text-[8px] font-bold px-1 py-0.5 rounded ${
              priority >= 8
                ? "text-red-400 bg-red-500/10 border border-red-500/20"
                : priority >= 5
                  ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                  : "text-zinc-500 bg-zinc-800/50 border border-zinc-700/30"
            }`}
          >
            P{priority}
          </span>
        )}
      </div>

      {/* Time + Cost */}
      <div className="flex items-center justify-between mt-1.5 relative">
        <span className="text-[9px] text-zinc-600 tabular-nums">
          {formatTimeAgo(task.updated_at)}
        </span>
        {task.cost_cents > 0 && (
          <span className="text-[9px] text-amber-500/70 tabular-nums">
            ${(task.cost_cents / 100).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── OVERLAY CARD (shown while dragging) ──────────────────────────────────────

function TaskCardOverlay({ task }: { task: OpsTask }) {
  const projectColor = getProjectColor(task.project);
  return (
    <div
      className="p-2.5 rounded-md border border-cyan-500/40 shadow-lg shadow-cyan-500/10"
      style={{
        background: "rgba(10,10,18,0.95)",
        backdropFilter: "blur(8px)",
        width: 240,
      }}
    >
      <p className="text-[11px] text-zinc-200 leading-tight mb-1.5 line-clamp-2">
        {task.title}
      </p>
      <div className="flex items-center gap-1.5">
        {task.project && (
          <span
            className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: projectColor,
              background: `${projectColor}15`,
              border: `1px solid ${projectColor}30`,
            }}
          >
            {task.project.replace(/-/g, " ").slice(0, 15)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── KANBAN COLUMN ────────────────────────────────────────────────────────────

function KanbanColumnDropzone({
  column,
  tasks,
  onTaskSelect,
}: {
  column: (typeof KANBAN_COLUMNS)[number];
  tasks: OpsTask[];
  onTaskSelect: (t: OpsTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.key}`,
    data: { column: column.key },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-0 flex-1 rounded-lg border ${column.borderColor}/30 ${
        isOver ? `${column.bgColor} ${column.borderColor}/60` : "border-zinc-800/40"
      } transition-colors`}
      style={{ background: isOver ? undefined : "rgba(10,10,18,0.5)" }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/40">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              column.key === "queued"
                ? "bg-cyan-400"
                : column.key === "running"
                  ? "bg-emerald-400 animate-pulse"
                  : column.key === "blocked"
                    ? "bg-amber-400"
                    : "bg-emerald-300"
            }`}
          />
          <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
            {column.label}
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-zinc-600">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              layout
            >
              <TaskCard task={task} onSelect={onTaskSelect} />
            </motion.div>
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="text-center py-6 text-[10px] text-zinc-700">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TRASH ZONE ───────────────────────────────────────────────────────────────

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: "trash-zone",
    data: { trash: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center gap-2 py-2 rounded-md border border-dashed transition-all ${
        isOver
          ? "border-red-500 bg-red-500/10 text-red-400"
          : "border-zinc-800 text-zinc-700"
      }`}
    >
      <Trash2 className="w-3 h-3" />
      <span className="text-[9px] uppercase tracking-wider font-bold">
        Cancel Task
      </span>
    </div>
  );
}

// ─── MAIN KANBAN BOARD ────────────────────────────────────────────────────────

export function KanbanBoard({
  tasks,
  onTaskStatusChange,
  onTaskCancel,
  onTaskSelect,
}: Props) {
  const [activeTask, setActiveTask] = useState<OpsTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByColumn = useMemo(() => {
    const result: Record<KanbanColumn, OpsTask[]> = {
      queued: [],
      running: [],
      blocked: [],
      complete: [],
    };

    for (const task of tasks) {
      const col = mapStatusToColumn(task.status);
      if (col) {
        if (col === "complete") {
          if (result.complete.length < 20) {
            result.complete.push(task);
          }
        } else {
          result[col].push(task);
        }
      }
    }

    return result;
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = (event.active.data.current as { task: OpsTask })?.task;
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overData = over.data.current as
      | { column?: KanbanColumn; trash?: boolean; workerId?: string }
      | undefined;

    if (overData?.trash) {
      onTaskCancel(taskId);
      return;
    }

    if (overData?.column) {
      const newStatus = columnToStatus(overData.column);
      const currentTask = tasks.find((t) => t.id === taskId);
      if (currentTask && currentTask.status !== newStatus) {
        onTaskStatusChange(taskId, newStatus);
      }
      return;
    }

    if (overData?.workerId) {
      // Handled by WorkerFleet component
      return;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full gap-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <h2 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
            Task Board
          </h2>
        </div>

        <div className="flex-1 grid grid-cols-1 gap-2 min-h-0" style={{ gridTemplateRows: "1fr 1fr 1fr 1fr" }}>
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumnDropzone
              key={col.key}
              column={col}
              tasks={tasksByColumn[col.key]}
              onTaskSelect={onTaskSelect}
            />
          ))}
        </div>

        <TrashZone />
      </div>

      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
