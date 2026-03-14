"use client";

import { motion } from "framer-motion";
import { AgentActivity } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActivityTimelineProps {
  agents: AgentActivity[];
}

export function ActivityTimeline({ agents }: ActivityTimelineProps) {
  // Sort by updated_at descending, take last 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = agents
    .filter((a) => new Date(a.updated_at) >= cutoff)
    .sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );

  if (recent.length === 0) {
    return (
      <div className="text-center text-zinc-600 text-sm py-4">
        No activity in the last 24 hours
      </div>
    );
  }

  const getColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-cyan-400 shadow-[0_0_6px_rgba(0,200,255,0.6)]";
      case "completed":
        return "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]";
      case "failed":
        return "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]";
      default:
        return "bg-zinc-600";
    }
  };

  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="flex items-center gap-2 min-w-max px-1">
        {/* Timeline line */}
        <div className="relative flex items-center gap-3">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-800" />
          {recent.map((agent, i) => (
            <Tooltip key={agent.id}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05, type: "spring" }}
                  className={`relative w-3 h-3 rounded-full cursor-pointer ${getColor(agent.status)} ${agent.status === "running" ? "animate-pulse" : ""}`}
                />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-zinc-900 border-zinc-700 text-xs"
              >
                <div className="font-semibold text-zinc-200">
                  {agent.agent_name}
                </div>
                <div className="text-zinc-400">{agent.project}</div>
                <div className="text-zinc-500 mt-1">
                  {new Date(agent.updated_at).toLocaleTimeString()}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
