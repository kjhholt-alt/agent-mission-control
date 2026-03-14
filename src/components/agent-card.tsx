"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Clock, Terminal, CheckCircle2, XCircle } from "lucide-react";
import { AgentActivity } from "@/lib/types";
import { useEffect, useState } from "react";

interface AgentCardProps {
  agent: AgentActivity;
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span>{elapsed}</span>;
}

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse text-cyan-400">|</span>
      )}
    </span>
  );
}

export function AgentCard({ agent }: AgentCardProps) {
  const isRunning = agent.status === "running";
  const isCompleted = agent.status === "completed";
  const isFailed = agent.status === "failed";

  const progress =
    agent.total_steps && agent.total_steps > 0
      ? Math.round((agent.steps_completed / agent.total_steps) * 100)
      : 0;

  const borderColor = isRunning
    ? "border-cyan-500/40"
    : isCompleted
      ? "border-emerald-500/40"
      : "border-red-500/40";

  const glowColor = isRunning
    ? "shadow-cyan-500/10"
    : isCompleted
      ? "shadow-emerald-500/10"
      : "shadow-red-500/10";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        ...(isCompleted
          ? {
              borderColor: ["rgba(16,185,129,0.4)", "rgba(16,185,129,0.8)", "rgba(16,185,129,0.4)"],
              transition: { borderColor: { duration: 0.6 } },
            }
          : {}),
        ...(isFailed
          ? {
              borderColor: ["rgba(239,68,68,0.4)", "rgba(239,68,68,0.8)", "rgba(239,68,68,0.4)"],
              transition: { borderColor: { duration: 0.6 } },
            }
          : {}),
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative border ${borderColor} rounded-xl bg-zinc-900/80 backdrop-blur-md p-5 shadow-lg ${glowColor} overflow-hidden`}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none scanline-overlay opacity-[0.03]" />

      {/* Pulsing ring for active agents */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-[1px] rounded-xl"
          >
            <div className="absolute inset-0 rounded-xl animate-pulse-ring" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${isRunning ? "bg-cyan-500/10" : isCompleted ? "bg-emerald-500/10" : "bg-red-500/10"}`}
          >
            {isRunning ? (
              <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              {agent.agent_name}
            </h3>
            <p className="text-xs text-zinc-500">{agent.project}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="w-3 h-3" />
          <ElapsedTime startedAt={agent.started_at} />
        </div>
      </div>

      {/* Progress bar */}
      {agent.total_steps && agent.total_steps > 0 && (
        <div className="relative z-10 mb-3">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>
              Step {agent.steps_completed}/{agent.total_steps}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full ${
                isRunning
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_10px_rgba(0,200,255,0.5)]"
                  : isCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                    : "bg-gradient-to-r from-red-500 to-red-300"
              }`}
            />
          </div>
        </div>
      )}

      {/* Current step */}
      {agent.current_step && (
        <div className="relative z-10 mb-3">
          <div className="flex items-start gap-2 bg-zinc-950/60 rounded-lg p-3 border border-zinc-800/50">
            <Terminal className="w-3.5 h-3.5 text-cyan-500 mt-0.5 shrink-0" />
            <code className="text-xs text-zinc-300 font-mono leading-relaxed break-all">
              {isRunning ? (
                <TypingText text={agent.current_step} />
              ) : (
                agent.current_step
              )}
            </code>
          </div>
        </div>
      )}

      {/* Output log */}
      {agent.output && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="relative z-10 mt-2"
        >
          <div
            className={`text-xs font-mono p-3 rounded-lg border ${
              isCompleted
                ? "bg-emerald-950/30 border-emerald-800/30 text-emerald-300"
                : "bg-red-950/30 border-red-800/30 text-red-300"
            }`}
          >
            {agent.output}
          </div>
        </motion.div>
      )}

      {/* Status badge */}
      <div className="relative z-10 mt-3 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isRunning
              ? "bg-cyan-400 animate-pulse"
              : isCompleted
                ? "bg-emerald-400"
                : "bg-red-400"
          }`}
        />
        <span
          className={`text-xs font-mono uppercase tracking-wider ${
            isRunning
              ? "text-cyan-400"
              : isCompleted
                ? "text-emerald-400"
                : "text-red-400"
          }`}
        >
          {agent.status}
        </span>
      </div>
    </motion.div>
  );
}
