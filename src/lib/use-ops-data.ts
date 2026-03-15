"use client";

import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { supabase } from "@/lib/supabase";
import type { OpsTask, OpsWorker, OpsBudget, OpsEvent } from "@/lib/ops-types";

export interface OpsData {
  tasks: OpsTask[];
  workers: OpsWorker[];
  budget: OpsBudget | null;
  events: OpsEvent[];
  connected: boolean;
  lastUpdated: Date;
  refreshAll: () => Promise<void>;
  updateTaskStatus: (taskId: string, status: string) => Promise<void>;
  assignTaskToWorker: (taskId: string, workerId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
}

export function useOpsData(): OpsData {
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [workers, setWorkers] = useState<OpsWorker[]>([]);
  const [budget, setBudget] = useState<OpsBudget | null>(null);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const [tasksRes, workersRes, budgetRes, eventsRes] = await Promise.all([
      supabase
        .from("swarm_tasks")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("swarm_workers")
        .select("*")
        .order("spawned_at", { ascending: false }),
      supabase
        .from("swarm_budgets")
        .select("*")
        .order("budget_date", { ascending: false })
        .limit(1),
      supabase
        .from("swarm_task_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (!mountedRef.current) return;

    if (tasksRes.data) setTasks(tasksRes.data as OpsTask[]);
    if (workersRes.data) setWorkers(workersRes.data as OpsWorker[]);
    if (budgetRes.data && budgetRes.data.length > 0)
      setBudget(budgetRes.data[0] as OpsBudget);
    if (eventsRes.data) setEvents(eventsRes.data as OpsEvent[]);
    // If swarm_task_log doesn't exist, synthesize events from tasks
    if (eventsRes.error && tasksRes.data) {
      const syntheticEvents: OpsEvent[] = (tasksRes.data as OpsTask[])
        .filter((t) => t.completed_at || t.started_at)
        .slice(0, 100)
        .map((t) => ({
          id: `synth-${t.id}`,
          task_id: t.id,
          worker_id: t.assigned_worker_id,
          event_type: t.status === "completed" ? "task_complete" : t.status === "failed" ? "task_failed" : "task_started",
          title: t.title,
          details: null,
          project: t.project,
          created_at: t.completed_at || t.started_at || t.updated_at,
        }));
      setEvents(syntheticEvents);
    }

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
      .channel("ops-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_tasks" },
        (payload) => {
          startTransition(() => {
            if (payload.eventType === "INSERT") {
              setTasks((prev) => [payload.new as OpsTask, ...prev]);
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
                prev.map((existing) =>
                  existing.id === w.id ? w : existing
                )
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
        { event: "*", schema: "public", table: "swarm_budgets" },
        (payload) => {
          startTransition(() => {
            if (
              payload.eventType === "UPDATE" ||
              payload.eventType === "INSERT"
            ) {
              setBudget(payload.new as OpsBudget);
            }
            setLastUpdated(new Date());
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_task_log" },
        (payload) => {
          startTransition(() => {
            if (payload.eventType === "INSERT") {
              setEvents((prev) =>
                [payload.new as OpsEvent, ...prev].slice(0, 100)
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

  const updateTaskStatus = useCallback(
    async (taskId: string, status: string) => {
      const updates: Record<string, unknown> = { status };
      if (status === "in_progress") {
        updates.started_at = new Date().toISOString();
      } else if (status === "completed" || status === "failed") {
        updates.completed_at = new Date().toISOString();
      }
      await supabase.from("swarm_tasks").update(updates).eq("id", taskId);
    },
    []
  );

  const assignTaskToWorker = useCallback(
    async (taskId: string, workerId: string) => {
      await supabase
        .from("swarm_tasks")
        .update({
          assigned_worker_id: workerId,
          status: "queued",
        })
        .eq("id", taskId);
    },
    []
  );

  const cancelTask = useCallback(async (taskId: string) => {
    await supabase
      .from("swarm_tasks")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
  }, []);

  return {
    tasks,
    workers,
    budget,
    events,
    connected,
    lastUpdated,
    refreshAll: fetchAll,
    updateTaskStatus,
    assignTaskToWorker,
    cancelTask,
  };
}
