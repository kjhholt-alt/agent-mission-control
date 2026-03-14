"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/lib/use-mobile";
import dynamic from "next/dynamic";
import type { Building, Worker, AlertEvent, WorkerType } from "@/components/game3d/types";
import {
  BUILDINGS,
  INITIAL_WORKERS,
  INITIAL_EVENTS,
  NEW_EVENT_MESSAGES,
  SPEECH_BUBBLES,
  WORKER_TYPE_CONFIG,
} from "@/components/game3d/constants";

// Dynamic import -- R3F cannot run on the server
const GameCanvas = dynamic(
  () => import("@/components/game3d/GameCanvas"),
  { ssr: false }
);

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

// Minimap still uses isometric projection for the 2D overlay
const TILE_W = 80;
const TILE_H = 40;

function gridToIso(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

// ─── BACKGROUND PARTICLES ───────────────────────────────────────────────────

function BackgroundParticles({ count = 60 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.15 + 0.05,
        duration: Math.random() * 8 + 6,
        delay: Math.random() * 5,
        color:
          Math.random() > 0.7
            ? "rgba(6, 182, 212, 0.5)"
            : Math.random() > 0.5
            ? "rgba(232, 160, 25, 0.4)"
            : "rgba(139, 92, 246, 0.3)",
      })),
    [count]
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
  hidden,
}: {
  buildings: Building[];
  workers: Worker[];
  hidden?: boolean;
}) {
  if (hidden) return null;
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
      </svg>
    </div>
  );
}

// ─── ALERT FEED ──────────────────────────────────────────────────────────────

function AlertFeed({ events, isMobile }: { events: AlertEvent[]; isMobile?: boolean }) {
  const [collapsed, setCollapsed] = useState(isMobile ? true : false);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);

  const typeColors: Record<string, string> = {
    success: "#22c55e",
    info: "#06b6d4",
    warning: "#f59e0b",
    error: "#ef4444",
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartY === null) return;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (dy > 50) setCollapsed(true);
    if (dy < -50) setCollapsed(false);
    setSwipeStartY(null);
  };

  return (
    <motion.div
      className={`absolute z-30 overflow-hidden ${
        isMobile ? "bottom-0 left-0 right-0" : "bottom-4 right-4"
      }`}
      style={{
        width: isMobile ? "100%" : 370,
        maxHeight: isMobile ? (collapsed ? 36 : 220) : 210,
        background: "rgba(5, 5, 8, 0.95)",
        border: "2px solid rgba(6, 182, 212, 0.2)",
        borderRadius: isMobile ? "12px 12px 0 0" : 4,
        boxShadow: "0 0 15px rgba(6, 182, 212, 0.05), inset 0 0 30px rgba(0,0,0,0.5)",
        transition: "max-height 0.3s ease",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isMobile && (
        <div
          className="flex justify-center py-1 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="w-8 h-1 rounded-full bg-zinc-600" />
        </div>
      )}
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.4), transparent)",
        }}
      />
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: "1px solid rgba(6, 182, 212, 0.08)" }}
      >
        <span
          className="text-[8px] uppercase tracking-[0.2em] font-bold"
          style={{ color: "rgba(6, 182, 212, 0.6)" }}
        >
          ALERT FEED
        </span>
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: "#22c55e",
              boxShadow: "0 0 4px rgba(34, 197, 94, 0.6)",
            }}
          />
          <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            LIVE
          </span>
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: isMobile ? 170 : 160 }}>
        <AnimatePresence mode="popLayout">
          {events.slice(0, isMobile ? 5 : 8).map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              className="flex items-start gap-2 px-3 py-1.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}
            >
              <div
                className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  background: typeColors[event.type],
                  boxShadow: `0 0 4px ${typeColors[event.type]}`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[8px] tabular-nums"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {event.time}
                  </span>
                </div>
                <p
                  className="text-[9px] leading-tight truncate"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {event.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── BUILDING PANEL (StarCraft info panel style) ─────────────────────────────

function BuildingPanel({
  building,
  onClose,
  isMobile,
}: {
  building: Building;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartY(e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartY === null) return;
    if (e.changedTouches[0].clientY - swipeStartY > 80) onClose();
    setSwipeStartY(null);
  };

  return (
    <motion.div
      initial={isMobile ? { y: 400, opacity: 0 } : { x: 400, opacity: 0 }}
      animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
      exit={isMobile ? { y: 400, opacity: 0 } : { x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`absolute z-40 overflow-hidden ${
        isMobile
          ? "bottom-0 left-0 right-0"
          : "top-16 right-4"
      }`}
      style={{
        width: isMobile ? "100%" : 340,
        maxHeight: isMobile ? "70vh" : undefined,
        borderRadius: isMobile ? "16px 16px 0 0" : 4,
        background: "linear-gradient(180deg, rgba(10, 12, 18, 0.97) 0%, rgba(5, 5, 8, 0.97) 100%)",
        border: `2px solid ${building.color}44`,
        boxShadow: `0 0 30px ${building.glowColor}, 0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isMobile && (
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>
      )}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${building.color}, transparent)`,
          opacity: 0.6,
        }}
      />
      <div className="absolute top-0 left-0 w-3 h-3" style={{ borderLeft: `2px solid ${building.color}66`, borderTop: `2px solid ${building.color}66` }} />
      <div className="absolute top-0 right-0 w-3 h-3" style={{ borderRight: `2px solid ${building.color}66`, borderTop: `2px solid ${building.color}66` }} />

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
  isMobile,
}: {
  worker: Worker;
  buildings: Building[];
  onClose: () => void;
  isMobile?: boolean;
}) {
  const current = buildings.find((b) => b.id === worker.currentBuildingId);
  const target = buildings.find((b) => b.id === worker.targetBuildingId);
  const config = WORKER_TYPE_CONFIG[worker.type];
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartY(e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartY === null) return;
    if (e.changedTouches[0].clientY - swipeStartY > 80) onClose();
    setSwipeStartY(null);
  };

  return (
    <motion.div
      initial={isMobile ? { y: 400, opacity: 0 } : { x: 400, opacity: 0 }}
      animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
      exit={isMobile ? { y: 400, opacity: 0 } : { x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`absolute z-40 overflow-hidden ${
        isMobile
          ? "bottom-0 left-0 right-0"
          : "top-16 right-4"
      }`}
      style={{
        width: isMobile ? "100%" : 340,
        maxHeight: isMobile ? "70vh" : undefined,
        borderRadius: isMobile ? "16px 16px 0 0" : 4,
        background: "linear-gradient(180deg, rgba(10, 12, 18, 0.97) 0%, rgba(5, 5, 8, 0.97) 100%)",
        border: `2px solid ${config.color}44`,
        boxShadow: `0 0 30px ${config.color}33, 0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isMobile && (
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>
      )}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
          opacity: 0.6,
        }}
      />
      <div className="absolute top-0 left-0 w-3 h-3" style={{ borderLeft: `2px solid ${config.color}66`, borderTop: `2px solid ${config.color}66` }} />
      <div className="absolute top-0 right-0 w-3 h-3" style={{ borderRight: `2px solid ${config.color}66`, borderTop: `2px solid ${config.color}66` }} />

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
  isMobile,
}: {
  time: string;
  activeCount: number;
  completedCount: number;
  testCount: number;
  isMobile?: boolean;
}) {
  const stats = [
    { label: "WORKERS", value: activeCount, color: "#22c55e", icon: ">" },
    { label: "COMPLETED", value: completedCount, color: "#06b6d4", icon: "+" },
    { label: "TESTS", value: testCount, color: "#8b5cf6", icon: "#" },
  ];

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 ${
        isMobile ? "px-3 py-2" : "px-6 py-3"
      }`}
      style={{
        background:
          "linear-gradient(180deg, rgba(5,5,8,0.97) 0%, rgba(5,5,8,0.8) 70%, transparent 100%)",
        borderBottom: "1px solid rgba(6, 182, 212, 0.1)",
      }}
    >
      <div className={`flex items-center justify-between ${isMobile ? "flex-wrap gap-1" : ""}`}>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: "#22c55e",
              boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
            }}
          />
          <span
            className={`font-bold tracking-[0.2em] uppercase ${isMobile ? "text-[10px]" : "text-sm tracking-[0.3em]"}`}
            style={{
              color: "#e8a019",
              textShadow: "0 0 20px rgba(232, 160, 25, 0.4)",
            }}
          >
            NEXUS
          </span>
          {!isMobile && (
            <>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(6, 182, 212, 0.5)" }}>
                Tactical View
              </span>
            </>
          )}
        </div>

        <div
          className={`font-bold tabular-nums ${isMobile ? "text-[10px] px-2 py-0.5" : "text-sm px-4 py-1"}`}
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

        <div className={`flex items-center gap-2 ${isMobile ? "w-full justify-center mt-1" : "gap-4"}`}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`flex items-center gap-1 ${isMobile ? "px-1.5 py-0.5" : "gap-1.5 px-2 py-0.5"}`}
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 2 }}
            >
              <span className={`font-bold ${isMobile ? "text-[8px]" : "text-[9px]"}`} style={{ color: stat.color }}>{stat.icon}</span>
              {!isMobile && (
                <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {stat.label}
                </span>
              )}
              <span
                className={`font-bold tabular-nums ${isMobile ? "text-[9px]" : "text-xs"}`}
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
    </div>
  );
}

// ─── RESOURCE BAR (StarCraft style) ──────────────────────────────────────────

function ResourceBar({ isMobile }: { isMobile?: boolean }) {
  const resources = [
    { label: "API Tokens", value: "847K", max: "1M", pct: 84.7, color: "#e8a019", icon: "T" },
    { label: "Session Cost", value: "$2.14", max: "$10", pct: 21.4, color: "#06b6d4", icon: "$" },
    { label: "Uptime", value: "6d 14h", max: "", pct: 95, color: "#22c55e", icon: "^" },
  ];

  return (
    <div
      className={`absolute z-30 ${
        isMobile
          ? "top-[52px] left-2 right-2 overflow-x-auto"
          : "top-14 left-1/2 -translate-x-1/2"
      }`}
    >
      <div
        className={`flex items-center ${isMobile ? "gap-3 px-3 py-1.5 min-w-max" : "gap-5 px-5 py-2"}`}
        style={{
          background: "rgba(5, 5, 8, 0.85)",
          border: "1px solid rgba(6, 182, 212, 0.1)",
          borderRadius: 3,
          boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
        }}
      >
        {resources.map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className={`font-bold ${isMobile ? "text-[8px]" : "text-[9px]"}`} style={{ color: r.color }}>{r.icon}</span>
            {!isMobile && (
              <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                {r.label}
              </span>
            )}
            <div
              className={`h-1.5 rounded-sm overflow-hidden ${isMobile ? "w-12" : "w-20"}`}
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
              className={`font-bold tabular-nums ${isMobile ? "text-[8px]" : "text-[9px]"}`}
              style={{ color: r.color }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function GamePage() {
  const isMobile = useIsMobile();
  const [time, setTime] = useState(formatTime());
  const [workers, setWorkers] = useState(INITIAL_WORKERS);
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

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
              "Processing automation data",
              "Building CRM module",
              "Updating MCP configs",
              "Analyzing trade data",
            ];
            newTask = tasks[Math.floor(Math.random() * tasks.length)];
            newSpeech = "Job's done!";

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

  // Clear evolving state
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

  const handleClickBuilding = useCallback((id: string) => {
    if (id === "") {
      // Clicked empty space
      setSelectedBuilding(null);
    } else {
      setSelectedBuilding(id);
      setSelectedWorker(null);
    }
  }, []);

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

      {/* Scanline overlay */}
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
      <BackgroundParticles count={isMobile ? 30 : 60} />

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
        isMobile={isMobile}
      />
      <ResourceBar isMobile={isMobile} />

      {/* 3D Viewport -- React Three Fiber Canvas */}
      <div className="absolute inset-0 z-10">
        <GameCanvas
          hoveredBuilding={hoveredBuilding}
          selectedBuilding={selectedBuilding}
          onHoverBuilding={setHoveredBuilding}
          onClickBuilding={handleClickBuilding}
        />
      </div>

      {/* Building tooltip on hover */}
      <AnimatePresence>
        {hoveredBuildingData && !selectedBuilding && !isMobile && (
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
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedWorkerData && (
          <WorkerPanel
            worker={selectedWorkerData}
            buildings={BUILDINGS}
            onClose={() => setSelectedWorker(null)}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>

      {/* Minimap */}
      <Minimap buildings={BUILDINGS} workers={workers} hidden={isMobile} />

      {/* Alert feed */}
      <AlertFeed events={events} isMobile={isMobile} />

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
