"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { AgentActivity } from "@/lib/types";

interface AgentHistoryProps {
  agents: AgentActivity[];
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <div className="w-4 h-4 rounded-full bg-zinc-600" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AgentHistory({ agents }: AgentHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...agents]
    .filter((a) => a.status !== "running")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 20);

  if (sorted.length === 0) {
    return (
      <div className="text-center text-zinc-600 text-sm py-8">
        No completed agents yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((agent) => (
        <div key={agent.id}>
          <button
            onClick={() =>
              setExpanded(expanded === agent.id ? null : agent.id)
            }
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
          >
            <StatusIcon status={agent.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200 truncate">
                  {agent.agent_name}
                </span>
                <span className="text-xs text-zinc-600 font-mono">
                  {agent.project}
                </span>
              </div>
            </div>
            <span className="text-xs text-zinc-500 shrink-0">
              {timeAgo(agent.updated_at)}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-zinc-500 transition-transform ${expanded === agent.id ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {expanded === agent.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pl-10">
                  <div className="bg-zinc-950/60 rounded-lg p-3 border border-zinc-800/50 space-y-2">
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span>
                        Steps: {agent.steps_completed}
                        {agent.total_steps ? `/${agent.total_steps}` : ""}
                      </span>
                      <span>
                        Started:{" "}
                        {new Date(agent.started_at).toLocaleTimeString()}
                      </span>
                      {agent.completed_at && (
                        <span>
                          Ended:{" "}
                          {new Date(agent.completed_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {agent.current_step && (
                      <div className="text-xs text-zinc-400 font-mono">
                        Last step: {agent.current_step}
                      </div>
                    )}
                    {agent.output && (
                      <div
                        className={`text-xs font-mono p-2 rounded ${
                          agent.status === "completed"
                            ? "bg-emerald-950/30 text-emerald-300"
                            : "bg-red-950/30 text-red-300"
                        }`}
                      >
                        {agent.output}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
