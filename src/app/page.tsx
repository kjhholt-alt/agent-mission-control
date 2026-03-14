"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Satellite, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AgentActivity } from "@/lib/types";
import { ParticleBackground } from "@/components/particles";
import { LiveClock } from "@/components/live-clock";
import { StatsBar } from "@/components/stats-bar";
import { AgentCard } from "@/components/agent-card";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AgentHistory } from "@/components/agent-history";

export default function MissionControl() {
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents || []);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("agent_activity_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_activity",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAgents((prev) => [payload.new as AgentActivity, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setAgents((prev) =>
              prev.map((a) =>
                a.id === (payload.new as AgentActivity).id
                  ? (payload.new as AgentActivity)
                  : a
              )
            );
          } else if (payload.eventType === "DELETE") {
            setAgents((prev) =>
              prev.filter(
                (a) => a.id !== (payload.old as { id: string }).id
              )
            );
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeAgents = agents.filter((a) => a.status === "running");

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await fetch("/api/agents/seed", { method: "POST" });
      await fetchAgents();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0a0a0f" }}>
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline-overlay pointer-events-none z-50 opacity-[0.015]" />

      {/* Particle background */}
      <ParticleBackground activeCount={activeAgents.length} />

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <Satellite className="w-8 h-8 text-cyan-400" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3">
                <span
                  className={`absolute inset-0 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-600"} ${connected ? "animate-ping" : ""} opacity-75`}
                />
                <span
                  className={`relative block w-3 h-3 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-600"}`}
                />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-glow-cyan">
                <span className="text-cyan-400">MISSION</span>{" "}
                <span className="text-zinc-200">CONTROL</span>
              </h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                Agent Operations Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LiveClock />
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAgents}
                className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-zinc-400" />
              </button>
              <button
                onClick={seedDemo}
                disabled={seeding}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors text-xs text-cyan-400 disabled:opacity-50"
              >
                <Zap className="w-3 h-3" />
                {seeding ? "Seeding..." : "Seed Demo"}
              </button>
            </div>
          </div>
        </motion.header>

        {/* Stats Bar */}
        <StatsBar agents={agents} />

        {/* Active Agents */}
        <section>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 mb-4"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              Active Agents
            </h2>
            {activeAgents.length > 0 && (
              <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                {activeAgents.length}
              </span>
            )}
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {activeAgents.length > 0 ? (
                activeAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-2 text-center py-12 text-zinc-600 border border-zinc-800/50 rounded-xl bg-zinc-900/30"
                >
                  <Satellite className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No active agents</p>
                  <p className="text-xs text-zinc-700 mt-1">
                    Agents will appear here when they report via heartbeat
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Activity Timeline */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Activity Timeline (24h)
          </h2>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 backdrop-blur-sm">
            <ActivityTimeline agents={agents} />
          </div>
        </motion.section>

        {/* Agent History */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Agent History
          </h2>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 backdrop-blur-sm">
            <AgentHistory agents={agents} />
          </div>
        </motion.section>

        {/* Footer */}
        <footer className="text-center text-xs text-zinc-700 py-4 border-t border-zinc-800/30">
          MISSION CONTROL v1.0 &middot; Powered by Supabase Realtime &middot;{" "}
          {agents.length} agents tracked
        </footer>
      </div>
    </div>
  );
}
