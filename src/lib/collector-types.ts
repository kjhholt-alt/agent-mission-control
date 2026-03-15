// ── Nexus Collector Types ──────────────────────────────────────────

export type SessionStatus = "active" | "idle" | "completed";

export type HookEventType =
  | "PreToolUse"
  | "PostToolUse"
  | "Stop"
  | "Notification"
  | "SubagentStart"
  | "SubagentStop";

export interface NexusSession {
  id: string;
  session_id: string;
  project_name: string | null;
  workspace_path: string | null;
  model: string | null;
  status: SessionStatus;
  started_at: string;
  last_activity: string;
  completed_at: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  current_tool: string | null;
  tool_count: number;
}

export interface NexusHookEvent {
  id: string;
  session_id: string;
  event_type: HookEventType;
  tool_name: string | null;
  project_name: string | null;
  model: string | null;
  created_at: string;
}

export interface HookEventPayload {
  session_id: string;
  event_type: HookEventType;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  project_name?: string;
  workspace_path?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

// ── Mission Templates ──────────────────────────────────────────────

export type WorkerType =
  | "builder"
  | "inspector"
  | "miner"
  | "scout"
  | "deployer"
  | "messenger"
  | "any";

export type TemplateCategory =
  | "build"
  | "review"
  | "prospect"
  | "deploy"
  | "research"
  | "maintenance";

export interface MissionTemplate {
  id: string;
  name: string;
  goal: string;
  project: string;
  worker_type: WorkerType;
  category: TemplateCategory;
  priority: number;
  created_at: string;
  updated_at: string;
}

// ── Spawn & Deploy ─────────────────────────────────────────────────

export interface SpawnPayload {
  goal: string;
  project: string;
  priority?: number;
  worker_type?: WorkerType;
}

export interface DeployPayload {
  project: string;
  target: "vercel" | "railway";
  branch?: string;
}
