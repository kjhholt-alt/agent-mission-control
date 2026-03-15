"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, X, ChevronDown } from "lucide-react";
import type { WorkerType, MissionTemplate } from "@/lib/collector-types";

// Known projects
const PROJECTS = [
  "nexus",
  "MoneyPrinter",
  "ai-finance-brief",
  "ai-chess-coach",
  "trade-journal",
  "buildkit-services",
  "pc-bottleneck-analyzer",
  "outdoor-crm",
  "BarrelHouseCRM",
  "email-finder-app",
  "admin-dashboard",
  "n16-soccer",
  "portfolio",
  "mcp-servers",
  "lead-tracker",
  "wavefront",
  "stock-breakout-alerts",
  "municipal-crm",
];

const WORKER_TYPES: { value: WorkerType; label: string; color: string }[] = [
  { value: "any", label: "Auto-assign", color: "text-zinc-400" },
  { value: "builder", label: "Builder", color: "text-cyan-400" },
  { value: "inspector", label: "Inspector", color: "text-amber-400" },
  { value: "miner", label: "Miner", color: "text-emerald-400" },
  { value: "scout", label: "Scout", color: "text-purple-400" },
  { value: "deployer", label: "Deployer", color: "text-orange-400" },
  { value: "messenger", label: "Messenger", color: "text-blue-400" },
];

interface SpawnModalProps {
  open: boolean;
  onClose: () => void;
  template?: MissionTemplate | null;
}

export function SpawnModal({ open, onClose, template }: SpawnModalProps) {
  const [goal, setGoal] = useState(template?.goal || "");
  const [project, setProject] = useState(template?.project || PROJECTS[0]);
  const [workerType, setWorkerType] = useState<WorkerType>(
    template?.worker_type || "any"
  );
  const [priority, setPriority] = useState(template?.priority || 50);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!goal.trim()) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          project,
          priority,
          worker_type: workerType === "any" ? undefined : workerType,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setResult(`Mission queued: ${data.task_id?.slice(0, 8)}...`);
        setTimeout(() => {
          onClose();
          setGoal("");
          setResult(null);
        }, 1500);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult("Failed to connect to Nexus API");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[201]"
          >
            <div className="bg-[#0f0f18] border border-cyan-500/20 rounded-xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Rocket className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      New Mission
                    </h2>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">
                      Deploy an agent with a goal
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                {/* Goal */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                    Mission Goal
                  </label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="What should the agent accomplish?"
                    rows={3}
                    className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-cyan-500/40 transition-colors resize-none"
                    autoFocus
                  />
                </div>

                {/* Project + Worker Type row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Target Project
                    </label>
                    <div className="relative">
                      <select
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40 transition-colors appearance-none cursor-pointer"
                      >
                        {PROJECTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Worker Type
                    </label>
                    <div className="relative">
                      <select
                        value={workerType}
                        onChange={(e) =>
                          setWorkerType(e.target.value as WorkerType)
                        }
                        className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40 transition-colors appearance-none cursor-pointer"
                      >
                        {WORKER_TYPES.map((wt) => (
                          <option key={wt.value} value={wt.value}>
                            {wt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Priority slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Priority
                    </label>
                    <span className="text-[10px] text-zinc-500">
                      {priority <= 20
                        ? "CRITICAL"
                        : priority <= 40
                          ? "HIGH"
                          : priority <= 60
                            ? "MEDIUM"
                            : priority <= 80
                              ? "LOW"
                              : "BACKGROUND"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                    className="w-full accent-cyan-500 h-1"
                  />
                  <div className="flex justify-between text-[9px] text-zinc-700 mt-1">
                    <span>Urgent</span>
                    <span>Background</span>
                  </div>
                </div>

                {/* Result message */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-xs px-3 py-2 rounded-lg ${
                      result.startsWith("Error") || result.startsWith("Failed")
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {result}
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-zinc-700">
                  Task will be queued for the next available worker
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!goal.trim() || submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  {submitting ? "Launching..." : "Launch Mission"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
