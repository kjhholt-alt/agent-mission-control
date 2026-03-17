"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Clock,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface PerformanceMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  queuedTasks: number;
  errorRate: number;
  successRate: number;
  avgExecutionTime: number;
  medianExecutionTime: number;
  workerUtilization: number;
  activeWorkers: number;
  totalWorkers: number;
}

interface Trends {
  errorRate: number;
  executionTime: number;
}

interface Alert {
  level: "error" | "warning";
  message: string;
  metric: string;
}

interface QueueDepthData {
  hour: string;
  queued: number;
  running: number;
}

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [queueDepth, setQueueDepth] = useState<QueueDepthData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState(24);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [timeWindow]);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/performance?hours=${timeWindow}`);
      const data = await response.json();

      setMetrics(data.metrics);
      setTrends(data.trends);
      setQueueDepth(data.timeSeries.queueDepth);
      setAlerts(data.alerts);
    } catch (err) {
      console.error("Failed to load performance data:", err);
    } finally {
      setLoading(false);
    }
  }

  function getTrendIndicator(value: number) {
    if (Math.abs(value) < 1) return null;
    const isPositive = value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-red-400" : "text-emerald-400";
    return (
      <div className={`flex items-center gap-1 ${color} text-sm`}>
        <Icon className="w-4 h-4" />
        <span>{Math.abs(value).toFixed(1)}%</span>
      </div>
    );
  }

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-cyan-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-cyan-400">Loading performance metrics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-cyan-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-cyan-400">⚡ Performance Monitor</h1>
            <p className="text-cyan-300/60">Real-time system performance metrics and trends</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(parseInt(e.target.value))}
              className="bg-cyan-950/50 border border-cyan-800/50 rounded px-4 py-2 text-cyan-50"
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-8 space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  alert.level === "error"
                    ? "bg-red-950/20 border-red-800/50 text-red-300"
                    : "bg-amber-950/20 border-amber-800/50 text-amber-300"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Error Rate */}
          <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400/60 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Error Rate
              </span>
              {getTrendIndicator(trends?.errorRate || 0)}
            </div>
            <div className="text-3xl font-bold text-red-50 mb-1">
              {metrics.errorRate.toFixed(1)}%
            </div>
            <div className="text-sm text-red-400/60">
              {metrics.failedTasks} / {metrics.totalTasks} tasks
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-400/60 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Success Rate
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-50 mb-1">
              {metrics.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-emerald-400/60">
              {metrics.completedTasks} completed
            </div>
          </div>

          {/* Avg Execution Time */}
          <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyan-400/60 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Avg Execution
              </span>
              {getTrendIndicator(trends?.executionTime || 0)}
            </div>
            <div className="text-3xl font-bold text-cyan-50 mb-1">
              {metrics.avgExecutionTime.toFixed(1)}s
            </div>
            <div className="text-sm text-cyan-400/60">
              Median: {metrics.medianExecutionTime.toFixed(1)}s
            </div>
          </div>

          {/* Worker Utilization */}
          <div className="bg-purple-950/20 border border-purple-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-400/60 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Worker Utilization
              </span>
            </div>
            <div className="text-3xl font-bold text-purple-50 mb-1">
              {metrics.workerUtilization.toFixed(0)}%
            </div>
            <div className="text-sm text-purple-400/60">
              {metrics.activeWorkers} / {metrics.totalWorkers} active
            </div>
          </div>
        </div>

        {/* Task Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-amber-500" />
              <span className="text-amber-400/60 text-sm">Queued</span>
            </div>
            <div className="text-2xl font-bold text-amber-50">{metrics.queuedTasks}</div>
          </div>

          <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <span className="text-blue-400/60 text-sm">Running</span>
            </div>
            <div className="text-2xl font-bold text-blue-50">{metrics.runningTasks}</div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-400/60 text-sm">Completed</span>
            </div>
            <div className="text-2xl font-bold text-emerald-50">{metrics.completedTasks}</div>
          </div>

          <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-400/60 text-sm">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-50">{metrics.failedTasks}</div>
          </div>
        </div>

        {/* Queue Depth Over Time */}
        <div className="bg-cyan-950/10 border border-cyan-800/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">Queue Depth Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={queueDepth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#164e63" />
              <XAxis
                dataKey="hour"
                stroke="#06b6d4"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getHours()}:00`;
                }}
              />
              <YAxis stroke="#06b6d4" />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0f", border: "1px solid #164e63" }}
                labelStyle={{ color: "#06b6d4" }}
                labelFormatter={(value) => new Date(value).toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="queued"
                stroke="#e8a019"
                strokeWidth={2}
                name="Queued Tasks"
              />
              <Line
                type="monotone"
                dataKey="running"
                stroke="#06b6d4"
                strokeWidth={2}
                name="Running Tasks"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Summary */}
        <div className="bg-cyan-950/10 border border-cyan-800/30 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">Performance Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60">Total Tasks Processed</span>
                <span className="font-semibold text-cyan-50">{metrics.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60">Average Execution Time</span>
                <span className="font-semibold text-cyan-50">
                  {metrics.avgExecutionTime.toFixed(2)}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60">Median Execution Time</span>
                <span className="font-semibold text-cyan-50">
                  {metrics.medianExecutionTime.toFixed(2)}s
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60">Error Rate</span>
                <span
                  className={`font-semibold ${
                    metrics.errorRate > 5 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {metrics.errorRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60">Worker Utilization</span>
                <span className="font-semibold text-cyan-50">
                  {metrics.workerUtilization.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60">Current Queue Size</span>
                <span
                  className={`font-semibold ${
                    metrics.queuedTasks > 20 ? "text-amber-400" : "text-cyan-50"
                  }`}
                >
                  {metrics.queuedTasks}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
