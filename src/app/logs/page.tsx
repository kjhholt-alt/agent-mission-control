"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Search,
  Filter,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  Calendar,
  Database,
  Activity,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LogEntry {
  id: string;
  created_at: string;
  task_id?: string;
  session_id?: string;
  event: string;
  details: string;
  project?: string;
  severity: string;
  source: "task_log" | "hook_events" | "sessions";
}

interface Aggregates {
  by_severity: Record<string, number>;
  by_project: Record<string, number>;
  by_source: Record<string, number>;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates>({
    by_severity: {},
    by_project: {},
    by_source: {},
  });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Filters
  const [projectFilter, setProjectFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 100;

  useEffect(() => {
    loadLogs();
    subscribeToRealtime();
  }, [projectFilter, severityFilter, searchText, startDate, endDate, sourceFilter, offset]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (projectFilter) params.set("project", projectFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (searchText) params.set("search", searchText);
      if (startDate) params.set("start", new Date(startDate).toISOString());
      if (endDate) params.set("end", new Date(endDate).toISOString());
      if (sourceFilter) params.set("source", sourceFilter);

      const response = await fetch(`/api/logs?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      setFilteredLogs(data.logs || []);
      setAggregates(data.aggregates || { by_severity: {}, by_project: {}, by_source: {} });
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  }

  function subscribeToRealtime() {
    // Subscribe to swarm_task_log
    const taskLogChannel = supabase
      .channel("task-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swarm_task_log" },
        () => {
          loadLogs(); // Refresh on new log
        }
      )
      .subscribe();

    // Subscribe to nexus_hook_events
    const hookEventsChannel = supabase
      .channel("hook-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nexus_hook_events" },
        () => {
          loadLogs(); // Refresh on new event
        }
      )
      .subscribe();

    return () => {
      taskLogChannel.unsubscribe();
      hookEventsChannel.unsubscribe();
    };
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "warn":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400" />;
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case "error":
        return "bg-red-500/10 border-red-500/20 text-red-400";
      case "warn":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      default:
        return "bg-cyan-500/10 border-cyan-500/20 text-cyan-400";
    }
  }

  function getSourceBadge(source: string) {
    switch (source) {
      case "task_log":
        return <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-cyan-400 text-xs">Task</span>;
      case "hook_events":
        return <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-purple-400 text-xs">Hook</span>;
      case "sessions":
        return <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs">Session</span>;
      default:
        return null;
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  const projects = Object.keys(aggregates.by_project).sort();

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <FileText className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Logs</h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                Centralized log viewer • {total.toLocaleString()} entries
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </motion.header>

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-4"
        >
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-cyan-400/60 uppercase">Info</span>
            </div>
            <div className="text-2xl font-bold text-cyan-50">
              {aggregates.by_severity.info || 0}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400/60 uppercase">Warnings</span>
            </div>
            <div className="text-2xl font-bold text-amber-50">
              {aggregates.by_severity.warn || 0}
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400/60 uppercase">Errors</span>
            </div>
            <div className="text-2xl font-bold text-red-50">
              {aggregates.by_severity.error || 0}
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400/60 uppercase">Live</span>
            </div>
            <div className="text-2xl font-bold text-purple-50">Real-time</div>
          </div>
        </motion.div>

        {/* Filters Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Project Filter */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Project</label>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Projects</option>
                  {projects.map((project) => (
                    <option key={project} value={project}>
                      {project} ({aggregates.by_project[project]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity Filter */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Severity</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Levels</option>
                  <option value="info">Info ({aggregates.by_severity.info || 0})</option>
                  <option value="warn">Warning ({aggregates.by_severity.warn || 0})</option>
                  <option value="error">Error ({aggregates.by_severity.error || 0})</option>
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Sources</option>
                  <option value="task_log">Task Logs ({aggregates.by_source.task_log || 0})</option>
                  <option value="hook_events">Hook Events ({aggregates.by_source.hook_events || 0})</option>
                  <option value="sessions">Sessions ({aggregates.by_source.sessions || 0})</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setProjectFilter("");
                  setSeverityFilter("");
                  setSearchText("");
                  setStartDate("");
                  setEndDate("");
                  setSourceFilter("");
                }}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </motion.div>
        )}

        {/* Logs List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden"
        >
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
              <p className="mt-4 text-zinc-400">Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">
              <Database className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
              <p>No logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSeverityIcon(log.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{log.event}</span>
                        {getSourceBadge(log.source)}
                        {log.project && (
                          <span className="px-2 py-0.5 bg-zinc-700/50 rounded text-zinc-400 text-xs">
                            {log.project}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2">{log.details}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span>{formatTimestamp(log.created_at)}</span>
                        {log.task_id && <span>Task: {log.task_id.slice(0, 8)}</span>}
                        {log.session_id && <span>Session: {log.session_id.slice(0, 8)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-800">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 bg-zinc-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-400">
                Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 bg-zinc-800 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className={`p-4 border-b border-zinc-800 ${getSeverityColor(selectedLog.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getSeverityIcon(selectedLog.severity)}
                  <div>
                    <h3 className="font-semibold">{selectedLog.event}</h3>
                    <p className="text-xs mt-1 opacity-60">
                      {new Date(selectedLog.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-400">Source:</span>
                  <div className="mt-1">{getSourceBadge(selectedLog.source)}</div>
                </div>
                {selectedLog.project && (
                  <div>
                    <span className="text-zinc-400">Project:</span>
                    <p className="text-white mt-1">{selectedLog.project}</p>
                  </div>
                )}
                {selectedLog.task_id && (
                  <div>
                    <span className="text-zinc-400">Task ID:</span>
                    <p className="text-white mt-1 font-mono text-xs">{selectedLog.task_id}</p>
                  </div>
                )}
                {selectedLog.session_id && (
                  <div>
                    <span className="text-zinc-400">Session ID:</span>
                    <p className="text-white mt-1 font-mono text-xs">{selectedLog.session_id}</p>
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <span className="text-zinc-400 text-sm">Details:</span>
                <pre className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                  {selectedLog.details}
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
