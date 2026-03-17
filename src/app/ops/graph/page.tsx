"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useOpsData } from "@/lib/use-ops-data";
import { TaskGraph } from "@/components/ops/TaskGraph";
import type { OpsTask } from "@/lib/ops-types";
import { ArrowLeft, Network } from "lucide-react";
import Link from "next/link";

export default function TaskGraphPage() {
  const { tasks, loading, connected } = useOpsData();
  const [selectedTask, setSelectedTask] = useState<OpsTask | null>(null);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <div className="text-sm font-mono text-white/50">Loading task graph...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-black/40 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/ops"
            className="p-2 hover:bg-cyan-500/10 rounded-lg transition-colors border border-cyan-500/20"
          >
            <ArrowLeft className="w-5 h-5 text-cyan-400" />
          </Link>
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-mono font-bold text-white">
                Task Dependency Graph
              </h1>
              <p className="text-sm font-mono text-white/50">
                Visualize task dependencies and execution flow
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-400" : "bg-red-400"
              } animate-pulse`}
            />
            <span className="text-xs font-mono text-white/70">
              {connected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>

          <div className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <span className="text-sm font-mono text-cyan-400">
              {tasks.length} tasks
            </span>
          </div>
        </div>
      </motion.div>

      {/* Graph */}
      <div className="flex-1 relative">
        <TaskGraph tasks={tasks} onTaskClick={setSelectedTask} />
      </div>

      {/* Task Details Sidebar */}
      {selectedTask && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed right-0 top-0 h-screen w-[400px] bg-black/90 backdrop-blur-md border-l border-cyan-500/20 overflow-y-auto z-50"
        >
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-mono font-bold text-white">Task Details</h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-cyan-500/10 rounded-lg transition-colors text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-white/50 uppercase">Title</label>
                <div className="text-sm font-medium text-white mt-1">
                  {selectedTask.title}
                </div>
              </div>

              {selectedTask.description && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Description</label>
                  <div className="text-sm text-white/70 mt-1">
                    {selectedTask.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Status</label>
                  <div className="text-sm font-mono text-cyan-400 mt-1">
                    {selectedTask.status.replace(/_/g, " ").toUpperCase()}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Priority</label>
                  <div className="text-sm font-mono text-amber-400 mt-1">
                    {selectedTask.priority}
                  </div>
                </div>
              </div>

              {selectedTask.project && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Project</label>
                  <div className="text-sm font-mono text-white/90 mt-1">
                    {selectedTask.project}
                  </div>
                </div>
              )}

              {selectedTask.task_type && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Task Type</label>
                  <div className="text-sm font-mono text-white/90 mt-1">
                    {selectedTask.task_type}
                  </div>
                </div>
              )}

              {selectedTask.worker_type && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Worker Type</label>
                  <div className="text-sm font-mono text-cyan-400 mt-1">
                    {selectedTask.worker_type}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Cost</label>
                  <div className="text-sm font-mono text-emerald-400 mt-1">
                    ${(selectedTask.cost_cents / 100).toFixed(2)}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Tokens</label>
                  <div className="text-sm font-mono text-white/70 mt-1">
                    {selectedTask.tokens_used.toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedTask.started_at && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Started</label>
                  <div className="text-sm font-mono text-white/70 mt-1">
                    {new Date(selectedTask.started_at).toLocaleString()}
                  </div>
                </div>
              )}

              {selectedTask.completed_at && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Completed</label>
                  <div className="text-sm font-mono text-white/70 mt-1">
                    {new Date(selectedTask.completed_at).toLocaleString()}
                  </div>
                </div>
              )}

              {(selectedTask as any).depends_on && (selectedTask as any).depends_on.length > 0 && (
                <div>
                  <label className="text-xs font-mono text-white/50 uppercase">Dependencies</label>
                  <div className="text-sm font-mono text-white/70 mt-1 space-y-1">
                    {(selectedTask as any).depends_on.map((depId: string) => {
                      const depTask = tasks.find((t) => t.id === depId);
                      return (
                        <div
                          key={depId}
                          className="p-2 bg-cyan-500/5 border border-cyan-500/20 rounded cursor-pointer hover:bg-cyan-500/10"
                          onClick={() => setSelectedTask(depTask || null)}
                        >
                          {depTask ? depTask.title : depId.slice(0, 8)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show dependent tasks */}
              {(() => {
                const dependents = tasks.filter((t) => {
                  const deps = (t as any).depends_on || [];
                  return Array.isArray(deps) && deps.includes(selectedTask.id);
                });

                return dependents.length > 0 ? (
                  <div>
                    <label className="text-xs font-mono text-white/50 uppercase">
                      Dependent Tasks ({dependents.length})
                    </label>
                    <div className="text-sm font-mono text-white/70 mt-1 space-y-1">
                      {dependents.map((depTask) => (
                        <div
                          key={depTask.id}
                          className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded cursor-pointer hover:bg-emerald-500/10"
                          onClick={() => setSelectedTask(depTask)}
                        >
                          {depTask.title}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
