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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DollarSign, TrendingUp, AlertTriangle, Plus, Trash2 } from "lucide-react";

interface CostEntry {
  date: string;
  project: string;
  model: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  operation_count: number;
}

interface ProjectSummary {
  project: string;
  total_cost_usd: number;
  total_tokens_in: number;
  total_tokens_out: number;
  operation_count: number;
}

interface BudgetAlert {
  id: string;
  name: string;
  threshold_usd: number;
  period: string;
  project_filter: string | null;
  enabled: boolean;
  last_triggered_at: string | null;
}

const COLORS = ["#06b6d4", "#10b981", "#e8a019", "#ef4444", "#8b5cf6", "#ec4899"];

export default function CostsPage() {
  const [dailyCosts, setDailyCosts] = useState<CostEntry[]>([]);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    name: "",
    threshold_usd: "",
    period: "daily",
    project_filter: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Get last 30 days of daily costs
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const [dailyRes, projectRes, alertsRes] = await Promise.all([
        fetch(`/api/costs?group_by=day&start_date=${startDate.toISOString()}&limit=30`),
        fetch(`/api/costs?group_by=project`),
        fetch(`/api/costs/alerts`),
      ]);

      const daily = await dailyRes.json();
      const projects = await projectRes.json();
      const alertsData = await alertsRes.json();

      setDailyCosts(daily.data || []);
      setProjectSummary(projects.data || []);
      setAlerts(alertsData.data || []);
    } catch (err) {
      console.error("Failed to load cost data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createAlert() {
    try {
      const response = await fetch("/api/costs/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAlert,
          threshold_usd: parseFloat(newAlert.threshold_usd),
          project_filter: newAlert.project_filter || null,
        }),
      });

      if (response.ok) {
        setShowNewAlert(false);
        setNewAlert({ name: "", threshold_usd: "", period: "daily", project_filter: "" });
        loadData();
      }
    } catch (err) {
      console.error("Failed to create alert:", err);
    }
  }

  async function deleteAlert(id: string) {
    try {
      await fetch(`/api/costs/alerts?id=${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  }

  // Calculate metrics
  const totalCost = projectSummary.reduce((sum, p) => sum + parseFloat(p.total_cost_usd as any), 0);
  const last7Days = dailyCosts.slice(0, 7);
  const last7DaysCost = last7Days.reduce((sum, d) => sum + parseFloat(d.total_cost_usd as any), 0);
  const avgDailyCost = last7DaysCost / 7;
  const projectedMonthlyCost = avgDailyCost * 30;

  // Group daily costs by date for chart
  const dailyChartData = dailyCosts.reduce((acc, entry) => {
    const existing = acc.find((d) => d.date === entry.date);
    if (existing) {
      existing.cost += parseFloat(entry.total_cost_usd as any);
    } else {
      acc.push({ date: entry.date, cost: parseFloat(entry.total_cost_usd as any) });
    }
    return acc;
  }, [] as { date: string; cost: number }[]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-cyan-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-cyan-400">Loading cost data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-cyan-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-cyan-400">💰 Cost Tracking</h1>
          <p className="text-cyan-300/60">API usage costs across all projects</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyan-400/60 text-sm">Total Spend</span>
              <DollarSign className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="text-3xl font-bold text-cyan-50">${totalCost.toFixed(2)}</div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-400/60 text-sm">Last 7 Days</span>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold text-emerald-50">${last7DaysCost.toFixed(2)}</div>
          </div>

          <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-400/60 text-sm">Avg Daily</span>
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-amber-50">${avgDailyCost.toFixed(2)}</div>
          </div>

          <div className="bg-purple-950/20 border border-purple-800/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-400/60 text-sm">Projected Monthly</span>
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-purple-50">${projectedMonthlyCost.toFixed(2)}</div>
          </div>
        </div>

        {/* Daily Spend Chart */}
        <div className="bg-cyan-950/10 border border-cyan-800/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">Daily Spend (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyChartData.reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#164e63" />
              <XAxis dataKey="date" stroke="#06b6d4" />
              <YAxis stroke="#06b6d4" />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0f", border: "1px solid #164e63" }}
                labelStyle={{ color: "#06b6d4" }}
              />
              <Legend />
              <Line type="monotone" dataKey="cost" stroke="#06b6d4" strokeWidth={2} name="Cost ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Project Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Bar Chart */}
          <div className="bg-cyan-950/10 border border-cyan-800/30 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Cost by Project</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#164e63" />
                <XAxis dataKey="project" stroke="#06b6d4" />
                <YAxis stroke="#06b6d4" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0a0a0f", border: "1px solid #164e63" }}
                  labelStyle={{ color: "#06b6d4" }}
                />
                <Bar dataKey="total_cost_usd" fill="#06b6d4" name="Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-cyan-950/10 border border-cyan-800/30 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Project Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={projectSummary}
                  dataKey="total_cost_usd"
                  nameKey="project"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {projectSummary.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0a0a0f", border: "1px solid #164e63" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Alerts */}
        <div className="bg-cyan-950/10 border border-cyan-800/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-cyan-400">Budget Alerts</h2>
            <button
              onClick={() => setShowNewAlert(!showNewAlert)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Alert
            </button>
          </div>

          {showNewAlert && (
            <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Alert name"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                  className="bg-cyan-950/50 border border-cyan-800/50 rounded px-3 py-2 text-cyan-50"
                />
                <input
                  type="number"
                  placeholder="Threshold ($)"
                  value={newAlert.threshold_usd}
                  onChange={(e) => setNewAlert({ ...newAlert, threshold_usd: e.target.value })}
                  className="bg-cyan-950/50 border border-cyan-800/50 rounded px-3 py-2 text-cyan-50"
                />
                <select
                  value={newAlert.period}
                  onChange={(e) => setNewAlert({ ...newAlert, period: e.target.value })}
                  className="bg-cyan-950/50 border border-cyan-800/50 rounded px-3 py-2 text-cyan-50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <input
                  type="text"
                  placeholder="Project filter (optional)"
                  value={newAlert.project_filter}
                  onChange={(e) => setNewAlert({ ...newAlert, project_filter: e.target.value })}
                  className="bg-cyan-950/50 border border-cyan-800/50 rounded px-3 py-2 text-cyan-50"
                />
              </div>
              <button
                onClick={createAlert}
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors"
              >
                Create Alert
              </button>
            </div>
          )}

          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-cyan-400/60 text-center py-8">No budget alerts configured</p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-cyan-950/20 border border-cyan-800/30 rounded-lg p-4"
                >
                  <div className="flex items-center gap-4">
                    <AlertTriangle className={`w-5 h-5 ${alert.enabled ? "text-amber-500" : "text-gray-500"}`} />
                    <div>
                      <div className="font-semibold text-cyan-50">{alert.name}</div>
                      <div className="text-sm text-cyan-400/60">
                        ${alert.threshold_usd} / {alert.period}
                        {alert.project_filter && ` • ${alert.project_filter}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
