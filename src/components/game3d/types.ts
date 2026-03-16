// ─── GAME 3D TYPES ──────────────────────────────────────────────────────────

export interface Building {
  id: string;
  name: string;
  shortName: string;
  color: string;
  glowColor: string;
  topColor: string;
  leftColor: string;
  rightColor: string;
  size: number;
  gridX: number;
  gridY: number;
  status: "active" | "idle" | "warning" | "error";
  description: string;
  stats: { tests: number; deploys: number; uptime: string };
}

export type WorkerType =
  | "builder"
  | "inspector"
  | "miner"
  | "scout"
  | "deployer"
  | "messenger"
  | "browser"
  | "supervisor";

export interface Worker {
  id: string;
  name: string;
  type: WorkerType;
  color: string;
  level: number;
  xp: number;
  currentBuildingId: string;
  targetBuildingId: string;
  task: string;
  progress: number;
  speechBubble: string | null;
  status: "moving" | "working" | "idle";
  evolving: boolean;
}

export interface ConveyorBelt {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
  color: string;
  dataType:
    | "code"
    | "tests"
    | "revenue"
    | "errors"
    | "config"
    | "data"
    | "deploy"
    | "alerts";
  active: boolean;
  throughput: number;
}

export interface AlertEvent {
  id: string;
  time: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

export interface WorkerTypeConfig {
  color: string;
  icon: string;
  shape: "square" | "diamond" | "circle" | "triangle" | "hexagon" | "bolt" | "dodecahedron" | "star";
  trailColor: string;
  label: string;
}
