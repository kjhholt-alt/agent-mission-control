"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type SpawnResult = "success" | "error" | null;

export function useSpawnTask() {
  const [isSpawning, setIsSpawning] = useState(false);
  const [lastResult, setLastResult] = useState<SpawnResult>(null);

  const spawnTask = useCallback(
    async (projectId: string, taskDescription: string): Promise<SpawnResult> => {
      setIsSpawning(true);
      setLastResult(null);

      try {
        const { error } = await supabase.from("swarm_tasks").insert({
          title: taskDescription,
          project: projectId,
          status: "queued",
          priority: "medium",
          created_at: new Date().toISOString(),
        });

        const result: SpawnResult = error ? "error" : "success";
        if (error) {
          console.error("[useSpawnTask] insert failed:", error.message);
        }
        setLastResult(result);
        return result;
      } catch (err) {
        console.error("[useSpawnTask] unexpected error:", err);
        setLastResult("error");
        return "error";
      } finally {
        setIsSpawning(false);
      }
    },
    []
  );

  return { spawnTask, isSpawning, lastResult };
}
