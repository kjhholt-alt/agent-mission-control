import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/performance — Performance metrics aggregation
 *
 * Query params:
 *   hours: number (default 24) - time window for metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);
    const cutoffISO = cutoffDate.toISOString();

    // Fetch all tasks in the time window
    const { data: tasks, error: tasksError } = await supabase
      .from("swarm_tasks")
      .select("*")
      .gte("created_at", cutoffISO)
      .order("created_at", { ascending: true });

    if (tasksError) throw tasksError;

    // Fetch worker data
    const { data: workers, error: workersError } = await supabase
      .from("swarm_workers")
      .select("*");

    if (workersError) throw workersError;

    // Calculate execution times (for completed tasks)
    const completedTasks = (tasks || []).filter((t: any) => t.status === "completed" && t.completed_at);
    const executionTimes = completedTasks.map((t: any) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.completed_at).getTime();
      return (end - start) / 1000; // seconds
    });

    const avgExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0;

    const medianExecutionTime =
      executionTimes.length > 0
        ? executionTimes.sort((a, b) => a - b)[Math.floor(executionTimes.length / 2)]
        : 0;

    // Calculate status distribution
    const statusCounts: Record<string, number> = {};
    (tasks || []).forEach((t: any) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });

    const totalTasks = tasks?.length || 0;
    const completedCount = statusCounts.completed || 0;
    const failedCount = statusCounts.failed || 0;
    const runningCount = statusCounts.running || 0;
    const queuedCount = statusCounts.queued || 0;

    const errorRate = totalTasks > 0 ? (failedCount / totalTasks) * 100 : 0;
    const successRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

    // Queue depth over time (hourly buckets)
    const queueDepthOverTime = calculateQueueDepth(tasks || []);

    // Worker utilization
    const activeWorkers = (workers || []).filter((w: any) => w.status === "active").length;
    const totalWorkers = workers?.length || 0;
    const workerUtilization = totalWorkers > 0 ? (activeWorkers / totalWorkers) * 100 : 0;

    // Calculate trends (compare last half vs first half of time window)
    const midpoint = new Date(cutoffDate.getTime() + (Date.now() - cutoffDate.getTime()) / 2);
    const firstHalf = (tasks || []).filter((t: any) => new Date(t.created_at) < midpoint);
    const secondHalf = (tasks || []).filter((t: any) => new Date(t.created_at) >= midpoint);

    const firstHalfErrorRate =
      firstHalf.length > 0
        ? (firstHalf.filter((t: any) => t.status === "failed").length / firstHalf.length) * 100
        : 0;
    const secondHalfErrorRate =
      secondHalf.length > 0
        ? (secondHalf.filter((t: any) => t.status === "failed").length / secondHalf.length) * 100
        : 0;

    const errorRateTrend =
      firstHalfErrorRate > 0
        ? ((secondHalfErrorRate - firstHalfErrorRate) / firstHalfErrorRate) * 100
        : 0;

    // Execution time trend
    const firstHalfExecTimes = firstHalf
      .filter((t: any) => t.status === "completed" && t.completed_at)
      .map((t: any) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.completed_at).getTime();
        return (end - start) / 1000;
      });

    const secondHalfExecTimes = secondHalf
      .filter((t: any) => t.status === "completed" && t.completed_at)
      .map((t: any) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.completed_at).getTime();
        return (end - start) / 1000;
      });

    const firstHalfAvgExecTime =
      firstHalfExecTimes.length > 0
        ? firstHalfExecTimes.reduce((sum, t) => sum + t, 0) / firstHalfExecTimes.length
        : 0;

    const secondHalfAvgExecTime =
      secondHalfExecTimes.length > 0
        ? secondHalfExecTimes.reduce((sum, t) => sum + t, 0) / secondHalfExecTimes.length
        : 0;

    const execTimeTrend =
      firstHalfAvgExecTime > 0
        ? ((secondHalfAvgExecTime - firstHalfAvgExecTime) / firstHalfAvgExecTime) * 100
        : 0;

    return NextResponse.json({
      metrics: {
        totalTasks,
        completedTasks: completedCount,
        failedTasks: failedCount,
        runningTasks: runningCount,
        queuedTasks: queuedCount,
        errorRate,
        successRate,
        avgExecutionTime,
        medianExecutionTime,
        workerUtilization,
        activeWorkers,
        totalWorkers,
      },
      trends: {
        errorRate: errorRateTrend,
        executionTime: execTimeTrend,
      },
      timeSeries: {
        queueDepth: queueDepthOverTime,
      },
      alerts: generateAlerts(errorRate, avgExecutionTime, queuedCount),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Calculate queue depth over time in hourly buckets
 */
function calculateQueueDepth(tasks: any[]): Array<{ hour: string; queued: number; running: number }> {
  if (tasks.length === 0) return [];

  const buckets: Record<string, { queued: number; running: number }> = {};

  tasks.forEach((task) => {
    const hour = new Date(task.created_at).toISOString().slice(0, 13) + ":00:00";
    if (!buckets[hour]) {
      buckets[hour] = { queued: 0, running: 0 };
    }
    if (task.status === "queued") buckets[hour].queued++;
    if (task.status === "running") buckets[hour].running++;
  });

  return Object.entries(buckets)
    .map(([hour, counts]) => ({ hour, ...counts }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

/**
 * Generate alerts based on thresholds
 */
function generateAlerts(errorRate: number, avgExecutionTime: number, queuedTasks: number) {
  const alerts = [];

  if (errorRate > 5) {
    alerts.push({
      level: "error",
      message: `Error rate is ${errorRate.toFixed(1)}% (threshold: 5%)`,
      metric: "error_rate",
    });
  }

  if (avgExecutionTime > 300) {
    alerts.push({
      level: "warning",
      message: `Average execution time is ${avgExecutionTime.toFixed(0)}s (threshold: 300s)`,
      metric: "execution_time",
    });
  }

  if (queuedTasks > 20) {
    alerts.push({
      level: "warning",
      message: `${queuedTasks} tasks queued (threshold: 20)`,
      metric: "queue_depth",
    });
  }

  return alerts;
}
