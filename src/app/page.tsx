"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Satellite, Zap, RefreshCw, Rocket, Cpu } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AgentActivity } from "@/lib/types";
import type { NexusSession } from "@/lib/collector-types";
import { formatCost } from "@/lib/pricing";
import { ParticleBackground } from "@/components/particles";
import { LiveClock } from "@/components/live-clock";
import { StatsBar } from "@/components/stats-bar";
import { AgentCard } from "@/components/agent-card";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AgentHistory } from "@/components/agent-history";
import { LiveFeed } from "@/components/live-feed";
import { CommandBar } from "@/components/command-bar";
import { SpawnModal } from "@/components/spawn-modal";
import { RadiantQuests } from "@/components/radiant-quests";
import { AchievementToast } from "@/components/achievement-toast";
import { useNavigationHotkeys } from "@/lib/use-hotkeys";
import { checkAchievements, type Achievement } from "@/lib/achievements";
import { playSound, playSpawnSound } from "@/lib/audio";
import { DaemonPanel } from "@/components/daemon-panel";
import { Workbench } from "@/components/workbench";

export default function MissionControl() {
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [liveSessions, setLiveSessions] = useState<NexusSession[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [workbenchTaskId, setWorkbenchTaskId] = useState<string | null>(null);

  // Check achievements when data changes
  useEffect(() => {
    if (agents.length === 0 && liveSessions.length === 0) return;

    const completedMissions = agents.filter((a) => a.status === "completed").length;
    const failedMissions = agents.filter((a) => a.status === "failed").length;
    const totalTools = liveSessions.reduce((s, ses) => s + (ses.tool_count || 0), 0);
    const totalCost = liveSessions.reduce((s, ses) => s + (Number(ses.cost_usd) || 0), 0);
    const totalTokens = liveSessions.reduce(
      (s, ses) => s + (ses.input_tokens || 0) + (ses.output_tokens || 0), 0
    );
    const projects = new Set(liveSessions.map((s) => s.project_name).filter(Boolean));

    const unlocked = checkAchievements({
      total_missions: agents.length,
      completed_missions: completedMissions,
      failed_missions: failedMissions,
      total_sessions: liveSessions.length,
      total_cost: totalCost,
      total_tools: totalTools,
      total_tokens: totalTokens,
      projects_used: projects.size,
    });

    if (unlocked.length > 0) setNewAchievements(unlocked);
  }, [agents, liveSessions]);

  // Global keyboard shortcuts (1-7 navigate, N=new mission, R=refresh)
  useNavigationHotkeys([
    { key: "n", handler: () => setSpawnOpen(true) },
    {
      key: "r",
      handler: () => {
        fetchAgents();
        fetchLiveSessions();
      },
    },
  ]);

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents || []);
    }
  }, []);

  const fetchLiveSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/collector/agents");
      if (res.ok) {
        const data = await res.json();
        setLiveSessions(data.sessions || []);
      }
    } catch {
      // Collector might not have data yet
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAgents();
    fetchLiveSessions();
  }, [fetchAgents, fetchLiveSessions]);

  // Supabase realtime — agent_activity
  useEffect(() => {
    const channel = supabase
      .channel("agent_activity_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_activity" },
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

  // Supabase realtime — nexus_sessions (live Claude Code sessions)
  useEffect(() => {
    const channel = supabase
      .channel("nexus_sessions_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nexus_sessions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLiveSessions((prev) => [
              payload.new as NexusSession,
              ...prev,
            ]);
          } else if (payload.eventType === "UPDATE") {
            setLiveSessions((prev) =>
              prev.map((s) =>
                s.session_id ===
                (payload.new as NexusSession).session_id
                  ? (payload.new as NexusSession)
                  : s
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeAgents = agents.filter((a) => a.status === "running");
  const activeSessions = liveSessions.filter((s) => s.status === "active");

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
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0f" }}
    >
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline-overlay pointer-events-none z-50 opacity-[0.015]" />

      {/* Particle background */}
      <ParticleBackground
        activeCount={activeAgents.length + activeSessions.length}
      />

      {/* Command bar (Ctrl+K) */}
      <CommandBar
        onSpawn={() => setSpawnOpen(true)}
        onRefresh={() => {
          fetchAgents();
          fetchLiveSessions();
        }}
      />

      {/* Spawn modal */}
      <SpawnModal
        open={spawnOpen}
        onClose={() => {
          setSpawnOpen(false);
          playSound(playSpawnSound);
        }}
      />

      {/* Workbench deep-dive panel */}
      <Workbench
        taskId={workbenchTaskId}
        onClose={() => setWorkbenchTaskId(null)}
      />

      {/* Achievement toasts */}
      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />

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
                <span className="text-cyan-400">NEXUS</span>
              </h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                Agent Operations Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LiveClock />

            {/* New Mission button */}
            <button
              onClick={() => setSpawnOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm text-cyan-400 font-medium"
            >
              <Rocket className="w-4 h-4" />
              New Mission
            </button>

            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchAgents();
                  fetchLiveSessions();
                }}
                className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors"
                title="Refresh (Ctrl+K → R)"
              >
                <RefreshCw className="w-4 h-4 text-zinc-400" />
              </button>
              <button
                onClick={seedDemo}
                disabled={seeding}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors text-xs text-zinc-400 disabled:opacity-50"
              >
                <Zap className="w-3 h-3" />
                {seeding ? "..." : "Demo"}
              </button>
            </div>

            {/* Ctrl+K hint */}
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-zinc-600 px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              Ctrl+K
            </kbd>
          </div>
        </motion.header>

        {/* Stats Bar */}
        <StatsBar agents={agents} />

        {/* Live Claude Code Sessions */}
        {activeSessions.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Live Sessions
              </h2>
              <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
                {activeSessions.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="bg-zinc-900/50 border border-purple-500/10 rounded-xl p-4 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">
                      {session.project_name || "unknown"}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-purple-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>
                  {session.current_tool && (
                    <p className="text-xs text-zinc-500 mb-2 truncate">
                      Using:{" "}
                      <span className="text-cyan-400">
                        {session.current_tool}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span>{session.tool_count || 0} tools</span>
                    <span className="text-zinc-800">|</span>
                    <span>{formatCost(Number(session.cost_usd) || 0)}</span>
                    <span className="text-zinc-800">|</span>
                    <span className="text-zinc-500">
                      {session.model?.includes("opus")
                        ? "Opus"
                        : session.model?.includes("haiku")
                          ? "Haiku"
                          : "Sonnet"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Live Feed + Radiant Quests side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-2"
          >
            <LiveFeed onTaskClick={(id) => setWorkbenchTaskId(id)} />
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <RadiantQuests
              onLaunch={(goal, project) => {
                setSpawnOpen(true);
                // The spawn modal will pick up the goal from template
              }}
            />
          </motion.section>
        </div>

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
                    Hit{" "}
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-cyan-400 text-[10px]">
                      Ctrl+K
                    </kbd>{" "}
                    or click{" "}
                    <span className="text-cyan-400">New Mission</span> to
                    deploy one
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
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 backdrop-blur-sm dashboard-timeline-wrap">
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
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 backdrop-blur-sm dashboard-table-wrap">
            <AgentHistory agents={agents} />
          </div>
        </motion.section>

        {/* Daemon Panel (only visible in Tauri desktop app) */}
        <DaemonPanel />

        {/* Footer */}
        <footer className="text-center text-xs text-zinc-700 py-4 border-t border-zinc-800/30">
          NEXUS v2.0 &middot; Powered by Supabase Realtime &middot;{" "}
          {agents.length} agents &middot; {liveSessions.length} sessions
          tracked
        </footer>
      </div>
    </div>
  );
}
