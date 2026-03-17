"use client";

import { useMemo } from "react";
import { EnhancedAreaChart, EnhancedBarChart, EnhancedPieChart, formatCost } from "./enhanced-charts";
import type { NexusSession } from "@/lib/collector-types";
import type { AgentActivity } from "@/lib/types";

// Task completion trend chart (last 7 days)
interface TaskTrendChartProps {
  tasks: Array<{ status: string; created_at: string }>;
}

export function TaskTrendChart({ tasks }: TaskTrendChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: date.getTime(),
        completed: 0,
        failed: 0,
        total: 0,
      };
    });

    tasks.forEach((task) => {
      const taskDate = new Date(task.created_at);
      taskDate.setHours(0, 0, 0, 0);
      const timestamp = taskDate.getTime();
      const dayData = last7Days.find((d) => d.timestamp === timestamp);
      if (dayData) {
        if (task.status === "completed") dayData.completed++;
        if (task.status === "failed") dayData.failed++;
        dayData.total++;
      }
    });

    return last7Days;
  }, [tasks]);

  return (
    <EnhancedAreaChart
      data={data}
      dataKeys={[
        { key: "completed", name: "Completed", color: "#10b981" },
        { key: "failed", name: "Failed", color: "#ef4444" },
      ]}
      xKey="date"
      height={250}
    />
  );
}

// Cost over time chart (last 7 days)
interface CostTrendChartProps {
  sessions: NexusSession[];
}

export function CostTrendChart({ sessions }: CostTrendChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: date.getTime(),
        cost: 0,
        sessions: 0,
      };
    });

    sessions.forEach((session) => {
      const sessionDate = new Date(session.last_activity);
      sessionDate.setHours(0, 0, 0, 0);
      const timestamp = sessionDate.getTime();
      const dayData = last7Days.find((d) => d.timestamp === timestamp);
      if (dayData) {
        dayData.cost += Number(session.cost_usd) || 0;
        dayData.sessions++;
      }
    });

    return last7Days;
  }, [sessions]);

  return (
    <EnhancedAreaChart
      data={data}
      dataKeys={[
        { key: "cost", name: "Daily Cost", color: "#f59e0b" },
      ]}
      xKey="date"
      height={250}
      formatter={(value) => formatCost(value)}
    />
  );
}

// Model distribution chart
interface ModelDistributionChartProps {
  sessions: NexusSession[];
}

export function ModelDistributionChart({ sessions }: ModelDistributionChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      const model = s.model?.includes("opus")
        ? "Opus"
        : s.model?.includes("haiku")
          ? "Haiku"
          : "Sonnet";
      counts[model] = (counts[model] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sessions]);

  return (
    <EnhancedPieChart
      data={data}
      colors={["#a855f7", "#10b981", "#06b6d4"]}
      height={250}
    />
  );
}

// Cost by model comparison
interface CostByModelChartProps {
  sessions: NexusSession[];
}

export function CostByModelChart({ sessions }: CostByModelChartProps) {
  const data = useMemo(() => {
    const costs: Record<string, number> = { Opus: 0, Sonnet: 0, Haiku: 0 };
    sessions.forEach((s) => {
      const model = s.model?.includes("opus")
        ? "Opus"
        : s.model?.includes("haiku")
          ? "Haiku"
          : "Sonnet";
      costs[model] += Number(s.cost_usd) || 0;
    });
    return [
      { model: "Opus", cost: costs.Opus },
      { model: "Sonnet", cost: costs.Sonnet },
      { model: "Haiku", cost: costs.Haiku },
    ].filter((d) => d.cost > 0);
  }, [sessions]);

  return (
    <EnhancedBarChart
      data={data}
      dataKeys={[
        { key: "cost", name: "Cost", color: "#f59e0b" },
      ]}
      xKey="model"
      height={250}
      formatter={(value) => formatCost(value)}
      showLegend={false}
    />
  );
}

// Project activity chart
interface ProjectActivityChartProps {
  sessions: NexusSession[];
}

export function ProjectActivityChart({ sessions }: ProjectActivityChartProps) {
  const data = useMemo(() => {
    const projectCounts: Record<string, number> = {};
    sessions.forEach((s) => {
      const proj = s.project_name || "unknown";
      projectCounts[proj] = (projectCounts[proj] || 0) + 1;
    });
    return Object.entries(projectCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [sessions]);

  return (
    <EnhancedBarChart
      data={data}
      dataKeys={[
        { key: "value", name: "Sessions", color: "#06b6d4" },
      ]}
      xKey="name"
      height={250}
      showLegend={false}
    />
  );
}

// Agent activity timeline (24h)
interface AgentActivityChartProps {
  agents: AgentActivity[];
}

export function AgentActivityChart({ agents }: AgentActivityChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const last24Hours = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now);
      hour.setHours(now.getHours() - (23 - i), 0, 0, 0);
      return {
        hour: hour.toLocaleTimeString("en-US", { hour: "numeric" }),
        timestamp: hour.getTime(),
        completed: 0,
        failed: 0,
        running: 0,
      };
    });

    agents.forEach((agent) => {
      const updateTime = new Date(agent.updated_at);
      updateTime.setMinutes(0, 0, 0);
      const timestamp = updateTime.getTime();
      const hourData = last24Hours.find((h) => h.timestamp === timestamp);
      if (hourData) {
        if (agent.status === "completed") hourData.completed++;
        if (agent.status === "failed") hourData.failed++;
        if (agent.status === "running") hourData.running++;
      }
    });

    return last24Hours;
  }, [agents]);

  return (
    <EnhancedAreaChart
      data={data}
      dataKeys={[
        { key: "completed", name: "Completed", color: "#10b981" },
        { key: "running", name: "Running", color: "#06b6d4" },
        { key: "failed", name: "Failed", color: "#ef4444" },
      ]}
      xKey="hour"
      height={200}
    />
  );
}

// Success rate over time
interface SuccessRateChartProps {
  tasks: Array<{ status: string; created_at: string }>;
}

export function SuccessRateChart({ tasks }: SuccessRateChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        timestamp: date.getTime(),
        successRate: 0,
        completed: 0,
        total: 0,
      };
    });

    tasks.forEach((task) => {
      const taskDate = new Date(task.created_at);
      taskDate.setHours(0, 0, 0, 0);
      const timestamp = taskDate.getTime();
      const dayData = last7Days.find((d) => d.timestamp === timestamp);
      if (dayData && (task.status === "completed" || task.status === "failed")) {
        if (task.status === "completed") dayData.completed++;
        dayData.total++;
      }
    });

    // Calculate success rate
    last7Days.forEach((day) => {
      if (day.total > 0) {
        day.successRate = Math.round((day.completed / day.total) * 100);
      }
    });

    return last7Days;
  }, [tasks]);

  return (
    <EnhancedAreaChart
      data={data}
      dataKeys={[
        { key: "successRate", name: "Success Rate", color: "#10b981" },
      ]}
      xKey="date"
      height={200}
      formatter={(value) => `${value}%`}
    />
  );
}
