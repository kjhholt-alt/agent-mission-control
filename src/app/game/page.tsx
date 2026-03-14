"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Building {
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
  status: "active" | "idle" | "warning";
  description: string;
  stats: { tests: number; deploys: number; uptime: string };
}

type WorkerType = "builder" | "inspector" | "miner" | "scout" | "deployer" | "messenger";

interface Worker {
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

interface ConveyorBelt {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
  color: string;
  dataType: "code" | "tests" | "revenue" | "errors" | "config" | "data" | "deploy" | "alerts";
  active: boolean;
  throughput: number;
}

interface AlertEvent {
  id: string;
  time: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TILE_W = 80;
const TILE_H = 40;

const WORKER_TYPE_CONFIG: Record<WorkerType, {
  color: string;
  icon: string;
  shape: "square" | "diamond" | "circle" | "triangle" | "hexagon" | "bolt";
  trailColor: string;
  label: string;
}> = {
  builder:   { color: "#06b6d4", icon: "H", shape: "square",   trailColor: "#06b6d4", label: "Builder" },
  inspector: { color: "#eab308", icon: "Q", shape: "diamond",  trailColor: "#eab308", label: "Inspector" },
  miner:     { color: "#22c55e", icon: "P", shape: "circle",   trailColor: "#22c55e", label: "Miner" },
  scout:     { color: "#a855f7", icon: "W", shape: "triangle", trailColor: "#a855f7", label: "Scout" },
  deployer:  { color: "#f97316", icon: "R", shape: "hexagon",  trailColor: "#f97316", label: "Deployer" },
  messenger: { color: "#3b82f6", icon: "Z", shape: "bolt",     trailColor: "#3b82f6", label: "Messenger" },
};

const DATA_TYPE_COLORS: Record<string, string> = {
  code:    "#3b82f6",
  tests:   "#22c55e",
  revenue: "#eab308",
  errors:  "#ef4444",
  config:  "#06b6d4",
  data:    "#a855f7",
  deploy:  "#f97316",
  alerts:  "#e8a019",
};

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
    description: "ClawBot / Admin Dashboard -- Central AI orchestration hub",
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
    description: "Polymarket whale-copy trading bot -- Live and printing",
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
    description: "Infrastructure hub -- DNS, deployments, monitoring",
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
    description: "Lead enrichment -- Email discovery and validation",
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
    description: "Franchise CRM -- Phase 2 complete, client demo ready",
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
    description: "Flagship product -- pcbottleneck.buildkit.store, Amazon affiliate",
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
    description: "AATOS Outdoor CRM -- React + Django, proposal sent",
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
    description: "AI Chess Coach -- Lichess integration, analysis engine",
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
    description: "AI Finance Brief -- Daily market digest, SEO autopilot",
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
    description: "n8n workflow hub -- 6 active workflows, Railway hosted",
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
    description: "P&L Engine -- Archived, data still accessible",
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
    description: "MCP server infrastructure -- 12 servers configured",
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
    name: "Hammerhead",
    type: "builder",
    color: "#06b6d4",
    level: 5,
    xp: 47,
    currentBuildingId: "command-center",
    targetBuildingId: "moneyprinter",
    task: "Building whale-watch update",
    progress: 65,
    speechBubble: null,
    status: "moving",
    evolving: false,
  },
  {
    id: "w2",
    name: "Lens",
    type: "inspector",
    color: "#eab308",
    level: 3,
    xp: 28,
    currentBuildingId: "moneyprinter",
    targetBuildingId: "automation-hub",
    task: "Auditing P&L data pipeline",
    progress: 30,
    speechBubble: null,
    status: "working",
    evolving: false,
  },
  {
    id: "w3",
    name: "Digger",
    type: "miner",
    color: "#22c55e",
    level: 7,
    xp: 63,
    currentBuildingId: "pc-bottleneck",
    targetBuildingId: "finance-brief",
    task: "Mining SEO keyword data",
    progress: 82,
    speechBubble: null,
    status: "moving",
    evolving: false,
  },
  {
    id: "w4",
    name: "Windrider",
    type: "scout",
    color: "#a855f7",
    level: 2,
    xp: 15,
    currentBuildingId: "barrelhouse",
    targetBuildingId: "buildkit",
    task: "Scouting CRM Phase 3 features",
    progress: 45,
    speechBubble: null,
    status: "working",
    evolving: false,
  },
  {
    id: "w5",
    name: "Igniter",
    type: "deployer",
    color: "#f97316",
    level: 4,
    xp: 38,
    currentBuildingId: "automation-hub",
    targetBuildingId: "command-center",
    task: "Deploying health check sweep",
    progress: 90,
    speechBubble: null,
    status: "moving",
    evolving: false,
  },
  {
    id: "w6",
    name: "Sparky",
    type: "messenger",
    color: "#3b82f6",
    level: 6,
    xp: 55,
    currentBuildingId: "command-center",
    targetBuildingId: "barrelhouse",
    task: "Sending deploy notifications",
    progress: 20,
    speechBubble: null,
    status: "moving",
    evolving: false,
  },
];

const CONVEYORS: ConveyorBelt[] = [
  { id: "c1", fromBuildingId: "command-center", toBuildingId: "moneyprinter", color: "#3b82f6", dataType: "code", active: true, throughput: 24 },
  { id: "c2", fromBuildingId: "command-center", toBuildingId: "buildkit", color: "#06b6d4", dataType: "config", active: true, throughput: 18 },
  { id: "c3", fromBuildingId: "moneyprinter", toBuildingId: "automation-hub", color: "#a855f7", dataType: "data", active: true, throughput: 42 },
  { id: "c4", fromBuildingId: "automation-hub", toBuildingId: "command-center", color: "#e8a019", dataType: "alerts", active: true, throughput: 8 },
  { id: "c5", fromBuildingId: "pc-bottleneck", toBuildingId: "finance-brief", color: "#eab308", dataType: "revenue", active: true, throughput: 15 },
  { id: "c6", fromBuildingId: "buildkit", toBuildingId: "barrelhouse", color: "#f59e0b", dataType: "deploy", active: true, throughput: 6 },
  { id: "c7", fromBuildingId: "barrelhouse", toBuildingId: "pc-bottleneck", color: "#22c55e", dataType: "tests", active: false, throughput: 0 },
  { id: "c8", fromBuildingId: "command-center", toBuildingId: "chess-academy", color: "#14b8a6", dataType: "code", active: false, throughput: 0 },
  { id: "c9", fromBuildingId: "finance-brief", toBuildingId: "automation-hub", color: "#a855f7", dataType: "data", active: true, throughput: 31 },
  { id: "c10", fromBuildingId: "mcp-array", toBuildingId: "command-center", color: "#e2e8f0", dataType: "config", active: true, throughput: 12 },
];

const INITIAL_EVENTS: AlertEvent[] = [
  { id: "e1", time: "14:32:01", message: "MoneyPrinter: Whale copy executed -- $42.50 USDC.e", type: "success" },
  { id: "e2", time: "14:31:45", message: "Autopilot SEO: Published 'Best GPUs for AI Training 2026'", type: "info" },
  { id: "e3", time: "14:30:12", message: "BarrelHouse CRM: Phase 2 deploy successful", type: "success" },
  { id: "e4", time: "14:28:55", message: "n8n Workflow: Daily P&L digest sent to Discord", type: "info" },
  { id: "e5", time: "14:27:30", message: "PL Engine: Service archived -- no heartbeat", type: "warning" },
  { id: "e6", time: "14:25:01", message: "PC Bottleneck: 12 new Amazon clicks today", type: "success" },
  { id: "e7", time: "14:22:18", message: "Health Check: All 6 services responding", type: "info" },
  { id: "e8", time: "14:20:00", message: "Finance Brief: Market brief delivered -- 3 recipients", type: "success" },
];

const NEW_EVENT_MESSAGES = [
  { message: "MoneyPrinter: Position opened on 'Will ETH hit $5k?'", type: "info" as const },
  { message: "Worker Hammerhead completed build task", type: "success" as const },
  { message: "Autopilot: New blog post queued for review", type: "info" as const },
  { message: "MCP Array: 12 servers healthy, 0 degraded", type: "success" as const },
  { message: "Chess Academy: Lichess API rate limit warning", type: "warning" as const },
  { message: "BuildKit: SSL certificate renewed for buildkit.store", type: "success" as const },
  { message: "n8n: Whale performance report generated", type: "info" as const },
  { message: "MoneyPrinter: Stale position timeout -- auto-exited", type: "warning" as const },
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

// ─── SVG DEFS (filters, gradients, patterns) ────────────────────────────────

function SvgDefs() {
  return (
    <defs>
      {/* Holographic edge glow filter */}
      <filter id="holoGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feColorMatrix in="blur" type="saturate" values="3" result="saturated" />
        <feMerge>
          <feMergeNode in="saturated" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Energy core glow */}
      <filter id="energyCore" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feColorMatrix in="blur" type="saturate" values="5" result="saturated" />
        <feMerge>
          <feMergeNode in="saturated" />
          <feMergeNode in="saturated" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Selection ring glow */}
      <filter id="selectionGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Worker aura */}
      <filter id="workerAura" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Force field dome gradient */}
      <radialGradient id="forceFieldGrad" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stopColor="rgba(6, 182, 212, 0.02)" />
        <stop offset="70%" stopColor="rgba(6, 182, 212, 0.04)" />
        <stop offset="95%" stopColor="rgba(6, 182, 212, 0.08)" />
        <stop offset="100%" stopColor="rgba(6, 182, 212, 0.15)" />
      </radialGradient>

      {/* Conveyor belt pattern */}
      <pattern id="beltPattern" x="0" y="0" width="12" height="6" patternUnits="userSpaceOnUse">
        <rect width="12" height="6" fill="rgba(255,255,255,0.03)" />
        <rect x="1" y="1" width="10" height="4" rx="1" fill="rgba(255,255,255,0.06)" />
      </pattern>

      {/* Fog gradient for minimap */}
      <radialGradient id="fogOfWar" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="60%" stopColor="transparent" />
        <stop offset="100%" stopColor="rgba(5, 5, 8, 0.9)" />
      </radialGradient>
    </defs>
  );
}

// ─── FORCE FIELD DOME ────────────────────────────────────────────────────────

function ForceFieldDome() {
  return (
    <g>
      {/* Large elliptical dome over the base */}
      <ellipse
        cx={0}
        cy={220}
        rx={560}
        ry={340}
        fill="url(#forceFieldGrad)"
        stroke="rgba(6, 182, 212, 0.06)"
        strokeWidth={1.5}
        strokeDasharray="4 8"
      >
        <animate
          attributeName="stroke-opacity"
          values="0.03;0.12;0.03"
          dur="4s"
          repeatCount="indefinite"
        />
      </ellipse>
      {/* Dome hex grid lines (subtle) */}
      {[0, 60, 120].map((angle) => (
        <line
          key={angle}
          x1={-500 * Math.cos((angle * Math.PI) / 180)}
          y1={220 - 300 * Math.sin((angle * Math.PI) / 180)}
          x2={500 * Math.cos((angle * Math.PI) / 180)}
          y2={220 + 300 * Math.sin((angle * Math.PI) / 180)}
          stroke="rgba(6, 182, 212, 0.02)"
          strokeWidth={0.5}
        />
      ))}
      {/* Dome shimmer rings */}
      {[0.6, 0.8, 1.0].map((scale, i) => (
        <ellipse
          key={i}
          cx={0}
          cy={220}
          rx={560 * scale}
          ry={340 * scale}
          fill="none"
          stroke="rgba(6, 182, 212, 0.04)"
          strokeWidth={0.5}
        >
          <animate
            attributeName="stroke-opacity"
            values="0.02;0.08;0.02"
            dur={`${3 + i}s`}
            repeatCount="indefinite"
            begin={`${i * 0.7}s`}
          />
        </ellipse>
      ))}
    </g>
  );
}

// ─── ISOMETRIC BUILDING (StarCraft 2 style) ─────────────────────────────────

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
  const isCmd = building.id === "command-center";

  // Command center gets extra depth and size boost
  const actualDepth = isCmd ? depth * 1.4 : depth;
  const actualW = isCmd ? w * 1.15 : w;
  const actualH = isCmd ? h * 1.15 : h;

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
      {/* Selection ring (StarCraft style) */}
      {isSelected && (
        <g filter="url(#selectionGlow)">
          <ellipse
            cx={x}
            cy={y + actualDepth + 8}
            rx={actualW * 0.8}
            ry={actualH * 0.45}
            fill="none"
            stroke={building.color}
            strokeWidth={2}
            strokeDasharray="6 3"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-18"
              dur="1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-opacity"
              values="0.6;1;0.6"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </ellipse>
          <ellipse
            cx={x}
            cy={y + actualDepth + 8}
            rx={actualW * 0.85}
            ry={actualH * 0.5}
            fill="none"
            stroke={building.color}
            strokeWidth={0.5}
            opacity={0.3}
          >
            <animate
              attributeName="rx"
              values={`${actualW * 0.82};${actualW * 0.88};${actualW * 0.82}`}
              dur="2s"
              repeatCount="indefinite"
            />
          </ellipse>
        </g>
      )}

      {/* Glow shadow */}
      <ellipse
        cx={x}
        cy={y + actualDepth + 5}
        rx={actualW * 0.7}
        ry={actualH * 0.4}
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

      {/* Holographic edge glow (animated color cycling) */}
      {building.status === "active" && (
        <g filter="url(#holoGlow)">
          {/* Right edge glow */}
          <line
            x1={x + actualW / 2}
            y1={y + actualH / 2}
            x2={x + actualW / 2}
            y2={y + actualH / 2 + actualDepth}
            stroke={building.color}
            strokeWidth={2}
            opacity={0.4}
          >
            <animate
              attributeName="opacity"
              values="0.2;0.6;0.2"
              dur="2s"
              repeatCount="indefinite"
            />
          </line>
          {/* Left edge glow */}
          <line
            x1={x - actualW / 2}
            y1={y + actualH / 2}
            x2={x - actualW / 2}
            y2={y + actualH / 2 + actualDepth}
            stroke={building.color}
            strokeWidth={2}
            opacity={0.4}
          >
            <animate
              attributeName="opacity"
              values="0.2;0.6;0.2"
              dur="2.3s"
              repeatCount="indefinite"
              begin="0.5s"
            />
          </line>
          {/* Top edges glow */}
          <polygon
            points={`${x},${y - actualH} ${x + actualW / 2},${y - actualH / 2} ${x},${y} ${x - actualW / 2},${y - actualH / 2}`}
            fill="none"
            stroke={building.color}
            strokeWidth={1.5}
            opacity={0.3}
          >
            <animate
              attributeName="opacity"
              values="0.15;0.45;0.15"
              dur="2.7s"
              repeatCount="indefinite"
              begin="0.3s"
            />
          </polygon>
        </g>
      )}

      {/* Right face */}
      <polygon
        points={`${x},${y} ${x + actualW / 2},${y + actualH / 2} ${x + actualW / 2},${y + actualH / 2 + actualDepth} ${x},${y + actualDepth}`}
        fill={building.rightColor}
        stroke={isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.1)"}
        strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
      />

      {/* Left face */}
      <polygon
        points={`${x},${y} ${x - actualW / 2},${y + actualH / 2} ${x - actualW / 2},${y + actualH / 2 + actualDepth} ${x},${y + actualDepth}`}
        fill={building.leftColor}
        stroke={isHovered || isSelected ? "#fff" : "rgba(255,255,255,0.1)"}
        strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
      />

      {/* Top face */}
      <polygon
        points={`${x},${y - actualH} ${x + actualW / 2},${y - actualH / 2} ${x},${y} ${x - actualW / 2},${y - actualH / 2}`}
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
        y2={y + actualDepth}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1}
      />

      {/* Active machinery — spinning element on top */}
      {building.status === "active" && (
        <g>
          {/* Pulsing energy core (center of top face) */}
          <circle
            cx={x}
            cy={y - actualH / 2}
            r={building.size * 3}
            fill={building.color}
            opacity={0.15}
          >
            <animate
              attributeName="r"
              values={`${building.size * 2};${building.size * 4};${building.size * 2}`}
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.1;0.3;0.1"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={x}
            cy={y - actualH / 2}
            r={building.size * 1.5}
            fill={building.color}
            opacity={0.5}
          >
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Spinning ring (machinery feel) */}
          <circle
            cx={x}
            cy={y - actualH / 2}
            r={building.size * 5}
            fill="none"
            stroke={building.color}
            strokeWidth={0.5}
            strokeDasharray="3 5"
            opacity={0.3}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${x} ${y - actualH / 2}`}
              to={`360 ${x} ${y - actualH / 2}`}
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}

      {/* Shield generator dots on top (3 small pulsing circles) */}
      {[
        { dx: -actualW * 0.2, dy: -actualH * 0.65 },
        { dx: actualW * 0.2, dy: -actualH * 0.65 },
        { dx: 0, dy: -actualH * 0.85 },
      ].map((pos, i) => (
        <circle
          key={`shield-${i}`}
          cx={x + pos.dx}
          cy={y + pos.dy}
          r={1.5}
          fill={building.status === "active" ? "#22c55e" : "#6b7280"}
          opacity={building.status === "active" ? 0.8 : 0.3}
        >
          {building.status === "active" && (
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur={`${1.5 + i * 0.3}s`}
              repeatCount="indefinite"
              begin={`${i * 0.4}s`}
            />
          )}
        </circle>
      ))}

      {/* Command Center extras — antenna arrays + bigger energy core */}
      {isCmd && (
        <g>
          {/* Left antenna */}
          <line
            x1={x - actualW * 0.3}
            y1={y - actualH}
            x2={x - actualW * 0.35}
            y2={y - actualH - 25}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
          />
          <circle
            cx={x - actualW * 0.35}
            cy={y - actualH - 25}
            r={2}
            fill="#ef4444"
          >
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Right antenna */}
          <line
            x1={x + actualW * 0.3}
            y1={y - actualH}
            x2={x + actualW * 0.35}
            y2={y - actualH - 20}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
          />
          <circle
            cx={x + actualW * 0.35}
            cy={y - actualH - 20}
            r={2}
            fill="#22c55e"
          >
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.3s"
              repeatCount="indefinite"
              begin="0.2s"
            />
          </circle>

          {/* Center spire */}
          <line
            x1={x}
            y1={y - actualH}
            x2={x}
            y2={y - actualH - 35}
            stroke="rgba(232, 160, 25, 0.6)"
            strokeWidth={1.5}
          />
          <circle
            cx={x}
            cy={y - actualH - 35}
            r={3}
            fill="#e8a019"
            filter="url(#energyCore)"
          >
            <animate
              attributeName="r"
              values="2;4;2"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Energy arc between antennas */}
          <path
            d={`M${x - actualW * 0.35},${y - actualH - 25} Q${x},${y - actualH - 40} ${x + actualW * 0.35},${y - actualH - 20}`}
            fill="none"
            stroke="#e8a019"
            strokeWidth={0.5}
            opacity={0.3}
          >
            <animate
              attributeName="opacity"
              values="0.1;0.5;0.1"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>

          {/* Pulsing ground energy ring */}
          <ellipse
            cx={x}
            cy={y + actualDepth + 5}
            rx={actualW * 0.9}
            ry={actualH * 0.55}
            fill="none"
            stroke="#e8a019"
            strokeWidth={1}
            opacity={0.15}
          >
            <animate
              attributeName="rx"
              values={`${actualW * 0.85};${actualW * 0.95};${actualW * 0.85}`}
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.1;0.25;0.1"
              dur="3s"
              repeatCount="indefinite"
            />
          </ellipse>
        </g>
      )}

      {/* Status indicator dot */}
      <circle
        cx={x}
        cy={y - actualH - (isCmd ? 45 : 8)}
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
        y={y - actualH - (isCmd ? 52 : 16)}
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

// ─── CONVEYOR BELT (Factorio style) ─────────────────────────────────────────

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

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Midpoint for throughput label
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  // Data type color
  const packetColor = DATA_TYPE_COLORS[conveyor.dataType] || conveyor.color;

  // Direction arrow positions (along the belt)
  const arrowCount = Math.max(2, Math.floor(len / 80));

  return (
    <g opacity={conveyor.active ? 0.85 : 0.15}>
      {/* Belt background (wider, more visible) */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={conveyor.active ? 8 : 3}
        strokeLinecap="round"
      />

      {/* Belt track lines (Factorio style rails) */}
      {[-3, 3].map((offset, i) => {
        const perpX = (-dy / len) * offset;
        const perpY = (dx / len) * offset;
        return (
          <line
            key={i}
            x1={p1.x + perpX}
            y1={p1.y + perpY}
            x2={p2.x + perpX}
            y2={p2.y + perpY}
            stroke={conveyor.active ? conveyor.color : "rgba(255,255,255,0.1)"}
            strokeWidth={0.5}
            opacity={conveyor.active ? 0.4 : 0.2}
          />
        );
      })}

      {/* Animated dashed center line */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={conveyor.color}
        strokeWidth={conveyor.active ? 1.5 : 0.5}
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

      {/* Directional arrows on belt */}
      {conveyor.active &&
        Array.from({ length: arrowCount }, (_, i) => {
          const t = (i + 1) / (arrowCount + 1);
          const ax = p1.x + dx * t;
          const ay = p1.y + dy * t;
          const arrowSize = 4;
          // Arrow pointing in direction of flow
          const normX = dx / len;
          const normY = dy / len;
          const perpNx = -normY;
          const perpNy = normX;
          return (
            <polygon
              key={`arrow-${i}`}
              points={`
                ${ax + normX * arrowSize},${ay + normY * arrowSize}
                ${ax + perpNx * arrowSize * 0.5 - normX * arrowSize * 0.5},${ay + perpNy * arrowSize * 0.5 - normY * arrowSize * 0.5}
                ${ax - perpNx * arrowSize * 0.5 - normX * arrowSize * 0.5},${ay - perpNy * arrowSize * 0.5 - normY * arrowSize * 0.5}
              `}
              fill={conveyor.color}
              opacity={0.25}
            >
              <animate
                attributeName="opacity"
                values="0.15;0.35;0.15"
                dur="2s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
            </polygon>
          );
        })}

      {/* Data packets flowing along (colored by type) */}
      {conveyor.active && (
        <>
          {[0, 0.25, 0.5, 0.75].map((offset, i) => (
            <g key={i}>
              {/* Packet body */}
              <rect
                width={6}
                height={4}
                rx={1}
                fill={packetColor}
                opacity={0.9}
              >
                <animateMotion
                  dur="2.5s"
                  repeatCount="indefinite"
                  begin={`${offset * 2.5}s`}
                  path={`M${p1.x - 3},${p1.y - 2} L${p2.x - 3},${p2.y - 2}`}
                />
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </rect>
              {/* Packet glow */}
              <circle r={3} fill={packetColor} opacity={0.2}>
                <animateMotion
                  dur="2.5s"
                  repeatCount="indefinite"
                  begin={`${offset * 2.5}s`}
                  path={`M${p1.x},${p1.y} L${p2.x},${p2.y}`}
                />
              </circle>
            </g>
          ))}
        </>
      )}

      {/* Inserter arms at endpoints (small animated SVG arms) */}
      {conveyor.active && (
        <>
          {/* Source inserter */}
          <g>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p1.x + (dx / len) * 12}
              y2={p1.y + (dy / len) * 12}
              stroke={conveyor.color}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.6}
            >
              <animate
                attributeName="opacity"
                values="0.3;0.8;0.3"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </line>
            <circle
              cx={p1.x + (dx / len) * 12}
              cy={p1.y + (dy / len) * 12}
              r={2}
              fill={conveyor.color}
              opacity={0.7}
            >
              <animate
                attributeName="r"
                values="1.5;2.5;1.5"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
          {/* Destination inserter */}
          <g>
            <line
              x1={p2.x}
              y1={p2.y}
              x2={p2.x - (dx / len) * 12}
              y2={p2.y - (dy / len) * 12}
              stroke={conveyor.color}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.6}
            >
              <animate
                attributeName="opacity"
                values="0.3;0.8;0.3"
                dur="1.5s"
                repeatCount="indefinite"
                begin="0.75s"
              />
            </line>
            <circle
              cx={p2.x - (dx / len) * 12}
              cy={p2.y - (dy / len) * 12}
              r={2}
              fill={conveyor.color}
              opacity={0.7}
            >
              <animate
                attributeName="r"
                values="1.5;2.5;1.5"
                dur="1.5s"
                repeatCount="indefinite"
                begin="0.75s"
              />
            </circle>
          </g>
        </>
      )}

      {/* Throughput counter label */}
      {conveyor.active && conveyor.throughput > 0 && (
        <g>
          <rect
            x={mx - 16}
            y={my - 14}
            width={32}
            height={12}
            rx={3}
            fill="rgba(0,0,0,0.75)"
            stroke={conveyor.color}
            strokeWidth={0.5}
            opacity={0.8}
          />
          <text
            x={mx}
            y={my - 5}
            textAnchor="middle"
            fill={conveyor.color}
            fontSize={7}
            fontFamily="var(--font-mono), monospace"
            fontWeight="bold"
          >
            {conveyor.throughput}/min
          </text>
        </g>
      )}
    </g>
  );
}

// ─── WORKER SPRITE (Pokemon style) ──────────────────────────────────────────

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

  const t = worker.progress / 100;
  const cx = p1.x + (p2.x - p1.x) * t;
  const cy = p1.y + (p2.y - p1.y) * t - 10;

  const config = WORKER_TYPE_CONFIG[worker.type];
  const workerColor = config.color;

  // Bounce animation parameters
  const bounceSpeed = worker.status === "working" ? "0.8s" : worker.status === "idle" ? "2s" : "1.2s";
  const bounceAmount = worker.status === "working" ? 3 : worker.status === "idle" ? 1.5 : 2;

  // Worker body shape based on type
  const renderWorkerShape = () => {
    const size = 7;
    switch (config.shape) {
      case "square": // Builder — sturdy
        return (
          <rect
            x={cx - size}
            y={cy - size}
            width={size * 2}
            height={size * 2}
            rx={2}
            fill={workerColor}
            stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
            strokeWidth={isSelected ? 2 : 1}
          />
        );
      case "diamond": // Inspector — floating
        return (
          <polygon
            points={`${cx},${cy - size * 1.2} ${cx + size},${cy} ${cx},${cy + size * 1.2} ${cx - size},${cy}`}
            fill={workerColor}
            stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
            strokeWidth={isSelected ? 2 : 1}
          />
        );
      case "triangle": // Scout — wing shapes
        return (
          <g>
            <polygon
              points={`${cx},${cy - size * 1.3} ${cx + size * 1.2},${cy + size * 0.8} ${cx - size * 1.2},${cy + size * 0.8}`}
              fill={workerColor}
              stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Wing accents */}
            <line x1={cx - size * 1.2} y1={cy + size * 0.3} x2={cx - size * 1.8} y2={cy - size * 0.2} stroke={workerColor} strokeWidth={1.5} opacity={0.6} />
            <line x1={cx + size * 1.2} y1={cy + size * 0.3} x2={cx + size * 1.8} y2={cy - size * 0.2} stroke={workerColor} strokeWidth={1.5} opacity={0.6} />
          </g>
        );
      case "hexagon": // Deployer — rocket
        return (
          <g>
            <polygon
              points={`${cx},${cy - size * 1.2} ${cx + size},${cy - size * 0.4} ${cx + size},${cy + size * 0.4} ${cx},${cy + size * 1.2} ${cx - size},${cy + size * 0.4} ${cx - size},${cy - size * 0.4}`}
              fill={workerColor}
              stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Rocket trail */}
            {worker.status === "moving" && (
              <g>
                <line x1={cx} y1={cy + size * 1.2} x2={cx} y2={cy + size * 2.5} stroke={workerColor} strokeWidth={2} opacity={0.4}>
                  <animate attributeName="y2" values={`${cy + size * 2};${cy + size * 3};${cy + size * 2}`} dur="0.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.2;0.5;0.2" dur="0.5s" repeatCount="indefinite" />
                </line>
                <line x1={cx - 2} y1={cy + size * 1.2} x2={cx - 3} y2={cy + size * 2} stroke="#f97316" strokeWidth={1} opacity={0.3}>
                  <animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.4s" repeatCount="indefinite" />
                </line>
                <line x1={cx + 2} y1={cy + size * 1.2} x2={cx + 3} y2={cy + size * 2} stroke="#f97316" strokeWidth={1} opacity={0.3}>
                  <animate attributeName="opacity" values="0.1;0.4;0.1" dur="0.4s" repeatCount="indefinite" begin="0.2s" />
                </line>
              </g>
            )}
          </g>
        );
      case "bolt": // Messenger — lightning
        return (
          <g>
            <polygon
              points={`${cx - 2},${cy - size * 1.2} ${cx + size * 0.8},${cy - size * 0.2} ${cx + 1},${cy} ${cx + 3},${cy} ${cx - size * 0.6},${cy + size * 1.2} ${cx},${cy + size * 0.2} ${cx - 3},${cy + size * 0.2}`}
              fill={workerColor}
              stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Lightning trails */}
            {worker.status === "moving" && (
              <g>
                <line x1={cx - size} y1={cy} x2={cx - size * 2} y2={cy + 2} stroke={workerColor} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="opacity" values="0;0.5;0" dur="0.6s" repeatCount="indefinite" />
                </line>
                <line x1={cx + size} y1={cy} x2={cx + size * 2} y2={cy - 2} stroke={workerColor} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="opacity" values="0;0.5;0" dur="0.6s" repeatCount="indefinite" begin="0.3s" />
                </line>
              </g>
            )}
          </g>
        );
      default: // Miner — circle, earthy
        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={size}
              fill={workerColor}
              stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Pickaxe accent */}
            <line x1={cx + size * 0.5} y1={cy - size * 0.8} x2={cx + size * 1.3} y2={cy - size * 1.5} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
            <line x1={cx + size * 1.1} y1={cy - size * 1.7} x2={cx + size * 1.5} y2={cy - size * 1.3} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
          </g>
        );
    }
  };

  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(worker.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(worker.id)}
    >
      {/* Selection ring (StarCraft style) */}
      {isSelected && (
        <g filter="url(#selectionGlow)">
          <ellipse
            cx={cx}
            cy={cy + 12}
            rx={14}
            ry={6}
            fill="none"
            stroke={workerColor}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-12"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </ellipse>
        </g>
      )}

      {/* Trail */}
      {worker.status === "moving" && (
        <line
          x1={p1.x}
          y1={p1.y - 10}
          x2={cx}
          y2={cy}
          stroke={workerColor}
          strokeWidth={1}
          opacity={0.1}
          strokeDasharray="3 3"
        />
      )}

      {/* Aura glow (inspector gets floating aura, all get type-colored) */}
      <circle cx={cx} cy={cy} r={worker.type === "inspector" ? 14 : 10} fill={workerColor} opacity={0.1} filter="url(#workerAura)">
        <animate
          attributeName="r"
          values={`${worker.type === "inspector" ? 12 : 8};${worker.type === "inspector" ? 16 : 12};${worker.type === "inspector" ? 12 : 8}`}
          dur={bounceSpeed}
          repeatCount="indefinite"
        />
      </circle>

      {/* Evolution glow (golden particle burst) */}
      {worker.evolving && (
        <g>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <circle
              key={`evo-${i}`}
              cx={cx + Math.cos((angle * Math.PI) / 180) * 15}
              cy={cy + Math.sin((angle * Math.PI) / 180) * 15}
              r={2}
              fill="#eab308"
              opacity={0.8}
            >
              <animate
                attributeName="r"
                values="1;3;0"
                dur="1s"
                repeatCount="indefinite"
                begin={`${i * 0.125}s`}
              />
              <animate
                attributeName="opacity"
                values="0.8;0;0.8"
                dur="1s"
                repeatCount="indefinite"
                begin={`${i * 0.125}s`}
              />
            </circle>
          ))}
          <circle cx={cx} cy={cy} r={18} fill="none" stroke="#eab308" strokeWidth={2} opacity={0.5}>
            <animate attributeName="r" values="10;20;10" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Bounce wrapper — worker body bounces */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`0,0; 0,${-bounceAmount}; 0,0`}
          dur={bounceSpeed}
          repeatCount="indefinite"
        />
        {renderWorkerShape()}

        {/* Inner icon/emblem */}
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fill="#fff"
          fontSize={8}
          fontFamily="var(--font-mono), monospace"
          fontWeight="bold"
          opacity={0.9}
        >
          {config.icon}
        </text>
      </g>

      {/* Name label + Level badge */}
      <g>
        {/* Level badge background */}
        <rect
          x={cx + 8}
          y={cy - 22}
          width={22}
          height={10}
          rx={3}
          fill="rgba(0,0,0,0.8)"
          stroke={workerColor}
          strokeWidth={0.5}
        />
        <text
          x={cx + 19}
          y={cy - 14}
          textAnchor="middle"
          fill={workerColor}
          fontSize={6}
          fontFamily="var(--font-mono), monospace"
          fontWeight="bold"
        >
          Lv.{worker.level}
        </text>

        {/* Name */}
        <text
          x={cx - 2}
          y={cy - 18}
          textAnchor="end"
          fill="rgba(255,255,255,0.7)"
          fontSize={7}
          fontFamily="var(--font-mono), monospace"
        >
          {worker.name}
        </text>

        {/* Type label */}
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fill={workerColor}
          fontSize={6}
          fontFamily="var(--font-mono), monospace"
          opacity={0.5}
        >
          {config.label}
        </text>
      </g>

      {/* Speech bubble */}
      {worker.speechBubble && (
        <g>
          <rect
            x={cx - 42}
            y={cy - 42}
            width={84}
            height={18}
            rx={5}
            fill="rgba(0,0,0,0.9)"
            stroke={workerColor}
            strokeWidth={0.8}
          />
          <polygon
            points={`${cx - 4},${cy - 24} ${cx + 4},${cy - 24} ${cx},${cy - 19}`}
            fill="rgba(0,0,0,0.9)"
          />
          <text
            x={cx}
            y={cy - 30}
            textAnchor="middle"
            fill={workerColor}
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

// ─── BACKGROUND ──────────────────────────────────────────────────────────────

function BackgroundParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.3 + 0.05,
        color: i % 3 === 0 ? "#06b6d4" : i % 3 === 1 ? "#e8a019" : "#22c55e",
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
            background: `${p.color}`,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            opacity: p.opacity,
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

// ─── MINIMAP with fog of war ─────────────────────────────────────────────────

function Minimap({
  buildings,
  workers,
}: {
  buildings: Building[];
  workers: Worker[];
}) {
  return (
    <div
      className="absolute bottom-4 left-4 z-30 overflow-hidden"
      style={{
        width: 200,
        height: 140,
        background: "rgba(5, 5, 8, 0.9)",
        border: "2px solid rgba(6, 182, 212, 0.3)",
        borderRadius: 4,
        boxShadow: "0 0 15px rgba(6, 182, 212, 0.1), inset 0 0 30px rgba(0,0,0,0.5)",
      }}
    >
      {/* Metallic top border (StarCraft style) */}
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent)",
        }}
      />
      <div
        className="absolute top-1 left-2 text-[7px] uppercase tracking-[0.2em] font-bold"
        style={{ color: "rgba(6, 182, 212, 0.6)" }}
      >
        TACTICAL MAP
      </div>
      <svg viewBox="-120 -20 600 340" width={200} height={140}>
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
                fill="rgba(6, 182, 212, 0.08)"
              />
            );
          })
        )}

        {/* Building dots */}
        {buildings.map((b) => {
          const pos = gridToIso(b.gridX, b.gridY);
          return (
            <g key={b.id}>
              <rect
                x={pos.x - 3 * b.size}
                y={pos.y - 2 * b.size}
                width={6 * b.size}
                height={4 * b.size}
                fill={b.color}
                opacity={b.status === "active" ? 0.9 : 0.3}
                rx={1}
              />
              {/* Active glow on minimap */}
              {b.status === "active" && (
                <rect
                  x={pos.x - 4 * b.size}
                  y={pos.y - 3 * b.size}
                  width={8 * b.size}
                  height={6 * b.size}
                  fill={b.color}
                  opacity={0.15}
                  rx={2}
                >
                  <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2s" repeatCount="indefinite" />
                </rect>
              )}
            </g>
          );
        })}

        {/* Worker dots */}
        {workers.map((w) => {
          const cur = buildings.find((b) => b.id === w.currentBuildingId);
          const tgt = buildings.find((b) => b.id === w.targetBuildingId);
          if (!cur || !tgt) return null;
          const pp1 = gridToIso(cur.gridX, cur.gridY);
          const pp2 = gridToIso(tgt.gridX, tgt.gridY);
          const tt = w.progress / 100;
          return (
            <circle
              key={w.id}
              cx={pp1.x + (pp2.x - pp1.x) * tt}
              cy={pp1.y + (pp2.y - pp1.y) * tt}
              r={2}
              fill={WORKER_TYPE_CONFIG[w.type].color}
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

        {/* Fog of war overlay - darken inactive areas */}
        <rect x="-120" y="-20" width="600" height="340" fill="url(#fogOfWar)" />
      </svg>
    </div>
  );
}

// ─── ALERT FEED ──────────────────────────────────────────────────────────────

function AlertFeed({ events }: { events: AlertEvent[] }) {
  const typeColors: Record<string, string> = {
    success: "#22c55e",
    info: "#06b6d4",
    warning: "#f59e0b",
    error: "#ef4444",
  };

  return (
    <div
      className="absolute bottom-4 right-4 z-30 overflow-hidden"
      style={{
        width: 370,
        maxHeight: 210,
        background: "rgba(5, 5, 8, 0.9)",
        border: "2px solid rgba(6, 182, 212, 0.2)",
        borderRadius: 4,
        boxShadow: "0 0 15px rgba(6, 182, 212, 0.05), inset 0 0 30px rgba(0,0,0,0.5)",
      }}
    >
      {/* Metallic border top */}
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.4), transparent)",
        }}
      />
      <div
        className="px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] font-bold flex items-center gap-2"
        style={{
          color: "rgba(6, 182, 212, 0.6)",
          borderBottom: "1px solid rgba(6, 182, 212, 0.1)",
          background: "rgba(6, 182, 212, 0.02)",
        }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }}
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
                className="inline-block w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                style={{ background: typeColors[evt.type], boxShadow: `0 0 3px ${typeColors[evt.type]}` }}
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

// ─── BUILDING PANEL (StarCraft info panel style) ─────────────────────────────

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
      className="absolute top-16 right-4 z-40 overflow-hidden"
      style={{
        width: 340,
        background: "linear-gradient(180deg, rgba(10, 12, 18, 0.97) 0%, rgba(5, 5, 8, 0.97) 100%)",
        border: `2px solid ${building.color}44`,
        borderRadius: 4,
        boxShadow: `0 0 30px ${building.glowColor}, 0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Metallic top border */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${building.color}, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* Beveled corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3" style={{ borderLeft: `2px solid ${building.color}66`, borderTop: `2px solid ${building.color}66` }} />
      <div className="absolute top-0 right-0 w-3 h-3" style={{ borderRight: `2px solid ${building.color}66`, borderTop: `2px solid ${building.color}66` }} />

      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: `1px solid ${building.color}22`, background: `linear-gradient(180deg, ${building.color}08, transparent)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: building.color,
                boxShadow: `0 0 8px ${building.glowColor}, 0 0 16px ${building.glowColor}`,
              }}
            />
            <span
              className="text-sm font-bold uppercase tracking-wider"
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
            className="text-[9px] uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity px-2 py-1"
            style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 }}
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

      {/* Stats (StarCraft resource counter style) */}
      <div className="p-4 grid grid-cols-3 gap-3">
        {[
          { label: "Tests", value: building.stats.tests, color: "#22c55e", icon: ">" },
          { label: "Deploys", value: building.stats.deploys, color: "#3b82f6", icon: "^" },
          { label: "Uptime", value: building.stats.uptime, color: "#e8a019", icon: "~" },
        ].map((stat) => (
          <div key={stat.label} className="text-center p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 3 }}>
            <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: stat.color, opacity: 0.7 }}>
              {stat.icon} {stat.label}
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{
                color: stat.color,
                textShadow: `0 0 8px ${stat.color}44`,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <div
          className="px-3 py-1 text-[9px] uppercase tracking-wider font-bold"
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
            borderRadius: 2,
          }}
        >
          {building.status}
        </div>
        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          Sector [{building.gridX}, {building.gridY}]
        </span>
      </div>

      {/* Bottom metallic border */}
      <div className="absolute bottom-0 left-0 w-3 h-3" style={{ borderLeft: `2px solid ${building.color}44`, borderBottom: `2px solid ${building.color}44` }} />
      <div className="absolute bottom-0 right-0 w-3 h-3" style={{ borderRight: `2px solid ${building.color}44`, borderBottom: `2px solid ${building.color}44` }} />
    </motion.div>
  );
}

// ─── WORKER PANEL (Pokemon-style info card) ──────────────────────────────────

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
  const config = WORKER_TYPE_CONFIG[worker.type];

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-16 right-4 z-40 overflow-hidden"
      style={{
        width: 340,
        background: "linear-gradient(180deg, rgba(10, 12, 18, 0.97) 0%, rgba(5, 5, 8, 0.97) 100%)",
        border: `2px solid ${config.color}44`,
        borderRadius: 4,
        boxShadow: `0 0 30px ${config.color}33, 0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {/* Metallic top border */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3" style={{ borderLeft: `2px solid ${config.color}66`, borderTop: `2px solid ${config.color}66` }} />
      <div className="absolute top-0 right-0 w-3 h-3" style={{ borderRight: `2px solid ${config.color}66`, borderTop: `2px solid ${config.color}66` }} />

      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: `1px solid ${config.color}22`, background: `linear-gradient(180deg, ${config.color}08, transparent)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{
                background: `${config.color}20`,
                color: config.color,
                border: `1px solid ${config.color}44`,
                boxShadow: `0 0 12px ${config.color}33`,
              }}
            >
              {config.icon}
            </div>
            <div>
              <div
                className="text-sm font-bold"
                style={{
                  color: config.color,
                  textShadow: `0 0 10px ${config.color}55`,
                }}
              >
                {worker.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {config.label}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5" style={{ background: `${config.color}15`, color: config.color, borderRadius: 3, border: `1px solid ${config.color}33` }}>
                  Lv.{worker.level}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[9px] uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity px-2 py-1"
            style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 }}
          >
            ESC
          </button>
        </div>
      </div>

      {/* XP bar */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
            XP
          </span>
          <span className="text-[9px]" style={{ color: "#eab308" }}>
            {worker.xp}/100
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #eab308, #f59e0b)", boxShadow: "0 0 6px #eab30866" }}
            initial={{ width: 0 }}
            animate={{ width: `${worker.xp}%` }}
            transition={{ duration: 0.5 }}
          />
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
          <div className="p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 3 }}>
            <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              From
            </div>
            <div className="text-[11px] font-bold" style={{ color: current?.color }}>
              {current?.shortName}
            </div>
          </div>
          <div className="p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 3 }}>
            <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              To
            </div>
            <div className="text-[11px] font-bold" style={{ color: target?.color }}>
              {target?.shortName}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
              Progress
            </span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: config.color }}>
              {Math.round(worker.progress)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: config.color, boxShadow: `0 0 6px ${config.color}66` }}
              initial={{ width: 0 }}
              animate={{ width: `${worker.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1 text-[9px] uppercase tracking-wider font-bold"
            style={{
              background: `${config.color}15`,
              color: config.color,
              border: `1px solid ${config.color}33`,
              borderRadius: 2,
            }}
          >
            {worker.status}
          </div>
        </div>
      </div>

      {/* Action buttons (StarCraft style) */}
      <div
        className="p-4 grid grid-cols-3 gap-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}
      >
        {[
          { label: "Resume", color: "#22c55e" },
          { label: "Redirect", color: "#f59e0b" },
          { label: "Stop", color: "#ef4444" },
        ].map((action) => (
          <button
            key={action.label}
            className="py-1.5 text-[9px] uppercase tracking-wider font-bold transition-all hover:brightness-125"
            style={{
              background: `${action.color}10`,
              color: action.color,
              border: `1px solid ${action.color}33`,
              borderRadius: 2,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Bottom corners */}
      <div className="absolute bottom-0 left-0 w-3 h-3" style={{ borderLeft: `2px solid ${config.color}44`, borderBottom: `2px solid ${config.color}44` }} />
      <div className="absolute bottom-0 right-0 w-3 h-3" style={{ borderRight: `2px solid ${config.color}44`, borderBottom: `2px solid ${config.color}44` }} />
    </motion.div>
  );
}

// ─── HUD TOP BAR (StarCraft style) ──────────────────────────────────────────

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
          "linear-gradient(180deg, rgba(5,5,8,0.97) 0%, rgba(5,5,8,0.8) 70%, transparent 100%)",
        borderBottom: "1px solid rgba(6, 182, 212, 0.1)",
      }}
    >
      {/* Left -- Title */}
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
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
          |
        </span>
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: "rgba(6, 182, 212, 0.5)" }}
        >
          Tactical View
        </span>
      </div>

      {/* Center -- Clock */}
      <div
        className="text-sm font-bold tabular-nums px-4 py-1"
        style={{
          color: "rgba(6, 182, 212, 0.8)",
          textShadow: "0 0 10px rgba(6, 182, 212, 0.3)",
          background: "rgba(6, 182, 212, 0.03)",
          border: "1px solid rgba(6, 182, 212, 0.1)",
          borderRadius: 3,
        }}
      >
        {time}
      </div>

      {/* Right -- StarCraft resource counters */}
      <div className="flex items-center gap-4">
        {[
          { label: "WORKERS", value: activeCount, color: "#22c55e", icon: ">" },
          { label: "COMPLETED", value: completedCount, color: "#06b6d4", icon: "+" },
          { label: "TESTS", value: testCount, color: "#8b5cf6", icon: "#" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5 px-2 py-0.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 2 }}>
            <span className="text-[9px] font-bold" style={{ color: stat.color }}>{stat.icon}</span>
            <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
              {stat.label}
            </span>
            <span
              className="text-xs font-bold tabular-nums"
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

// ─── RESOURCE BAR (StarCraft style) ──────────────────────────────────────────

function ResourceBar() {
  const resources = [
    { label: "API Tokens", value: "847K", max: "1M", pct: 84.7, color: "#e8a019", icon: "T" },
    { label: "Session Cost", value: "$2.14", max: "$10", pct: 21.4, color: "#06b6d4", icon: "$" },
    { label: "Uptime", value: "6d 14h", max: "", pct: 95, color: "#22c55e", icon: "^" },
  ];

  return (
    <div
      className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-5 px-5 py-2"
      style={{
        background: "rgba(5, 5, 8, 0.85)",
        border: "1px solid rgba(6, 182, 212, 0.1)",
        borderRadius: 3,
        boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
      }}
    >
      {resources.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="text-[9px] font-bold" style={{ color: r.color }}>{r.icon}</span>
          <span
            className="text-[8px] uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {r.label}
          </span>
          <div
            className="w-20 h-1.5 rounded-sm overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.03)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${r.pct}%`,
                background: `linear-gradient(90deg, ${r.color}88, ${r.color})`,
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

// ─── COMPLETION PARTICLES ────────────────────────────────────────────────────

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
        const target = buildings.find((b) => b.id === w.currentBuildingId);
        if (target) {
          const pos = gridToIso(target.gridX, target.gridY);
          const burst = {
            id: `burst-${Date.now()}-${w.id}`,
            x: pos.x + 960,
            y: pos.y + 300,
            color: WORKER_TYPE_CONFIG[w.type].color,
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
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        angle: (i / 12) * Math.PI * 2,
        dist: 25 + Math.random() * 40,
        size: 2 + Math.random() * 4,
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
            boxShadow: `0 0 8px ${color}`,
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
          let newLevel = w.level;
          let newXp = w.xp;
          let newEvolving = false;

          // Random speech bubbles
          if (Math.random() < 0.05) {
            newSpeech =
              SPEECH_BUBBLES[Math.floor(Math.random() * SPEECH_BUBBLES.length)];
          } else if (Math.random() < 0.15) {
            newSpeech = null;
          }

          if (newProgress >= 100) {
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

            // XP gain on task completion
            newXp = w.xp + Math.floor(Math.random() * 8 + 3);
            if (newXp >= 100) {
              newXp = 0;
              newLevel = w.level + 1;
              newEvolving = true;
              newSpeech = "LEVEL UP!";
            }
          }

          return {
            ...w,
            progress: newProgress,
            status: newStatus,
            currentBuildingId: newCurrent,
            targetBuildingId: newTarget,
            task: newTask,
            speechBubble: newSpeech,
            level: newLevel,
            xp: newXp,
            evolving: newEvolving,
          };
        })
      );
    }, 400);

    return () => clearInterval(interval);
  }, []);

  // Clear evolving state after animation
  useEffect(() => {
    const evolvingWorkers = workers.filter((w) => w.evolving);
    if (evolvingWorkers.length > 0) {
      const timeout = setTimeout(() => {
        setWorkers((prev) => prev.map((w) => ({ ...w, evolving: false })));
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [workers]);

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

  const hoveredBuildingData = BUILDINGS.find((b) => b.id === hoveredBuilding);

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: "#050508",
        fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
      }}
    >
      {/* Vignette (dark edges) */}
      <div
        className="fixed inset-0 pointer-events-none z-[55]"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Scanline overlay (more prominent) */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.025) 2px, rgba(0, 255, 255, 0.025) 4px)",
          mixBlendMode: "overlay",
        }}
      />

      {/* CRT flicker effect */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          background: "rgba(6, 182, 212, 0.01)",
          animation: "crtFlicker 0.15s infinite alternate",
        }}
      />

      {/* Tech grid background pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(rgba(6, 182, 212, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.015) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px, 80px 80px, 20px 20px, 20px 20px",
        }}
      />

      {/* Background particles */}
      <BackgroundParticles />

      {/* Edge fog/atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[5]">
        <div className="absolute top-0 left-0 right-0 h-32" style={{ background: "linear-gradient(180deg, rgba(5,5,8,0.8) 0%, transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-32" style={{ background: "linear-gradient(0deg, rgba(5,5,8,0.8) 0%, transparent 100%)" }} />
        <div className="absolute top-0 left-0 bottom-0 w-32" style={{ background: "linear-gradient(90deg, rgba(5,5,8,0.6) 0%, transparent 100%)" }} />
        <div className="absolute top-0 right-0 bottom-0 w-32" style={{ background: "linear-gradient(270deg, rgba(5,5,8,0.6) 0%, transparent 100%)" }} />
      </div>

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
          <SvgDefs />

          {/* Center the iso world */}
          <g transform="translate(960, 300)">
            {/* Force field dome */}
            <ForceFieldDome />

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
            className="fixed z-40 pointer-events-none px-3 py-2"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(5, 5, 8, 0.95)",
              border: `1px solid ${hoveredBuildingData.color}44`,
              borderRadius: 3,
              boxShadow: `0 0 20px ${hoveredBuildingData.glowColor}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: hoveredBuildingData.color, boxShadow: `0 0 6px ${hoveredBuildingData.glowColor}` }}
              />
              <span
                className="text-xs font-bold uppercase tracking-wider"
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

      {/* Burst particles on worker completion */}
      <CompletionParticles workers={workers} buildings={BUILDINGS} />

      {/* CSS animation for CRT flicker */}
      <style jsx global>{`
        @keyframes crtFlicker {
          0% { opacity: 0.97; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
