"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

// ─── DATA ───────────────────────────────────────────────────────────────────

interface Building {
  id: string;
  name: string;
  shortName: string;
  color: string;
  glowColor: string;
  topColor: string;
  leftColor: string;
  rightColor: string;
  size: number; // multiplier
  gridX: number;
  gridY: number;
  status: "active" | "idle" | "warning";
  description: string;
  stats: { tests: number; deploys: number; uptime: string };
}

interface Worker {
  id: string;
  name: string;
  color: string;
  currentBuildingId: string;
  targetBuildingId: string;
  task: string;
  progress: number;
  speechBubble: string | null;
  status: "moving" | "working" | "idle";
}

interface ConveyorBelt {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
  color: string;
  dataType: string;
  active: boolean;
}

interface AlertEvent {
  id: string;
  time: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

const TILE_W = 80;
const TILE_H = 40;

const BUILDINGS: Building[] = [
  {
    id: "command-center",
    name: "Command Center",
    shortName: "CMD",
    color: "#e8a019",
    glowColor: "rgba(232, 160, 25, 0.4)",
    topColor: "#f5c842",
    leftColor: "#c4870f",
    rightColor: "#9a6a08",
    size: 3,
    gridX: 5,
    gridY: 5,
    status: "active",
    description: "ClawBot / Admin Dashboard — Central AI orchestration hub",
    stats: { tests: 142, deploys: 38, uptime: "99.7%" },
  },
  {
    id: "moneyprinter",
    name: "MoneyPrinter Nexus",
    shortName: "MP",
    color: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.4)",
    topColor: "#60a5fa",
    leftColor: "#2563eb",
    rightColor: "#1d4ed8",
    size: 2.5,
    gridX: 1,
    gridY: 2,
    status: "active",
    description: "Polymarket whale-copy trading bot — Live and printing",
    stats: { tests: 89, deploys: 67, uptime: "98.2%" },
  },
  {
    id: "buildkit",
    name: "BuildKit Services HQ",
    shortName: "BK",
    color: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.4)",
    topColor: "#22d3ee",
    leftColor: "#0891b2",
    rightColor: "#0e7490",
    size: 2,
    gridX: 9,
    gridY: 2,
    status: "active",
    description: "Infrastructure hub — DNS, deployments, monitoring",
    stats: { tests: 56, deploys: 24, uptime: "99.9%" },
  },
  {
    id: "email-finder",
    name: "Email Finder Lab",
    shortName: "EML",
    color: "#8b5cf6",
    glowColor: "rgba(139, 92, 246, 0.4)",
    topColor: "#a78bfa",
    leftColor: "#7c3aed",
    rightColor: "#6d28d9",
    size: 1.5,
    gridX: 2,
    gridY: 8,
    status: "idle",
    description: "Lead enrichment — Email discovery and validation",
    stats: { tests: 34, deploys: 12, uptime: "97.5%" },
  },
  {
    id: "barrelhouse",
    name: "BarrelHouse CRM",
    shortName: "BH",
    color: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.4)",
    topColor: "#fbbf24",
    leftColor: "#d97706",
    rightColor: "#b45309",
    size: 2,
    gridX: 8,
    gridY: 8,
    status: "active",
    description: "Franchise CRM — Phase 2 complete, client demo ready",
    stats: { tests: 178, deploys: 45, uptime: "99.1%" },
  },
  {
    id: "pc-bottleneck",
    name: "PC Bottleneck Factory",
    shortName: "PCB",
    color: "#f97316",
    glowColor: "rgba(249, 115, 22, 0.4)",
    topColor: "#fb923c",
    leftColor: "#ea580c",
    rightColor: "#c2410c",
    size: 2,
    gridX: 12,
    gridY: 5,
    status: "active",
    description: "Flagship product — pcbottleneck.buildkit.store, Amazon affiliate",
    stats: { tests: 203, deploys: 52, uptime: "99.8%" },
  },
  {
    id: "outdoor-crm",
    name: "Outdoor CRM Barracks",
    shortName: "OCR",
    color: "#22c55e",
    glowColor: "rgba(34, 197, 94, 0.4)",
    topColor: "#4ade80",
    leftColor: "#16a34a",
    rightColor: "#15803d",
    size: 1.5,
    gridX: 0,
    gridY: 5,
    status: "idle",
    description: "AATOS Outdoor CRM — React + Django, proposal sent",
    stats: { tests: 267, deploys: 31, uptime: "99.4%" },
  },
  {
    id: "chess-academy",
    name: "Chess Academy",
    shortName: "CHE",
    color: "#14b8a6",
    glowColor: "rgba(20, 184, 166, 0.4)",
    topColor: "#2dd4bf",
    leftColor: "#0d9488",
    rightColor: "#0f766e",
    size: 1.5,
    gridX: 5,
    gridY: 1,
    status: "idle",
    description: "AI Chess Coach — Lichess integration, analysis engine",
    stats: { tests: 45, deploys: 8, uptime: "99.0%" },
  },
  {
    id: "finance-brief",
    name: "Finance Brief Tower",
    shortName: "FIN",
    color: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.4)",
    topColor: "#34d399",
    leftColor: "#059669",
    rightColor: "#047857",
    size: 2,
    gridX: 11,
    gridY: 1,
    status: "active",
    description: "AI Finance Brief — Daily market digest, SEO autopilot",
    stats: { tests: 78, deploys: 41, uptime: "99.6%" },
  },
  {
    id: "automation-hub",
    name: "Automation Hub",
    shortName: "N8N",
    color: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.4)",
    topColor: "#c084fc",
    leftColor: "#9333ea",
    rightColor: "#7e22ce",
    size: 2,
    gridX: 3,
    gridY: 10,
    status: "active",
    description: "n8n workflow hub — 6 active workflows, Railway hosted",
    stats: { tests: 12, deploys: 19, uptime: "98.8%" },
  },
  {
    id: "pl-engine",
    name: "PL Engine Forge",
    shortName: "PLE",
    color: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.4)",
    topColor: "#f87171",
    leftColor: "#dc2626",
    rightColor: "#b91c1c",
    size: 1.5,
    gridX: 7,
    gridY: 11,
    status: "warning",
    description: "P&L Engine — Archived, data still accessible",
    stats: { tests: 156, deploys: 28, uptime: "0%" },
  },
  {
    id: "mcp-array",
    name: "MCP Server Array",
    shortName: "MCP",
    color: "#e2e8f0",
    glowColor: "rgba(226, 232, 240, 0.3)",
    topColor: "#f1f5f9",
    leftColor: "#cbd5e1",
    rightColor: "#94a3b8",
    size: 1.5,
    gridX: 12,
    gridY: 9,
    status: "active",
    description: "MCP server infrastructure — 12 servers configured",
    stats: { tests: 0, deploys: 12, uptime: "99.5%" },
  },
];

const SPEECH_BUBBLES = [
  "Mining data...",
  "PR ready!",
  "Job's done!",
  "Build passing...",
  "Deploying...",
  "Tests green!",
  "Scanning domain...",
  "Found an email!",
  "Whale detected!",
  "Copying trade...",
  "Crunching numbers...",
  "Optimizing...",
  "Pipeline complete!",
  "Workflow triggered!",
];

const INITIAL_WORKERS: Worker[] = [
  {
    id: "w1",
    name: "Alpha-7",
    color: "#e8a019",
    currentBuildingId: "command-center",
    targetBuildingId: "moneyprinter",
    task: "Deploying whale-watch update",
    progress: 65,
    speechBubble: null,
    status: "moving",
  },
  {
    id: "w2",
    name: "Beta-3",
    color: "#3b82f6",
    currentBuildingId: "moneyprinter",
    targetBuildingId: "automation-hub",
    task: "Syncing P&L data to n8n",
    progress: 30,
    speechBubble: null,
    status: "working",
  },
  {
    id: "w3",
    name: "Gamma-9",
    color: "#22c55e",
    currentBuildingId: "pc-bottleneck",
    targetBuildingId: "finance-brief",
    task: "Running SEO autopilot cycle",
    progress: 82,
    speechBubble: null,
    status: "moving",
  },
  {
    id: "w4",
    name: "Delta-1",
    color: "#8b5cf6",
    currentBuildingId: "barrelhouse",
    targetBuildingId: "buildkit",
    task: "Deploying CRM Phase 2 update",
    progress: 45,
    speechBubble: null,
    status: "working",
  },
  {
    id: "w5",
    name: "Epsilon-5",
    color: "#ef4444",
    currentBuildingId: "automation-hub",
    targetBuildingId: "command-center",
    task: "Health check sweep",
    progress: 90,
    speechBubble: null,
    status: "moving",
  },
];

const CONVEYORS: ConveyorBelt[] = [
  { id: "c1", fromBuildingId: "command-center", toBuildingId: "moneyprinter", color: "#3b82f6", dataType: "code", active: true },
  { id: "c2", fromBuildingId: "command-center", toBuildingId: "buildkit", color: "#06b6d4", dataType: "config", active: true },
  { id: "c3", fromBuildingId: "moneyprinter", toBuildingId: "automation-hub", color: "#a855f7", dataType: "data", active: true },
  { id: "c4", fromBuildingId: "automation-hub", toBuildingId: "command-center", color: "#e8a019", dataType: "alerts", active: true },
  { id: "c5", fromBuildingId: "pc-bottleneck", toBuildingId: "finance-brief", color: "#10b981", dataType: "revenue", active: true },
  { id: "c6", fromBuildingId: "buildkit", toBuildingId: "barrelhouse", color: "#f59e0b", dataType: "deploy", active: true },
  { id: "c7", fromBuildingId: "barrelhouse", toBuildingId: "pc-bottleneck", color: "#f97316", dataType: "tests", active: false },
  { id: "c8", fromBuildingId: "command-center", toBuildingId: "chess-academy", color: "#14b8a6", dataType: "code", active: false },
  { id: "c9", fromBuildingId: "finance-brief", toBuildingId: "automation-hub", color: "#a855f7", dataType: "data", active: true },
  { id: "c10", fromBuildingId: "mcp-array", toBuildingId: "command-center", color: "#e2e8f0", dataType: "config", active: true },
];

const INITIAL_EVENTS: AlertEvent[] = [
  { id: "e1", time: "14:32:01", message: "MoneyPrinter: Whale copy executed — $42.50 USDC.e", type: "success" },
  { id: "e2", time: "14:31:45", message: "Autopilot SEO: Published 'Best GPUs for AI Training 2026'", type: "info" },
  { id: "e3", time: "14:30:12", message: "BarrelHouse CRM: Phase 2 deploy successful", type: "success" },
  { id: "e4", time: "14:28:55", message: "n8n Workflow: Daily P&L digest sent to Discord", type: "info" },
  { id: "e5", time: "14:27:30", message: "PL Engine: Service archived — no heartbeat", type: "warning" },
  { id: "e6", time: "14:25:01", message: "PC Bottleneck: 12 new Amazon clicks today", type: "success" },
  { id: "e7", time: "14:22:18", message: "Health Check: All 6 services responding", type: "info" },
  { id: "e8", time: "14:20:00", message: "Finance Brief: Market brief delivered — 3 recipients", type: "success" },
];

const NEW_EVENT_MESSAGES = [
  { message: "MoneyPrinter: Position opened on 'Will ETH hit $5k?'", type: "info" as const },
  { message: "Worker Alpha-7 completed deployment task", type: "success" as const },
  { message: "Autopilot: New blog post queued for review", type: "info" as const },
  { message: "MCP Array: 12 servers healthy, 0 degraded", type: "success" as const },
  { message: "Chess Academy: Lichess API rate limit warning", type: "warning" as const },
  { message: "BuildKit: SSL certificate renewed for buildkit.store", type: "success" as const },
  { message: "n8n: Whale performance report generated", type: "info" as const },
  { message: "MoneyPrinter: Stale position timeout — auto-exited", type: "warning" as const },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function gridToIso(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function IsometricBuilding({
  building,
  isHovered,
  isSelected,
  onHover,
  onClick,
}: {
  building: Building;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const { x, y } = gridToIso(building.gridX, building.gridY);
  const w = 60 * building.size;
  const h = 35 * building.size;
  const depth = 30 * building.size;

  return (
    <motion.g
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(building.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(building.id)}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: Math.random() * 0.5 }}
    >
      {/* Glow shadow */}
      <ellipse
        cx={x}
        cy={y + depth + 5}
        rx={w * 0.7}
        ry={h * 0.4}
        fill={building.glowColor}
        opacity={building.status === "active" ? 0.6 : 0.2}
      >
        {building.status === "active" && (
          <animate
            attributeName="opacity"
            values="0.3;0.7;0.3"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </ellipse>

      {/* Right face */}
      <polygon
        points={`${x},${y} ${x + w / 2},${y + h / 2} ${x + w / 2},${y + h / 2 + depth} ${x},${y + depth}`}
        fill={building.rightColor}
        stroke={isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.1)"}
        strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
      />

      {/* Left face */}
      <polygon
        points={`${x},${y} ${x - w / 2},${y + h / 2} ${x - w / 2},${y + h / 2 + depth} ${x},${y + depth}`}
        fill={building.leftColor}
        stroke={isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.1)"}
        strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
      />

      {/* Top face */}
      <polygon
        points={`${x},${y - h} ${x + w / 2},${y - h / 2} ${x},${y} ${x - w / 2},${y - h / 2}`}
        fill={building.topColor}
        stroke={isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.15)"}
        strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
        opacity={0.9}
      />

      {/* Front edge highlight */}
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + depth}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1}
      />

      {/* Status indicator dot */}
      <circle
        cx={x}
        cy={y - h - 8}
        r={3}
        fill={
          building.status === "active"
            ? "#22c55e"
            : building.status === "warning"
            ? "#f59e0b"
            : "#6b7280"
        }
      >
        {building.status === "active" && (
          <animate
            attributeName="r"
            values="2;4;2"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Label */}
      <text
        x={x}
        y={y - h - 16}
        textAnchor="middle"
        fill={isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.7)"}
        fontSize={isHovered || isSelected ? 11 : 9}
        fontFamily="var(--font-mono), monospace"
        fontWeight={isHovered || isSelected ? "bold" : "normal"}
        style={{
          textShadow: `0 0 8px ${building.glowColor}`,
          transition: "all 0.2s",
        }}
      >
        {building.shortName}
      </text>
    </motion.g>
  );
}

function ConveyorBeltLine({
  conveyor,
  buildings,
}: {
  conveyor: ConveyorBelt;
  buildings: Building[];
}) {
  const from = buildings.find((b) => b.id === conveyor.fromBuildingId);
  const to = buildings.find((b) => b.id === conveyor.toBuildingId);
  if (!from || !to) return null;

  const p1 = gridToIso(from.gridX, from.gridY);
  const p2 = gridToIso(to.gridX, to.gridY);

  const pathId = `conveyor-${conveyor.id}`;

  return (
    <g opacity={conveyor.active ? 0.7 : 0.2}>
      {/* Conveyor line */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={conveyor.color}
        strokeWidth={conveyor.active ? 2 : 1}
        strokeDasharray="8 6"
        opacity={0.5}
      >
        {conveyor.active && (
          <animate
            attributeName="stroke-dashoffset"
            values="0;-28"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </line>

      {/* Data packets flowing along */}
      {conveyor.active && (
        <>
          <path
            id={pathId}
            d={`M${p1.x},${p1.y} L${p2.x},${p2.y}`}
            fill="none"
            stroke="none"
          />
          {[0, 0.33, 0.66].map((offset, i) => (
            <circle key={i} r={2.5} fill={conveyor.color} opacity={0.9}>
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                begin={`${offset * 3}s`}
                path={`M${p1.x},${p1.y} L${p2.x},${p2.y}`}
              />
              <animate
                attributeName="r"
                values="1.5;3;1.5"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </>
      )}
    </g>
  );
}

function WorkerSprite({
  worker,
  buildings,
  onHover,
  onClick,
  isSelected,
}: {
  worker: Worker;
  buildings: Building[];
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  isSelected: boolean;
}) {
  const current = buildings.find((b) => b.id === worker.currentBuildingId);
  const target = buildings.find((b) => b.id === worker.targetBuildingId);
  if (!current || !target) return null;

  const p1 = gridToIso(current.gridX, current.gridY);
  const p2 = gridToIso(target.gridX, target.gridY);

  // Lerp position based on progress
  const t = worker.progress / 100;
  const cx = p1.x + (p2.x - p1.x) * t;
  const cy = p1.y + (p2.y - p1.y) * t - 10; // float above ground

  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(worker.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(worker.id)}
    >
      {/* Trail */}
      {worker.status === "moving" && (
        <line
          x1={p1.x}
          y1={p1.y - 10}
          x2={cx}
          y2={cy}
          stroke={worker.color}
          strokeWidth={1}
          opacity={0.15}
          strokeDasharray="3 3"
        />
      )}

      {/* Worker glow */}
      <circle cx={cx} cy={cy} r={8} fill={worker.color} opacity={0.15}>
        <animate
          attributeName="r"
          values="6;10;6"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Worker body */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={worker.color}
        stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
        strokeWidth={isSelected ? 2 : 1}
      />

      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={2} fill="#fff" opacity={0.8} />

      {/* Name label */}
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fill="rgba(255,255,255,0.6)"
        fontSize={7}
        fontFamily="var(--font-mono), monospace"
      >
        {worker.name}
      </text>

      {/* Speech bubble */}
      {worker.speechBubble && (
        <g>
          <rect
            x={cx - 40}
            y={cy - 38}
            width={80}
            height={18}
            rx={4}
            fill="rgba(0,0,0,0.85)"
            stroke={worker.color}
            strokeWidth={0.5}
          />
          <polygon
            points={`${cx - 4},${cy - 20} ${cx + 4},${cy - 20} ${cx},${cy - 15}`}
            fill="rgba(0,0,0,0.85)"
          />
          <text
            x={cx}
            y={cy - 26}
            textAnchor="middle"
            fill={worker.color}
            fontSize={7}
            fontFamily="var(--font-mono), monospace"
          >
            {worker.speechBubble}
          </text>
        </g>
      )}
    </g>
  );
}

function BackgroundParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.3 + 0.05,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: `rgba(6, 182, 212, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(6, 182, 212, ${p.opacity})`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function Minimap({
  buildings,
  workers,
}: {
  buildings: Building[];
  workers: Worker[];
}) {
  return (
    <div
      className="absolute bottom-4 left-4 z-30 border rounded-lg overflow-hidden"
      style={{
        width: 180,
        height: 120,
        background: "rgba(5, 5, 8, 0.85)",
        borderColor: "rgba(6, 182, 212, 0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="absolute top-0 left-0 px-2 py-0.5 text-[8px] uppercase tracking-widest"
        style={{ color: "rgba(6, 182, 212, 0.7)" }}
      >
        MINIMAP
      </div>
      <svg viewBox="-120 -20 600 340" width={180} height={120}>
        {/* Grid dots */}
        {Array.from({ length: 14 }, (_, x) =>
          Array.from({ length: 14 }, (_, y) => {
            const pos = gridToIso(x, y);
            return (
              <circle
                key={`${x}-${y}`}
                cx={pos.x}
                cy={pos.y}
                r={0.5}
                fill="rgba(255,255,255,0.1)"
              />
            );
          })
        )}

        {/* Building dots */}
        {buildings.map((b) => {
          const pos = gridToIso(b.gridX, b.gridY);
          return (
            <rect
              key={b.id}
              x={pos.x - 3 * b.size}
              y={pos.y - 2 * b.size}
              width={6 * b.size}
              height={4 * b.size}
              fill={b.color}
              opacity={0.8}
              rx={1}
            />
          );
        })}

        {/* Worker dots */}
        {workers.map((w) => {
          const current = buildings.find(
            (b) => b.id === w.currentBuildingId
          );
          const target = buildings.find((b) => b.id === w.targetBuildingId);
          if (!current || !target) return null;
          const p1 = gridToIso(current.gridX, current.gridY);
          const p2 = gridToIso(target.gridX, target.gridY);
          const t = w.progress / 100;
          return (
            <circle
              key={w.id}
              cx={p1.x + (p2.x - p1.x) * t}
              cy={p1.y + (p2.y - p1.y) * t}
              r={2}
              fill="#fff"
            >
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

function AlertFeed({ events }: { events: AlertEvent[] }) {
  const typeColors: Record<string, string> = {
    success: "#22c55e",
    info: "#06b6d4",
    warning: "#f59e0b",
    error: "#ef4444",
  };

  return (
    <div
      className="absolute bottom-4 right-4 z-30 border rounded-lg overflow-hidden"
      style={{
        width: 360,
        maxHeight: 200,
        background: "rgba(5, 5, 8, 0.85)",
        borderColor: "rgba(6, 182, 212, 0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="px-3 py-1.5 text-[9px] uppercase tracking-widest border-b flex items-center gap-2"
        style={{
          color: "rgba(6, 182, 212, 0.7)",
          borderColor: "rgba(6, 182, 212, 0.15)",
        }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "#22c55e" }}
        />
        LIVE FEED
      </div>
      <div className="overflow-y-auto p-2 space-y-1" style={{ maxHeight: 170 }}>
        <AnimatePresence initial={false}>
          {events.map((evt) => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-2 text-[10px]"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              <span style={{ color: "rgba(255,255,255,0.3)" }}>{evt.time}</span>
              <span
                className="inline-block w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: typeColors[evt.type] }}
              />
              <span style={{ color: typeColors[evt.type], opacity: 0.9 }}>
                {evt.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BuildingPanel({
  building,
  onClose,
}: {
  building: Building;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-16 right-4 z-40 border rounded-xl overflow-hidden"
      style={{
        width: 320,
        background: "rgba(5, 5, 8, 0.92)",
        borderColor: building.color + "55",
        backdropFilter: "blur(12px)",
        boxShadow: `0 0 30px ${building.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{ borderColor: building.color + "22" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: building.color,
                boxShadow: `0 0 8px ${building.glowColor}`,
              }}
            />
            <span
              className="text-sm font-bold"
              style={{
                color: building.color,
                textShadow: `0 0 10px ${building.glowColor}`,
              }}
            >
              {building.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs opacity-40 hover:opacity-100 transition-opacity px-2 py-1"
            style={{ color: "#fff" }}
          >
            ESC
          </button>
        </div>
        <p
          className="text-[10px] mt-2 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {building.description}
        </p>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        {[
          { label: "Tests", value: building.stats.tests, color: "#22c55e" },
          { label: "Deploys", value: building.stats.deploys, color: "#3b82f6" },
          { label: "Uptime", value: building.stats.uptime, color: "#e8a019" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className="text-lg font-bold"
              style={{
                color: stat.color,
                textShadow: `0 0 8px ${stat.color}44`,
              }}
            >
              {stat.value}
            </div>
            <div
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div
        className="px-4 pb-4 flex items-center gap-2"
      >
        <div
          className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold"
          style={{
            background:
              building.status === "active"
                ? "rgba(34, 197, 94, 0.15)"
                : building.status === "warning"
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(107, 114, 128, 0.15)",
            color:
              building.status === "active"
                ? "#22c55e"
                : building.status === "warning"
                ? "#f59e0b"
                : "#6b7280",
            border: `1px solid ${
              building.status === "active"
                ? "rgba(34, 197, 94, 0.3)"
                : building.status === "warning"
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(107, 114, 128, 0.3)"
            }`,
          }}
        >
          {building.status}
        </div>
        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          Grid [{building.gridX}, {building.gridY}]
        </span>
      </div>
    </motion.div>
  );
}

function WorkerPanel({
  worker,
  buildings,
  onClose,
}: {
  worker: Worker;
  buildings: Building[];
  onClose: () => void;
}) {
  const current = buildings.find((b) => b.id === worker.currentBuildingId);
  const target = buildings.find((b) => b.id === worker.targetBuildingId);

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-16 right-4 z-40 border rounded-xl overflow-hidden"
      style={{
        width: 320,
        background: "rgba(5, 5, 8, 0.92)",
        borderColor: worker.color + "55",
        backdropFilter: "blur(12px)",
        boxShadow: `0 0 30px ${worker.color}33, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{ borderColor: worker.color + "22" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: worker.color,
                boxShadow: `0 0 8px ${worker.color}88`,
              }}
            />
            <span
              className="text-sm font-bold"
              style={{
                color: worker.color,
                textShadow: `0 0 10px ${worker.color}55`,
              }}
            >
              Worker {worker.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs opacity-40 hover:opacity-100 transition-opacity px-2 py-1"
            style={{ color: "#fff" }}
          >
            ESC
          </button>
        </div>
      </div>

      {/* Task info */}
      <div className="p-4 space-y-3">
        <div>
          <div
            className="text-[9px] uppercase tracking-wider mb-1"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Current Task
          </div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
            {worker.task}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div
              className="text-[9px] uppercase tracking-wider mb-1"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              From
            </div>
            <div className="text-[11px]" style={{ color: current?.color }}>
              {current?.shortName}
            </div>
          </div>
          <div>
            <div
              className="text-[9px] uppercase tracking-wider mb-1"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              To
            </div>
            <div className="text-[11px]" style={{ color: target?.color }}>
              {target?.shortName}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Progress
            </span>
            <span
              className="text-[10px] font-bold"
              style={{ color: worker.color }}
            >
              {worker.progress}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: worker.color }}
              initial={{ width: 0 }}
              animate={{ width: `${worker.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <div
            className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold"
            style={{
              background: `${worker.color}15`,
              color: worker.color,
              border: `1px solid ${worker.color}33`,
            }}
          >
            {worker.status}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="p-4 border-t grid grid-cols-3 gap-2"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        {[
          { label: "Resume", color: "#22c55e" },
          { label: "Redirect", color: "#f59e0b" },
          { label: "Stop", color: "#ef4444" },
        ].map((action) => (
          <button
            key={action.label}
            className="py-1.5 rounded text-[9px] uppercase tracking-wider font-bold transition-all hover:brightness-125"
            style={{
              background: `${action.color}15`,
              color: action.color,
              border: `1px solid ${action.color}33`,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function HUDTopBar({
  time,
  activeCount,
  completedCount,
  testCount,
}: {
  time: string;
  activeCount: number;
  completedCount: number;
  testCount: number;
}) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(5,5,8,0.95) 0%, rgba(5,5,8,0.7) 80%, transparent 100%)",
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Left — Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: "#22c55e",
              boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
            }}
          />
          <span
            className="text-sm font-bold tracking-[0.3em] uppercase"
            style={{
              color: "#e8a019",
              textShadow: "0 0 20px rgba(232, 160, 25, 0.4)",
            }}
          >
            MISSION CONTROL
          </span>
        </div>
        <span
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          |
        </span>
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: "rgba(6, 182, 212, 0.6)" }}
        >
          Isometric View
        </span>
      </div>

      {/* Center — Clock */}
      <div
        className="text-sm font-bold tabular-nums"
        style={{
          color: "rgba(6, 182, 212, 0.8)",
          textShadow: "0 0 10px rgba(6, 182, 212, 0.3)",
        }}
      >
        {time}
      </div>

      {/* Right — Stats */}
      <div className="flex items-center gap-5">
        {[
          { label: "Active", value: activeCount, color: "#22c55e" },
          { label: "Completed", value: completedCount, color: "#06b6d4" },
          { label: "Tests", value: testCount, color: "#8b5cf6" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {stat.label}
            </span>
            <span
              className="text-xs font-bold"
              style={{
                color: stat.color,
                textShadow: `0 0 8px ${stat.color}44`,
              }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceBar() {
  const resources = [
    { label: "API Tokens", value: "847K", max: "1M", pct: 84.7, color: "#e8a019" },
    { label: "Session Cost", value: "$2.14", max: "$10", pct: 21.4, color: "#06b6d4" },
    { label: "Uptime", value: "6d 14h", max: "", pct: 95, color: "#22c55e" },
  ];

  return (
    <div
      className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6 px-5 py-2 rounded-full border"
      style={{
        background: "rgba(5, 5, 8, 0.8)",
        borderColor: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(8px)",
      }}
    >
      {resources.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span
            className="text-[8px] uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {r.label}
          </span>
          <div
            className="w-16 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${r.pct}%`,
                background: r.color,
                boxShadow: `0 0 6px ${r.color}66`,
              }}
            />
          </div>
          <span
            className="text-[9px] font-bold tabular-nums"
            style={{ color: r.color }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function GamePage() {
  const [time, setTime] = useState(formatTime());
  const [workers, setWorkers] = useState(INITIAL_WORKERS);
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [hoveredWorker, setHoveredWorker] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Animate workers
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkers((prev) =>
        prev.map((w) => {
          let newProgress = w.progress + (Math.random() * 3 + 1);
          let newStatus = w.status;
          let newCurrent = w.currentBuildingId;
          let newTarget = w.targetBuildingId;
          let newTask = w.task;
          let newSpeech = w.speechBubble;

          // Random speech bubbles
          if (Math.random() < 0.05) {
            newSpeech =
              SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)];
          } else if (Math.random() < 0.15) {
            newSpeech = null;
          }

          if (newProgress >= 100) {
            // Arrived — pick new destination
            newProgress = 0;
            newCurrent = w.targetBuildingId;
            const others = BUILDINGS.filter((b) => b.id !== newCurrent);
            const next = others[Math.floor(Math.random() * others.length)];
            newTarget = next.id;
            newStatus = Math.random() > 0.3 ? "moving" : "working";
            const tasks = [
              "Deploying latest changes",
              "Running test suite",
              "Syncing data pipeline",
              "Health check sweep",
              "Optimizing queries",
              "Generating SEO content",
              "Processing whale signals",
              "Building CRM module",
              "Updating MCP configs",
              "Analyzing trade data",
            ];
            newTask = tasks[Math.floor(Math.random() * tasks.length)];
            newSpeech = "Job's done!";
          }

          return {
            ...w,
            progress: newProgress,
            status: newStatus,
            currentBuildingId: newCurrent,
            targetBuildingId: newTarget,
            task: newTask,
            speechBubble: newSpeech,
          };
        })
      );
    }, 400);

    return () => clearInterval(interval);
  }, []);

  // New events
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        const msg =
          NEW_EVENT_MESSAGES[
            Math.floor(Math.random() * NEW_EVENT_MESSAGES.length)
          ];
        const newEvent: AlertEvent = {
          id: `e-${Date.now()}`,
          time: formatTime(),
          message: msg.message,
          type: msg.type,
        };
        setEvents((prev) => [newEvent, ...prev].slice(0, 20));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Camera controls
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(0.3, Math.min(3, prev.zoom - e.deltaY * 0.001)),
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setCamera((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedBuilding(null);
        setSelectedWorker(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selectedBuildingData = BUILDINGS.find(
    (b) => b.id === selectedBuilding
  );
  const selectedWorkerData = workers.find((w) => w.id === selectedWorker);

  const activeCount = workers.filter(
    (w) => w.status === "moving" || w.status === "working"
  ).length;

  // Tooltip for hovered building
  const hoveredBuildingData = BUILDINGS.find((b) => b.id === hoveredBuilding);

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: "#050508",
        fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
      }}
    >
      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.015) 2px, rgba(0, 255, 255, 0.015) 4px)",
        }}
      />

      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Background particles */}
      <BackgroundParticles />

      {/* HUD */}
      <HUDTopBar
        time={time}
        activeCount={activeCount}
        completedCount={47}
        testCount={872}
      />
      <ResourceBar />

      {/* Isometric viewport */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-10"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            transformOrigin: "center center",
          }}
        >
          {/* Center the iso world */}
          <g transform="translate(960, 300)">
            {/* Grid dots */}
            {Array.from({ length: 15 }, (_, gx) =>
              Array.from({ length: 15 }, (_, gy) => {
                const { x, y } = gridToIso(gx, gy);
                return (
                  <circle
                    key={`g-${gx}-${gy}`}
                    cx={x}
                    cy={y}
                    r={1}
                    fill="rgba(6, 182, 212, 0.08)"
                  />
                );
              })
            )}

            {/* Conveyor belts (behind buildings) */}
            {CONVEYORS.map((c) => (
              <ConveyorBeltLine key={c.id} conveyor={c} buildings={BUILDINGS} />
            ))}

            {/* Buildings (sorted by Y for proper depth) */}
            {[...BUILDINGS]
              .sort(
                (a, b) =>
                  a.gridX + a.gridY - (b.gridX + b.gridY)
              )
              .map((building) => (
                <IsometricBuilding
                  key={building.id}
                  building={building}
                  isHovered={hoveredBuilding === building.id}
                  isSelected={selectedBuilding === building.id}
                  onHover={setHoveredBuilding}
                  onClick={(id) => {
                    setSelectedBuilding(id);
                    setSelectedWorker(null);
                  }}
                />
              ))}

            {/* Workers (on top) */}
            {workers.map((w) => (
              <WorkerSprite
                key={w.id}
                worker={w}
                buildings={BUILDINGS}
                onHover={setHoveredWorker}
                onClick={(id) => {
                  setSelectedWorker(id);
                  setSelectedBuilding(null);
                }}
                isSelected={selectedWorker === w.id}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Building tooltip on hover */}
      <AnimatePresence>
        {hoveredBuildingData && !selectedBuilding && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-40 pointer-events-none px-3 py-2 rounded-lg border"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(5, 5, 8, 0.9)",
              borderColor: hoveredBuildingData.color + "44",
              boxShadow: `0 0 20px ${hoveredBuildingData.glowColor}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: hoveredBuildingData.color }}
              />
              <span
                className="text-xs font-bold"
                style={{ color: hoveredBuildingData.color }}
              >
                {hoveredBuildingData.name}
              </span>
            </div>
            <div
              className="text-[9px]"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {hoveredBuildingData.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side panels */}
      <AnimatePresence>
        {selectedBuildingData && (
          <BuildingPanel
            building={selectedBuildingData}
            onClose={() => setSelectedBuilding(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedWorkerData && (
          <WorkerPanel
            worker={selectedWorkerData}
            buildings={BUILDINGS}
            onClose={() => setSelectedWorker(null)}
          />
        )}
      </AnimatePresence>

      {/* Minimap */}
      <Minimap buildings={BUILDINGS} workers={workers} />

      {/* Alert feed */}
      <AlertFeed events={events} />

      {/* Burst particles on worker completion — visual flair */}
      <CompletionParticles workers={workers} buildings={BUILDINGS} />
    </div>
  );
}

// Burst particles when workers complete tasks
function CompletionParticles({
  workers,
  buildings,
}: {
  workers: Worker[];
  buildings: Building[];
}) {
  const [bursts, setBursts] = useState<
    { id: string; x: number; y: number; color: string }[]
  >([]);

  const prevProgress = useRef<Record<string, number>>({});

  useEffect(() => {
    workers.forEach((w) => {
      const prev = prevProgress.current[w.id] ?? w.progress;
      if (prev > 80 && w.progress < 10) {
        // Worker just completed (progress reset)
        const target = buildings.find((b) => b.id === w.currentBuildingId);
        if (target) {
          const pos = gridToIso(target.gridX, target.gridY);
          const burst = {
            id: `burst-${Date.now()}-${w.id}`,
            x: pos.x + 960, // match SVG translation
            y: pos.y + 300,
            color: w.color,
          };
          setBursts((prev) => [...prev, burst]);
          setTimeout(() => {
            setBursts((prev) =>
              prev.filter((b) => b.id !== burst.id)
            );
          }, 1200);
        }
      }
      prevProgress.current[w.id] = w.progress;
    });
  }, [workers, buildings]);

  return (
    <div className="fixed inset-0 pointer-events-none z-20">
      <AnimatePresence>
        {bursts.map((burst) => (
          <BurstEffect
            key={burst.id}
            x={burst.x}
            y={burst.y}
            color={burst.color}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function BurstEffect({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        angle: (i / 8) * Math.PI * 2,
        dist: 20 + Math.random() * 30,
        size: 2 + Math.random() * 3,
      })),
    []
  );

  return (
    <>
      {sparks.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: x,
            top: y,
            width: s.size,
            height: s.size,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
          initial={{ opacity: 1, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos(s.angle) * s.dist,
            y: Math.sin(s.angle) * s.dist,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      ))}
    </>
  );
}
