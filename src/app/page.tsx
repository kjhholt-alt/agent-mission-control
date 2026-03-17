"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { AgentActivity } from "@/lib/types";
import type { NexusSession } from "@/lib/collector-types";
import { useNavigationHotkeys } from "@/lib/use-hotkeys";
import { useRealtimeConnection } from "@/lib/use-realtime-connection";
import { CommandBar } from "@/components/command-bar";
import { SpawnModal } from "@/components/spawn-modal";
import { Workbench } from "@/components/workbench";
import { AchievementToast } from "@/components/achievement-toast";
import { checkAchievements, type Achievement } from "@/lib/achievements";
import { playSound, playSpawnSound } from "@/lib/audio";

// Ops center panels
import { StatusRibbon } from "@/components/ops-center/StatusRibbon";
import { FleetSidebar } from "@/components/ops-center/FleetSidebar";
import { ParallelOps } from "@/components/ops-center/ParallelOps";
import { IntelFeed } from "@/components/ops-center/IntelFeed";
import { TimelineStrip } from "@/components/ops-center/TimelineStrip";

export default function MissionControl() {
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [liveSessions, setLiveSessions] = useState<NexusSession[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [workbenchTaskId, setWorkbenchTaskId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { markDataUpdate } = useRealtimeConnection();

  // ── Achievements ────────────────────────────────────────────────
  useEffect(() => {
    if (agents.length === 0 && liveSessions.length === 0) return;

    const completedMissions = agents.filter((a) => a.status === "completed").length;
    const failedMissions = agents.filter((a) => a.status === "failed").length;
    const totalTools = liveSessions.reduce((s, ses) => s + (ses.tool_count || 0), 0);
    const totalCost = liveSessions.reduce((s, ses) => s + (Number(ses.cost_usd) || 0), 0);
    const totalTokens = liveSessions.reduce(
      (s, ses) => s + (ses.input_tokens || 0) + (ses.output_tokens || 0),
      0
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

  // ── Keyboard shortcuts ──────────────────────────────────────────
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

  // ── Data fetching ───────────────────────────────────────────────
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

  useEffect(() => {
    fetchAgents();
    fetchLiveSessions();
  }, [fetchAgents, fetchLiveSessions]);

  // ── Supabase Realtime: agent_activity ───────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("agent_activity_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_activity" },
        (payload) => {
          markDataUpdate();
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
              prev.filter((a) => a.id !== (payload.old as { id: string }).id)
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
  }, [markDataUpdate]);

  // ── Supabase Realtime: nexus_sessions ───────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("nexus_sessions_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nexus_sessions" },
        (payload) => {
          markDataUpdate();
          if (payload.eventType === "INSERT") {
            setLiveSessions((prev) => [payload.new as NexusSession, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLiveSessions((prev) =>
              prev.map((s) =>
                s.session_id === (payload.new as NexusSession).session_id
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
  }, [markDataUpdate]);

  // ── Derived data ────────────────────────────────────────────────
  const activeAgents = agents.filter((a) => a.status === "running");
  const activeSessions = liveSessions.filter((s) => s.status === "active");
  const totalCost = liveSessions.reduce(
    (s, ses) => s + (Number(ses.cost_usd) || 0),
    0
  );
  const totalTokens = liveSessions.reduce(
    (s, ses) => s + (ses.input_tokens || 0) + (ses.output_tokens || 0),
    0
  );

  return (
    <>
      {/* Overlays */}
      <CommandBar
        onSpawn={() => setSpawnOpen(true)}
        onRefresh={() => {
          fetchAgents();
          fetchLiveSessions();
        }}
      />
      <SpawnModal
        open={spawnOpen}
        onClose={() => {
          setSpawnOpen(false);
          playSound(playSpawnSound);
        }}
      />
      <Workbench
        taskId={workbenchTaskId}
        onClose={() => setWorkbenchTaskId(null)}
      />
      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />

      {/* ── OPS CENTER GRID ──────────────────────────────────────── */}
      <div className="ops-viewport">
        {/* Top status ribbon */}
        <StatusRibbon
          connected={connected}
          activeAgents={activeAgents.length}
          activeSessions={activeSessions.length}
          totalCost={totalCost}
          totalTokens={totalTokens}
          onCommandOpen={() => setSpawnOpen(true)}
        />

        {/* Left: Fleet sidebar */}
        <FleetSidebar
          agents={agents}
          sessions={liveSessions}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />

        {/* Center: Parallel operations */}
        <ParallelOps
          agents={agents}
          sessions={liveSessions}
          selectedAgentId={selectedAgentId}
        />

        {/* Right: Intel feed */}
        <IntelFeed agents={agents} sessions={liveSessions} />

        {/* Bottom: Timeline strip */}
        <TimelineStrip agents={agents} sessions={liveSessions} />
      </div>
    </>
  );
}
