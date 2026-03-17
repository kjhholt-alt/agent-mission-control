import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // === Task Success Rate ===
    const { data: tasks, error: tasksError } = await supabase
      .from('swarm_tasks')
      .select('status, created_at, completed_at, started_at, actual_cost_cents')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (tasksError) {
      console.error('Analytics: tasks query error:', tasksError);
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    const completed = tasks?.filter((t) => t.status === 'completed').length || 0;
    const failed = tasks?.filter((t) => t.status === 'failed').length || 0;
    const total = completed + failed;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // === Average Duration ===
    const tasksWithDuration = tasks?.filter(
      (t) => t.completed_at && t.started_at && t.status === 'completed'
    ) || [];

    const durations = tasksWithDuration.map((t) => {
      const start = new Date(t.started_at).getTime();
      const end = new Date(t.completed_at).getTime();
      return (end - start) / 1000; // seconds
    });

    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    // === Cost per Task ===
    const { data: costs, error: costsError } = await supabase
      .from('cost_tracking')
      .select('cost_usd, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (costsError) {
      console.error('Analytics: costs query error:', costsError);
    }

    const totalCost = costs?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
    const costPerTask = total > 0 ? totalCost / total : 0;

    // === Tasks Per Day (last 30 days) ===
    const tasksByDay: Record<string, number> = {};
    tasks?.forEach((t) => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      tasksByDay[date] = (tasksByDay[date] || 0) + 1;
    });

    // Fill in missing days with 0
    const tasksPerDayData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      tasksPerDayData.push({
        date: dateStr,
        count: tasksByDay[dateStr] || 0,
      });
    }

    // === Cost Per Day (last 30 days) ===
    const costsByDay: Record<string, number> = {};
    costs?.forEach((c) => {
      const date = new Date(c.created_at).toISOString().split('T')[0];
      costsByDay[date] = (costsByDay[date] || 0) + (c.cost_usd || 0);
    });

    const costPerDayData = tasksPerDayData.map((d) => ({
      date: d.date,
      cost: costsByDay[d.date] || 0,
    }));

    // === Response ===
    return NextResponse.json({
      successRate,
      avgDuration,
      costPerTask: parseFloat(costPerTask.toFixed(4)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      tasksPerDay: tasksPerDayData,
      costPerDay: costPerDayData,
      summary: {
        totalTasks: total,
        completed,
        failed,
        avgDurationMinutes: Math.round(avgDuration / 60),
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
