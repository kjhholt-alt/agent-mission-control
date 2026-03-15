"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { supabase } from "@/lib/supabase";
import type { OpsTask, OpsWorker } from "@/lib/ops-types";
import type { AgentActivity } from "@/lib/types";

export interface CommandData {
  tasks: OpsTask[];
  workers: OpsWorker[];
  agentActivity: AgentActivity[];
  connected: boolean;
  lastUpdated: Date;
  deployTask: (goal: string) => Promise<void>;
}

export function useCommandData(): CommandData {
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [workers, setWorkers] = useState<OpsWorker[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const [tasksRes, workersRes, activityRes] = await Promise.all([
      supabase
        .from("swarm_tasks")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("swarm_workers")
        .select("*")
        .order("spawned_at", { ascending: false }),
      supabase
        .from("agent_activity")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(30),
    ]);

    if (!mountedRef.current) return;

    if (tasksRes.data) setTasks(tasksRes.data as OpsTask[]);
    if (workersRes.data) setWorkers(workersRes.data as OpsWorker[]);
    if (activityRes.data) setAgentActivity(activityRes.data as AgentActivity[]);
    setLastUpdated(new Date());
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAll();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("command-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_tasks" },
        (payload) => {
          startTransition(() => {
            if (payload.eventType === "INSERT") {
              setTasks((prev) => [payload.new as OpsTask, ...prev].slice(0, 100));
            } else if (payload.eventType === "UPDATE") {
              const t = payload.new as OpsTask;
              setTasks((prev) =>
                prev.map((existing) => (existing.id === t.id ? t : existing))
              );
            } else if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              setTasks((prev) => prev.filter((t) => t.id !== old.id));
            }
            setLastUpdated(new Date());
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_workers" },
        (payload) => {
          startTransition(() => {
            if (payload.eventType === "INSERT") {
              setWorkers((prev) => [payload.new as OpsWorker, ...prev]);
            } else if (payload.eventType === "UPDATE") {
              const w = payload.new as OpsWorker;
              setWorkers((prev) =>
                prev.map((existing) => (existing.id === w.id ? w : existing))
              );
            } else if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              setWorkers((prev) => prev.filter((w) => w.id !== old.id));
            }
            setLastUpdated(new Date());
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_activity" },
        (payload) => {
          startTransition(() => {
            if (payload.eventType === "INSERT") {
              setAgentActivity((prev) =>
                [payload.new as AgentActivity, ...prev].slice(0, 30)
              );
            } else if (payload.eventType === "UPDATE") {
              const a = payload.new as AgentActivity;
              setAgentActivity((prev) =>
                prev.map((existing) => (existing.id === a.id ? a : existing))
              );
            }
            setLastUpdated(new Date());
          });
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const deployTask = useCallback(async (goal: string) => {
    // Create a new task in Supabase
    await supabase.from("swarm_tasks").insert({
      task_type: "build",
      title: goal,
      status: "queued",
      priority: 5,
      cost_cents: 0,
      tokens_used: 0,
    });
  }, []);

  return {
    tasks,
    workers,
    agentActivity,
    connected,
    lastUpdated,
    deployTask,
  };
}
