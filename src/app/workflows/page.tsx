"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Plus,
  Play,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  ArrowDown,
  Rocket,
  CheckCircle2,
  Clock,
  Edit3,
  Copy,
  X,
} from "lucide-react";
import {
  loadWorkflows,
  saveWorkflows,
  newStepId,
  newWorkflowId,
  type Workflow,
  type WorkflowStep,
} from "@/lib/workflows";

const WORKER_TYPES = ["builder", "inspector", "miner", "scout", "deployer", "messenger"];

function StepCard({
  step,
  index,
  total,
  onRemove,
  onUpdate,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  onRemove: () => void;
  onUpdate: (s: WorkflowStep) => void;
}) {
  const [editing, setEditing] = useState(false);

  const workerColors: Record<string, string> = {
    builder: "border-cyan-500/30 bg-cyan-500/5",
    inspector: "border-amber-500/30 bg-amber-500/5",
    miner: "border-emerald-500/30 bg-emerald-500/5",
    scout: "border-purple-500/30 bg-purple-500/5",
    deployer: "border-orange-500/30 bg-orange-500/5",
    messenger: "border-blue-500/30 bg-blue-500/5",
  };

  return (
    <div>
      {index > 0 && (
        <div className="flex items-center justify-center py-1">
          <ArrowDown className="w-4 h-4 text-zinc-700" />
        </div>
      )}
      <div
        className={`border rounded-xl p-4 ${workerColors[step.worker_type] || workerColors.builder} transition-colors`}
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1 text-zinc-600 mt-1">
            <GripVertical className="w-4 h-4" />
            <span className="text-xs font-mono">{index + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={step.template_name}
                  onChange={(e) =>
                    onUpdate({ ...step, template_name: e.target.value })
                  }
                  className="w-full bg-[#0a0a12] border border-zinc-800 rounded px-2 py-1 text-sm text-white outline-none"
                  placeholder="Step name"
                />
                <textarea
                  value={step.goal}
                  onChange={(e) =>
                    onUpdate({ ...step, goal: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-[#0a0a12] border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none resize-none"
                  placeholder="What should this step do?"
                />
                <div className="flex gap-2">
                  <select
                    value={step.worker_type}
                    onChange={(e) =>
                      onUpdate({ ...step, worker_type: e.target.value })
                    }
                    className="bg-[#0a0a12] border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none"
                  >
                    {WORKER_TYPES.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <input
                      type="checkbox"
                      checked={step.use_previous_output}
                      onChange={(e) =>
                        onUpdate({
                          ...step,
                          use_previous_output: e.target.checked,
                        })
                      }
                      className="accent-cyan-500"
                    />
                    Use prev output
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <input
                      type="checkbox"
                      checked={step.wait_for_approval}
                      onChange={(e) =>
                        onUpdate({
                          ...step,
                          wait_for_approval: e.target.checked,
                        })
                      }
                      className="accent-cyan-500"
                    />
                    Approval gate
                  </label>
                </div>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Done editing
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">
                    {step.template_name}
                  </h4>
                  <span className="text-[10px] text-zinc-600 uppercase">
                    {step.worker_type}
                  </span>
                  {step.use_previous_output && (
                    <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                      chains
                    </span>
                  )}
                  {step.wait_for_approval && (
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      approval
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                  {step.goal}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditing(!editing)}
              className="p-1 rounded hover:bg-white/5 text-zinc-600"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRemove}
              className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  // New workflow form
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSteps, setFormSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    setWorkflows(loadWorkflows());
  }, []);

  const selected = workflows.find((w) => w.id === selectedId);

  const handleSave = () => {
    if (!formName.trim() || formSteps.length === 0) return;
    const now = new Date().toISOString();
    const wf: Workflow = {
      id: newWorkflowId(),
      name: formName,
      description: formDesc,
      steps: formSteps,
      project: "nexus",
      trigger: "manual",
      created_at: now,
      updated_at: now,
      run_count: 0,
    };
    const updated = [...workflows, wf];
    setWorkflows(updated);
    saveWorkflows(updated);
    setCreating(false);
    setFormName("");
    setFormDesc("");
    setFormSteps([]);
    setSelectedId(wf.id);
  };

  const handleDelete = (id: string) => {
    const updated = workflows.filter((w) => w.id !== id);
    setWorkflows(updated);
    saveWorkflows(updated);
    if (selectedId === id) setSelectedId(null);
  };

  const handleRun = async (wf: Workflow) => {
    setRunning(wf.id);
    setRunResult(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nexus-key": process.env.NEXT_PUBLIC_NEXUS_API_KEY || "nexus-hive-2026",
        },
        body: JSON.stringify({
          steps: wf.steps,
          workflow_name: wf.name,
          workflow_id: wf.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRunResult(`Started: ${data.steps_created} steps queued`);
        // Update run count
        const updated = workflows.map((w) =>
          w.id === wf.id
            ? {
                ...w,
                run_count: w.run_count + 1,
                last_run_at: new Date().toISOString(),
              }
            : w
        );
        setWorkflows(updated);
        saveWorkflows(updated);
      } else {
        setRunResult(`Error: ${data.error}`);
      }
    } catch {
      setRunResult("Failed to connect");
    }
    setRunning(null);
  };

  const addStep = () => {
    setFormSteps([
      ...formSteps,
      {
        id: newStepId(),
        template_name: "New Step",
        goal: "",
        project: "nexus",
        worker_type: "builder",
        priority: 50,
        use_previous_output: formSteps.length > 0,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
    ]);
  };

  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: "#0a0a0f" }}
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <GitBranch className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Workflows</h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                Multi-step agent pipelines
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Workflow list */}
          <div className="space-y-2">
            {workflows.map((wf) => (
              <motion.button
                key={wf.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedId(wf.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedId === wf.id
                    ? "border-purple-500/30 bg-purple-500/5"
                    : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white">
                    {wf.name}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
                <p className="text-xs text-zinc-500 line-clamp-1">
                  {wf.description}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                  <span>{wf.steps.length} steps</span>
                  <span>{wf.trigger}</span>
                  <span>{wf.run_count} runs</span>
                </div>
              </motion.button>
            ))}

            {workflows.length === 0 && (
              <div className="text-center py-12 text-zinc-600 text-sm">
                No workflows yet
              </div>
            )}
          </div>

          {/* Selected workflow detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {selected.name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {selected.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRun(selected)}
                      disabled={running === selected.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      {running === selected.id ? (
                        <Clock className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Run
                    </button>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {runResult && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-xs px-3 py-2 rounded-lg ${
                      runResult.startsWith("Error") || runResult.startsWith("Failed")
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {runResult}
                  </motion.div>
                )}

                <div className="border-t border-zinc-800/50 pt-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Pipeline ({selected.steps.length} steps)
                  </h3>
                  {selected.steps.map((step, i) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      index={i}
                      total={selected.steps.length}
                      onRemove={() => {
                        const updated = workflows.map((w) =>
                          w.id === selected.id
                            ? {
                                ...w,
                                steps: w.steps.filter(
                                  (s) => s.id !== step.id
                                ),
                              }
                            : w
                        );
                        setWorkflows(updated);
                        saveWorkflows(updated);
                      }}
                      onUpdate={(updated) => {
                        const newWorkflows = workflows.map((w) =>
                          w.id === selected.id
                            ? {
                                ...w,
                                steps: w.steps.map((s) =>
                                  s.id === step.id ? updated : s
                                ),
                              }
                            : w
                        );
                        setWorkflows(newWorkflows);
                        saveWorkflows(newWorkflows);
                      }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-3 text-[10px] text-zinc-600 pt-2">
                  {selected.last_run_at && (
                    <span>
                      Last run:{" "}
                      {new Date(selected.last_run_at).toLocaleString()}
                    </span>
                  )}
                  <span>{selected.run_count} total runs</span>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-12 text-center text-zinc-600">
                <GitBranch className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a workflow to view its pipeline</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create workflow modal */}
      <AnimatePresence>
        {creating && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
              onClick={() => setCreating(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[201] max-h-[80vh] overflow-y-auto"
            >
              <div className="bg-[#0f0f18] border border-purple-500/20 rounded-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <h2 className="text-sm font-semibold text-white">
                    New Workflow
                  </h2>
                  <button
                    onClick={() => setCreating(false)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Morning Standup"
                      className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-purple-500/40"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="What does this workflow do?"
                      className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-purple-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                      Steps
                    </label>
                    {formSteps.map((step, i) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        index={i}
                        total={formSteps.length}
                        onRemove={() =>
                          setFormSteps(formSteps.filter((s) => s.id !== step.id))
                        }
                        onUpdate={(updated) =>
                          setFormSteps(
                            formSteps.map((s) =>
                              s.id === step.id ? updated : s
                            )
                          )
                        }
                      />
                    ))}
                    <button
                      onClick={addStep}
                      className="w-full mt-2 py-3 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-600 hover:border-purple-500/30 hover:text-purple-400 transition-colors"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      Add Step
                    </button>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
                  <button
                    onClick={() => setCreating(false)}
                    className="px-4 py-2 rounded-lg text-sm text-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!formName.trim() || formSteps.length === 0}
                    className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm hover:bg-purple-500/30 disabled:opacity-40"
                  >
                    Create Workflow
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
