"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Cpu,
  DollarSign,
  Wrench,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCost, formatTokens } from "@/lib/pricing";
import type { NexusSession } from "@/lib/collector-types";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    idle: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border ${styles[status] || styles.completed}`}
    >
      {status === "active" && (
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      )}
      {status}
    </span>
  );
}

function ModelBadge({ model }: { model: string | null }) {
  if (!model) return <span className="text-zinc-700">—</span>;
  const short = model.includes("opus")
    ? "Opus"
    : model.includes("haiku")
      ? "Haiku"
      : "Sonnet";
  const color = model.includes("opus")
    ? "text-purple-400"
    : model.includes("haiku")
      ? "text-emerald-400"
      : "text-cyan-400";
  return <span className={`text-xs ${color}`}>{short}</span>;
}

function formatDuration(start: string, end: string | null): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  if (mins > 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface SessionListProps {
  compact?: boolean;
  maxItems?: number;
}

export function SessionList({ compact, maxItems }: SessionListProps) {
  const [sessions, setSessions] = useState<NexusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const url = projectFilter === "all"
        ? `/api/sessions?limit=${maxItems || 100}`
        : `/api/sessions?project=${projectFilter}&limit=${maxItems || 100}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectFilter, maxItems]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Realtime subscription for live sessions
  useEffect(() => {
    const channel = supabase
      .channel("nexus_sessions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nexus_sessions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSessions((prev) => [payload.new as NexusSession, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setSessions((prev) =>
              prev.map((s) =>
                s.session_id === (payload.new as NexusSession).session_id
                  ? (payload.new as NexusSession)
                  : s
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Unique projects for filter
  const projects = Array.from(
    new Set(sessions.map((s) => s.project_name).filter(Boolean))
  ).sort();

  // Aggregates
  const totalCost = sessions.reduce((sum, s) => sum + (Number(s.cost_usd) || 0), 0);
  const totalTools = sessions.reduce((sum, s) => sum + (s.tool_count || 0), 0);
  const activeSessions = sessions.filter((s) => s.status === "active");

  const displayed = compact
    ? sessions.slice(0, maxItems || 10)
    : sessions;

  return (
    <div className="space-y-4">
      {/* Stats ribbon */}
      {!compact && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Active",
              value: activeSessions.length.toString(),
              icon: <Activity className="w-4 h-4 text-cyan-400" />,
              color: "border-cyan-500/20",
            },
            {
              label: "Total Sessions",
              value: sessions.length.toString(),
              icon: <Clock className="w-4 h-4 text-zinc-400" />,
              color: "border-zinc-700",
            },
            {
              label: "Tool Calls",
              value: totalTools.toLocaleString(),
              icon: <Wrench className="w-4 h-4 text-emerald-400" />,
              color: "border-emerald-500/20",
            },
            {
              label: "Total Cost",
              value: formatCost(totalCost),
              icon: <DollarSign className="w-4 h-4 text-amber-400" />,
              color: "border-amber-500/20",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-zinc-900/50 border ${stat.color} rounded-lg px-3 py-2.5 flex items-center gap-2.5`}
            >
              {stat.icon}
              <div>
                <div className="text-sm font-semibold text-white">
                  {stat.value}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-600">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter + refresh row */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-zinc-600">
              Project:
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p} value={p!}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchSessions}
            className="p-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      )}

      {/* Session table */}
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading sessions...
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <Cpu className="w-6 h-6 mb-2 opacity-30" />
            <p className="text-sm">No sessions recorded yet</p>
            <p className="text-xs text-zinc-700 mt-1">
              Configure Claude Code hooks to start tracking
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-600 border-b border-zinc-800/50">
                <th className="text-left px-4 py-2.5">Project</th>
                <th className="text-left px-3 py-2.5">Model</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Tools</th>
                <th className="text-right px-3 py-2.5">Tokens</th>
                <th className="text-right px-3 py-2.5">Cost</th>
                <th className="text-right px-3 py-2.5">Duration</th>
                <th className="text-right px-4 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((session, i) => (
                <motion.tr
                  key={session.session_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() =>
                    setExpandedId(
                      expandedId === session.session_id
                        ? null
                        : session.session_id
                    )
                  }
                  className={`border-b border-zinc-800/30 cursor-pointer transition-colors ${
                    session.status === "active"
                      ? "bg-cyan-500/[0.03]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {expandedId === session.session_id ? (
                        <ChevronDown className="w-3 h-3 text-zinc-600" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-zinc-700" />
                      )}
                      <span className="text-white font-medium">
                        {session.project_name || "unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <ModelBadge model={session.model} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums">
                    {session.tool_count || 0}
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums">
                    {formatTokens(
                      (session.input_tokens || 0) +
                        (session.output_tokens || 0)
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        Number(session.cost_usd) > 1
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }
                    >
                      {formatCost(Number(session.cost_usd) || 0)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-500 tabular-nums">
                    {formatDuration(
                      session.started_at,
                      session.completed_at
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-600 text-xs">
                    {formatTimeAgo(session.last_activity)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
