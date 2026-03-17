// ─── OPS DASHBOARD TYPES ─────────────────────────────────────────────────────

export interface OpsTask {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  project: string | null;
  status: string; // "pending" | "queued" | "in_progress" | "completed" | "failed" | "blocked"
  priority: number;
  assigned_worker_id: string | null;
  worker_type: string | null;
  parent_task_id: string | null;
  depends_on: string[] | null;
  cost_cents: number;
  tokens_used: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface OpsWorker {
  id: string;
  worker_name: string;
  worker_type: string;
  tier: string;
  status: string; // "idle" | "busy" | "dead"
  current_task_id: string | null;
  last_heartbeat: string;
  pid: number | null;
  tasks_completed: number;
  tasks_failed: number;
  total_cost_cents: number;
  total_tokens: number;
  xp: number;
  spawned_at: string;
  died_at: string | null;
}

export interface OpsBudget {
  id: string;
  budget_date: string;
  daily_api_budget_cents: number;
  daily_claude_code_minutes: number;
  api_spent_cents: number;
  claude_code_minutes_used: number;
  tasks_completed: number;
  tasks_failed: number;
  updated_at: string;
}

export interface OpsEvent {
  id: string;
  task_id: string | null;
  worker_id: string | null;
  event_type: string;
  title: string;
  details: string | null;
  project: string | null;
  created_at: string;
}

export type KanbanColumn = "queued" | "running" | "blocked" | "complete";

export const KANBAN_COLUMNS: { key: KanbanColumn; label: string; borderColor: string; bgColor: string }[] = [
  { key: "queued", label: "QUEUED", borderColor: "border-cyan-500", bgColor: "bg-cyan-500/5" },
  { key: "running", label: "RUNNING", borderColor: "border-emerald-500", bgColor: "bg-emerald-500/5" },
  { key: "blocked", label: "BLOCKED", borderColor: "border-amber-500", bgColor: "bg-amber-500/5" },
  { key: "complete", label: "COMPLETE", borderColor: "border-emerald-400", bgColor: "bg-emerald-400/5" },
];

export const WORKER_TYPE_ICONS: Record<string, string> = {
  builder: "Hammer",
  inspector: "Search",
  miner: "Pickaxe",
  scout: "Radar",
  deployer: "Rocket",
  messenger: "Send",
  browser: "Globe",
  supervisor: "Shield",
  light: "Zap",
  heavy: "Anvil",
};

export const PROJECT_COLORS: Record<string, string> = {
  "pl-engine": "#8b5cf6",
  "nexus": "#06b6d4",
  "buildkit-services": "#f59e0b",
  "email-finder": "#ec4899",
  "barrelhouse": "#ef4444",
  "pc-bottleneck": "#10b981",
  "outdoor-crm": "#3b82f6",
  "ai-chess-coach": "#a855f7",
  "ai-finance-brief": "#14b8a6",
  "automation-playground": "#f97316",
  "mcp-servers": "#6366f1",
  general: "#6b7280",
};

export function getProjectColor(project: string | null): string {
  if (!project) return PROJECT_COLORS.general;
  // Check exact match first, then partial
  if (PROJECT_COLORS[project]) return PROJECT_COLORS[project];
  const key = Object.keys(PROJECT_COLORS).find((k) => project.includes(k));
  return key ? PROJECT_COLORS[key] : PROJECT_COLORS.general;
}

export function workerDisplayName(raw: string): string {
  const names: Record<string, string[]> = {
    light: ["Spark", "Glint", "Wisp", "Flicker", "Pulse", "Beam"],
    heavy: ["Hammer", "Anvil", "Forge", "Titan", "Colossus", "Golem"],
    inspector: ["Lens", "Scope", "Prism", "Optic", "Reticle", "Scan"],
    deployer: ["Igniter", "Launch", "Rocket", "Blast", "Thrust", "Orbit"],
    miner: ["Digger", "Drill", "Pick", "Shard", "Vein", "Core"],
    scout: ["Wind", "Swift", "Dart", "Arrow", "Hawk", "Echo"],
    messenger: ["Signal", "Relay", "Link", "Wave", "Ping", "Bolt"],
    builder: ["Block", "Brick", "Frame", "Girder", "Weld", "Rivet"],
  };
  const prefix = raw.split("-")[0];
  const hash = raw.split("-").slice(1).join("");
  const pool = names[prefix] || names.builder!;
  const idx = parseInt(hash.slice(0, 4), 16) % pool.length;
  return pool[idx] || "Unit";
}

export function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "--";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function formatDuration(startStr: string | null, endStr?: string | null): string {
  if (!startStr) return "--";
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const diff = end - start;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ${Math.floor((diff % 60_000) / 1000)}s`;
  return `${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`;
}

export function xpToLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}
