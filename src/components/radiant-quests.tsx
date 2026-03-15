"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Wrench,
  Lightbulb,
  Rocket,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

interface RadiantQuest {
  id: string;
  title: string;
  description: string;
  project: string;
  worker_type: string;
  priority: number;
  category: "health" | "growth" | "maintenance" | "opportunity";
  severity: "critical" | "high" | "medium" | "low";
  auto_goal: string;
}

const CATEGORY_CONFIG = {
  health: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  growth: {
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  maintenance: {
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  opportunity: {
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500 animate-pulse",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-zinc-500",
};

interface RadiantQuestsProps {
  onLaunch?: (goal: string, project: string, workerType: string) => void;
}

export function RadiantQuests({ onLaunch }: RadiantQuestsProps) {
  const [quests, setQuests] = useState<RadiantQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchQuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/radiant");
      if (res.ok) {
        const data = await res.json();
        setQuests(data.quests || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuests();
    // Refresh every 5 minutes
    const interval = setInterval(fetchQuests, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchQuests]);

  if (loading && quests.length === 0) {
    return (
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 text-center">
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-zinc-600" />
        <p className="text-xs text-zinc-600">Scanning project state...</p>
      </div>
    );
  }

  if (quests.length === 0) {
    return (
      <div className="bg-zinc-900/30 border border-emerald-500/10 rounded-xl p-6 text-center">
        <Sparkles className="w-5 h-5 mx-auto mb-2 text-emerald-400 opacity-50" />
        <p className="text-sm text-emerald-400/70">All clear</p>
        <p className="text-xs text-zinc-600 mt-1">
          No recommended tasks right now
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Recommended Missions
          </h3>
          <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
            {quests.length}
          </span>
        </div>
        <button
          onClick={fetchQuests}
          className="p-1 rounded hover:bg-white/5 text-zinc-600 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {quests.map((quest, i) => {
          const catCfg = CATEGORY_CONFIG[quest.category];
          const expanded = expandedId === quest.id;

          return (
            <motion.div
              key={quest.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.05 }}
              className={`border rounded-lg overflow-hidden transition-colors ${catCfg.bg}`}
            >
              <button
                onClick={() => setExpandedId(expanded ? null : quest.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[quest.severity]}`} />
                <span className={catCfg.color}>{catCfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{quest.title}</p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {quest.project} · {quest.worker_type}
                  </p>
                </div>
                <ChevronRight
                  className={`w-3 h-3 text-zinc-600 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-xs text-zinc-400">
                        {quest.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLaunch?.(
                              quest.auto_goal,
                              quest.project,
                              quest.worker_type
                            );
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] hover:bg-cyan-500/30 transition-colors"
                        >
                          <Rocket className="w-3 h-3" />
                          Launch Mission
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(quest.auto_goal);
                          }}
                          className="px-3 py-1.5 rounded-lg text-[10px] text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Copy Goal
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
