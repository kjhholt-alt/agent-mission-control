"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Play,
  AlertTriangle,
  Radar,
  Filter,
  Clock,
  ChevronDown,
  Brain,
} from "lucide-react";
import type { OpsEvent, OpsTask, OpsWorker } from "@/lib/ops-types";
import {
  getProjectColor,
  workerDisplayName,
  xpToLevel,
  formatTimeAgo,
  formatDuration,
} from "@/lib/ops-types";
import { IntelPanel } from "./IntelPanel";

interface Props {
  events: OpsEvent[];
  tasks: OpsTask[];
  workers: OpsWorker[];
  selectedTask: OpsTask | null;
  selectedWorker: OpsWorker | null;
  onClearSelection: () => void;
}

type TabKey = "timeline" | "details" | "intel";

// ─── EVENT ICON ───────────────────────────────────────────────────────────────

function EventIcon({ type }: { type: string }) {
  const t = type || "";
  if (t.includes("complete") || t.includes("success"))
    return <CheckCircle className="w-3 h-3 text-emerald-400" />;
  if (t.includes("fail") || t.includes("error"))
    return <XCircle className="w-3 h-3 text-red-400" />;
  if (t.includes("start") || t.includes("running") || t.includes("progress"))
    return <Play className="w-3 h-3 text-cyan-400" />;
  if (t.includes("block") || t.includes("warn"))
    return <AlertTriangle className="w-3 h-3 text-amber-400" />;
  if (t.includes("scout") || t.includes("spawn"))
    return <Radar className="w-3 h-3 text-violet-400" />;
  return <Clock className="w-3 h-3 text-zinc-500" />;
}

function eventColor(type: string): string {
  const t = type || "";
  if (t.includes("complete") || t.includes("success")) return "#10b981";
  if (t.includes("fail") || t.includes("error")) return "#ef4444";
  if (t.includes("start") || t.includes("running") || t.includes("progress")) return "#06b6d4";
  if (t.includes("block") || t.includes("warn")) return "#eab308";
  if (t.includes("scout")) return "#8b5cf6";
  return "#6b7280";
}

// ─── TIMELINE TAB ─────────────────────────────────────────────────────────────

function TimelineTab({
  events,
  tasks,
  workers,
}: {
  events: OpsEvent[];
  tasks: OpsTask[];
  workers: OpsWorker[];
}) {
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  const projects = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.project) set.add(e.project);
    });
    tasks.forEach((t) => {
      if (t.project) set.add(t.project);
    });
    return Array.from(set).sort();
  }, [events, tasks]);

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.event_type));
    return Array.from(set).sort();
  }, [events]);

  // If no events from the log table, synthesize from tasks
  const displayEvents = useMemo(() => {
    let evts = events.length > 0
      ? events
      : tasks
          .filter((t) => t.status === "completed" || t.status === "failed" || t.status === "in_progress")
          .map((t) => ({
            id: `synth-${t.id}`,
            task_id: t.id,
            worker_id: t.assigned_worker_id,
            event_type:
              t.status === "completed"
                ? "task_complete"
                : t.status === "failed"
                  ? "task_failed"
                  : "task_started",
            title: t.title,
            details: null,
            project: t.project,
            created_at: t.completed_at || t.started_at || t.updated_at,
          }));

    if (filterProject) {
      evts = evts.filter((e) => e.project === filterProject);
    }
    if (filterType) {
      evts = evts.filter((e) => e.event_type === filterType);
    }

    return evts.slice(0, showCount);
  }, [events, tasks, filterProject, filterType, showCount]);

  const workerMap = useMemo(() => {
    const map: Record<string, OpsWorker> = {};
    workers.forEach((w) => (map[w.id] = w));
    return map;
  }, [workers]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-1.5 px-2 py-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Filter className="w-3 h-3" />
        Filters
        <ChevronDown
          className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`}
        />
      </button>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-2 pb-2"
          >
            <div className="flex flex-wrap gap-1.5">
              {/* Project filter */}
              <select
                value={filterProject || ""}
                onChange={(e) =>
                  setFilterProject(e.target.value || null)
                }
                className="text-[9px] bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-zinc-400"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              {/* Type filter */}
              <select
                value={filterType || ""}
                onChange={(e) =>
                  setFilterType(e.target.value || null)
                }
                className="text-[9px] bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-zinc-400"
              >
                <option value="">All Types</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {(filterProject || filterType) && (
                <button
                  onClick={() => {
                    setFilterProject(null);
                    setFilterType(null);
                  }}
                  className="text-[9px] text-cyan-400 hover:text-cyan-300 px-1.5"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-zinc-800/60" />

          {displayEvents.map((event, i) => {
            const color = eventColor(event.event_type);
            const worker = event.worker_id
              ? workerMap[event.worker_id]
              : null;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.5) }}
                className="relative pl-6 pb-3 group"
              >
                {/* Dot */}
                <div
                  className="absolute left-[4px] top-1 w-[7px] h-[7px] rounded-full border-2"
                  style={{
                    borderColor: color,
                    background: `${color}30`,
                  }}
                />

                {/* Content */}
                <div className="space-y-0.5">
                  <div className="flex items-start gap-1.5">
                    <EventIcon type={event.event_type} />
                    <p className="text-[10px] text-zinc-300 leading-tight flex-1">
                      {event.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[8px] text-zinc-600">
                    <span className="tabular-nums">
                      {event.created_at
                        ? new Date(event.created_at).toLocaleTimeString(
                            "en-US",
                            { hour12: false }
                          )
                        : "--"}
                    </span>
                    {event.project && (
                      <span
                        className="px-1 py-0.5 rounded"
                        style={{
                          color: getProjectColor(event.project),
                          background: `${getProjectColor(event.project)}10`,
                        }}
                      >
                        {event.project}
                      </span>
                    )}
                    {worker && (
                      <span className="text-zinc-500">
                        {workerDisplayName(worker.worker_name)}
                      </span>
                    )}
                  </div>

                  {event.details && (
                    <p className="text-[9px] text-zinc-600 pl-4 leading-tight">
                      {event.details}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}

          {displayEvents.length === 0 && (
            <div className="text-center py-12 text-[10px] text-zinc-700">
              No events recorded
            </div>
          )}
        </div>

        {/* Load more */}
        {displayEvents.length >= showCount && (
          <button
            onClick={() => setShowCount((prev) => prev + 50)}
            className="w-full py-2 text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Load more...
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DETAILS TAB ──────────────────────────────────────────────────────────────

function DetailsTab({
  selectedTask,
  selectedWorker,
  tasks,
  onClear,
}: {
  selectedTask: OpsTask | null;
  selectedWorker: OpsWorker | null;
  tasks: OpsTask[];
  onClear: () => void;
}) {
  if (!selectedTask && !selectedWorker) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-zinc-700">
        Select a task or worker to view details
      </div>
    );
  }

  if (selectedTask) {
    const t = selectedTask;
    const projectColor = getProjectColor(t.project);

    return (
      <div className="p-3 space-y-3 overflow-y-auto h-full scrollbar-thin">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-cyan-400 uppercase tracking-wider font-bold">
            Task Details
          </span>
          <button
            onClick={onClear}
            className="text-[9px] text-zinc-600 hover:text-zinc-400"
          >
            Close
          </button>
        </div>

        <h3 className="text-sm text-zinc-200 font-semibold leading-tight">
          {t.title}
        </h3>

        {t.description && (
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            {t.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <DetailField label="Status" value={t.status} />
          <DetailField
            label="Project"
            value={t.project || "--"}
            color={projectColor}
          />
          <DetailField label="Type" value={t.task_type || "--"} />
          <DetailField
            label="Priority"
            value={t.priority ? `P${t.priority}` : "--"}
          />
          <DetailField label="Worker" value={t.worker_type || "--"} />
          <DetailField
            label="Cost"
            value={
              t.cost_cents > 0
                ? `$${(t.cost_cents / 100).toFixed(2)}`
                : "--"
            }
          />
          <DetailField
            label="Tokens"
            value={t.tokens_used > 0 ? t.tokens_used.toLocaleString() : "--"}
          />
          <DetailField
            label="Duration"
            value={formatDuration(t.started_at, t.completed_at)}
          />
          <DetailField label="Created" value={formatTimeAgo(t.created_at)} />
          <DetailField label="Updated" value={formatTimeAgo(t.updated_at)} />
        </div>

        {t.parent_task_id && (
          <div className="text-[9px] text-zinc-600">
            Parent: <span className="text-zinc-400 font-mono">{t.parent_task_id.slice(0, 8)}</span>
          </div>
        )}
      </div>
    );
  }

  if (selectedWorker) {
    const w = selectedWorker;
    const level = xpToLevel(w.xp);
    const xpInLevel = w.xp % 100;
    const workerTasks = tasks.filter(
      (t) => t.assigned_worker_id === w.id
    );
    const completedTasks = workerTasks.filter(
      (t) => t.status === "completed"
    );

    return (
      <div className="p-3 space-y-3 overflow-y-auto h-full scrollbar-thin">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-cyan-400 uppercase tracking-wider font-bold">
            Worker Details
          </span>
          <button
            onClick={onClear}
            className="text-[9px] text-zinc-600 hover:text-zinc-400"
          >
            Close
          </button>
        </div>

        <h3 className="text-sm text-zinc-200 font-semibold">
          {workerDisplayName(w.worker_name)}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <DetailField label="Type" value={w.worker_type} />
          <DetailField label="Tier" value={w.tier} />
          <DetailField label="Status" value={w.status} />
          <DetailField label="Level" value={`${level}`} />
          <DetailField label="XP" value={`${xpInLevel}/100`} />
          <DetailField label="Tasks Done" value={`${w.tasks_completed}`} />
          <DetailField label="Tasks Failed" value={`${w.tasks_failed}`} />
          <DetailField
            label="Total Cost"
            value={`$${(w.total_cost_cents / 100).toFixed(2)}`}
          />
          <DetailField
            label="Tokens"
            value={w.total_tokens.toLocaleString()}
          />
          <DetailField
            label="Uptime"
            value={formatDuration(w.spawned_at, w.died_at)}
          />
          <DetailField
            label="Last Heartbeat"
            value={formatTimeAgo(w.last_heartbeat)}
          />
          <DetailField label="PID" value={w.pid?.toString() || "--"} />
        </div>

        {/* XP Bar */}
        <div>
          <div className="text-[9px] text-zinc-500 mb-1">
            Level {level} Progress
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
        </div>

        {/* Recent tasks */}
        <div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1.5">
            Task History ({completedTasks.length} completed)
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
            {workerTasks.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 p-1.5 rounded bg-zinc-900/50"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    t.status === "completed"
                      ? "bg-emerald-400"
                      : t.status === "failed"
                        ? "bg-red-400"
                        : t.status === "in_progress"
                          ? "bg-cyan-400"
                          : "bg-zinc-600"
                  }`}
                />
                <span className="text-[9px] text-zinc-400 truncate flex-1">
                  {t.title}
                </span>
                <span className="text-[8px] text-zinc-600 tabular-nums">
                  {formatTimeAgo(t.updated_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── DETAIL FIELD ─────────────────────────────────────────────────────────────

function DetailField({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">
        {label}
      </div>
      <div
        className="text-[11px] font-semibold tabular-nums"
        style={{ color: color || "#d4d4d8" }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export function TimelinePanel({
  events,
  tasks,
  workers,
  selectedTask,
  selectedWorker,
  onClearSelection,
}: Props) {
  const hasSelection = selectedTask !== null || selectedWorker !== null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    hasSelection ? "details" : "timeline"
  );

  // Auto-switch to details when something is selected
  const currentTab = hasSelection ? "details" : activeTab;

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Tab headers */}
      <div className="flex items-center gap-1 px-1">
        <button
          onClick={() => {
            if (hasSelection) onClearSelection();
            setActiveTab("timeline");
          }}
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
            currentTab === "timeline"
              ? "text-cyan-400 bg-cyan-500/10"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
            currentTab === "details"
              ? "text-cyan-400 bg-cyan-500/10"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          Details
          {hasSelection && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          )}
        </button>
        <button
          onClick={() => {
            if (hasSelection) onClearSelection();
            setActiveTab("intel");
          }}
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            currentTab === "intel"
              ? "text-violet-400 bg-violet-500/10"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          <Brain className="w-3 h-3" />
          Intel
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 rounded-lg border border-zinc-800/40" style={{ background: "rgba(10,10,18,0.5)" }}>
        <AnimatePresence mode="wait">
          {currentTab === "timeline" && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <TimelineTab events={events} tasks={tasks} workers={workers} />
            </motion.div>
          )}
          {currentTab === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <DetailsTab
                selectedTask={selectedTask}
                selectedWorker={selectedWorker}
                tasks={tasks}
                onClear={onClearSelection}
              />
            </motion.div>
          )}
          {currentTab === "intel" && (
            <motion.div
              key="intel"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <IntelPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
