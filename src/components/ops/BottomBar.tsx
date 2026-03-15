"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Megaphone,
  Eye,
  Pause,
  Play,
  DollarSign,
  Clock,
  X,
} from "lucide-react";
import type { OpsBudget } from "@/lib/ops-types";

interface Props {
  budget: OpsBudget | null;
  onDeploySwarm: (goal: string) => void;
}

function ProgressBar({
  label,
  current,
  max,
  color,
  unit,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  unit: string;
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isWarning = pct > 80;

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span
          className={`text-[9px] tabular-nums font-semibold ${
            isWarning ? "text-amber-400" : "text-zinc-400"
          }`}
        >
          {unit === "$"
            ? `$${(current / 100).toFixed(2)} / $${(max / 100).toFixed(2)}`
            : `${current} / ${max} ${unit}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          className="h-full rounded-full transition-all"
          style={{
            background: isWarning
              ? "linear-gradient(90deg, #eab308, #ef4444)"
              : `linear-gradient(90deg, ${color}, ${color}cc)`,
            width: `${pct}%`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  );
}

export function BottomBar({ budget, onDeploySwarm }: Props) {
  const [showInput, setShowInput] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [paused, setPaused] = useState(false);

  const handleDeploy = () => {
    if (goalText.trim()) {
      onDeploySwarm(goalText.trim());
      setGoalText("");
      setShowInput(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-lg border border-zinc-800/60 p-3"
      style={{ background: "rgba(10,10,18,0.9)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-3">
        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors text-[10px] font-bold text-cyan-400 uppercase tracking-wider"
          >
            <Rocket className="w-3 h-3" />
            Deploy Swarm
          </button>

          <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors text-[10px] text-zinc-400">
            <Megaphone className="w-3 h-3" />
            <span className="hidden lg:inline">Standup</span>
          </button>

          <a
            href="/oracle"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors text-[10px] text-amber-400"
          >
            <Eye className="w-3 h-3" />
            <span className="hidden lg:inline">Oracle</span>
          </a>

          <button
            onClick={() => setPaused(!paused)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border transition-colors text-[10px] ${
              paused
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {paused ? (
              <>
                <Play className="w-3 h-3" />
                <span className="hidden lg:inline">Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                <span className="hidden lg:inline">Pause All</span>
              </>
            )}
          </button>
        </div>

        {/* Budget bars */}
        <div className="flex-1 flex items-center gap-4 min-w-0">
          <ProgressBar
            label="API Spend"
            current={budget?.api_spent_cents || 0}
            max={budget?.daily_api_budget_cents || 5000}
            color="#06b6d4"
            unit="$"
          />
          <ProgressBar
            label="Claude Code Minutes"
            current={budget?.claude_code_minutes_used || 0}
            max={budget?.daily_claude_code_minutes || 300}
            color="#8b5cf6"
            unit="min"
          />
        </div>
      </div>

      {/* Deploy input */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/40">
              <input
                type="text"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDeploy();
                  if (e.key === "Escape") setShowInput(false);
                }}
                placeholder="Enter swarm goal... (e.g. 'Fix all TypeScript errors in nexus')"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50"
                autoFocus
              />
              <button
                onClick={handleDeploy}
                disabled={!goalText.trim()}
                className="px-4 py-2 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-bold text-cyan-400 uppercase tracking-wider hover:bg-cyan-500/30 transition-colors disabled:opacity-30"
              >
                Launch
              </button>
              <button
                onClick={() => setShowInput(false)}
                className="p-2 text-zinc-600 hover:text-zinc-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
