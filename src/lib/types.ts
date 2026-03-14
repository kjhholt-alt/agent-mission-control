export interface AgentActivity {
  id: string;
  agent_id: string;
  agent_name: string;
  project: string;
  status: "running" | "completed" | "failed" | "idle";
  current_step: string | null;
  steps_completed: number;
  total_steps: number | null;
  output: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface HeartbeatPayload {
  agent_id: string;
  agent_name: string;
  project: string;
  status: "running" | "completed" | "failed";
  current_step?: string;
  steps_completed?: number;
  total_steps?: number;
  output?: string;
}
