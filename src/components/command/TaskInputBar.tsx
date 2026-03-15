"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Megaphone, Eye, X } from "lucide-react";

interface Props {
  onDeployTask: (goal: string) => void;
  recentTasks: string[];
}

export function TaskInputBar({ onDeployTask, recentTasks }: Props) {
  const [goalText, setGoalText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const text = goalText.trim();
    if (text) {
      onDeployTask(text);
      setGoalText("");
    }
  }, [goalText, onDeployTask]);

  return (
    <div
      className="rounded-lg border border-zinc-800/60 p-2.5"
      style={{ background: "rgba(10,10,18,0.9)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-2">
        {/* Input */}
        <div className="flex-1 flex items-center gap-2">
          <Rocket className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Type a task and press Enter to deploy..."
            className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none"
          />
          {goalText.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleSubmit}
              className="px-3 py-1 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-[9px] font-bold text-cyan-400 uppercase tracking-wider hover:bg-cyan-500/30 transition-colors"
            >
              Deploy
            </motion.button>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1 border-l border-zinc-800/40 pl-2">
          <a
            href="/ops"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/40 border border-zinc-700/40 hover:border-zinc-600 transition-colors text-[9px] text-zinc-500 hover:text-zinc-300"
          >
            <Megaphone className="w-2.5 h-2.5" />
            Standup
          </a>
          <a
            href="/oracle"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors text-[9px] text-amber-400/80"
          >
            <Eye className="w-2.5 h-2.5" />
            Oracle
          </a>
        </div>
      </div>

      {/* Recent tasks pills */}
      <AnimatePresence>
        {recentTasks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/30 flex-wrap">
              <span className="text-[7px] uppercase tracking-wider text-zinc-700">
                Recent:
              </span>
              {recentTasks.slice(0, 4).map((task, i) => (
                <span
                  key={i}
                  className="text-[8px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800/40 border border-zinc-800/60 max-w-[150px] truncate"
                >
                  {task}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
