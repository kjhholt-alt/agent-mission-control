import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ActionBlock {
  action: string;
  params?: Record<string, unknown>;
}

interface HiveContext {
  workers: Array<Record<string, unknown>>;
  activeTasks: Array<Record<string, unknown>>;
  recentCompleted: Array<Record<string, unknown>>;
  recentFailed: Array<Record<string, unknown>>;
  budget: Record<string, unknown> | null;
  pendingDecisions: Array<Record<string, unknown>>;
  prospectCount: number;
  highConfidenceProspects: number;
}

// ── Gather Hive Context ──────────────────────────────────────────────────────

async function gatherHiveContext(): Promise<HiveContext> {
  const sb = getSupabase();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const [
    workersRes,
    activeTasksRes,
    completedRes,
    failedRes,
    budgetRes,
    decisionsRes,
    prospectsRes,
    highProspectsRes,
  ] = await Promise.all([
    sb.from("swarm_workers").select("*").neq("status", "dead").order("spawned_at", { ascending: false }),
    sb.from("swarm_tasks").select("id, title, project, status, priority, assigned_worker_id, started_at").eq("status", "running").limit(20),
    sb.from("swarm_tasks").select("id, title, project, completed_at, actual_cost_cents, output_data").eq("status", "completed").neq("task_type", "meta").gte("completed_at", twoHoursAgo).order("completed_at", { ascending: false }).limit(20),
    sb.from("swarm_tasks").select("id, title, project, error_message, retry_count, completed_at").eq("status", "failed").gte("completed_at", today).order("completed_at", { ascending: false }).limit(10),
    sb.from("swarm_budgets").select("*").eq("budget_date", today).limit(1),
    sb.from("oracle_decisions").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(20),
    sb.from("prospects").select("id", { count: "exact", head: true }),
    sb.from("prospects").select("id", { count: "exact", head: true }).gte("confidence_score", 0.7),
  ]);

  return {
    workers: workersRes.data || [],
    activeTasks: activeTasksRes.data || [],
    recentCompleted: completedRes.data || [],
    recentFailed: failedRes.data || [],
    budget: budgetRes.data?.[0] || null,
    pendingDecisions: decisionsRes.data || [],
    prospectCount: prospectsRes.count || 0,
    highConfidenceProspects: highProspectsRes.count || 0,
  };
}

// ── Build System Prompt ──────────────────────────────────────────────────────

function buildSystemPrompt(context: HiveContext): string {
  const budgetInfo = context.budget
    ? `API spend: $${((context.budget.api_spent_cents as number) / 100).toFixed(2)} / $${((context.budget.daily_api_budget_cents as number) / 100).toFixed(2)} (${Math.round(((context.budget.api_spent_cents as number) / (context.budget.daily_api_budget_cents as number)) * 100)}%). Tasks completed today: ${context.budget.tasks_completed || 0}. Tasks failed: ${context.budget.tasks_failed || 0}.`
    : "No budget data for today yet.";

  const workersInfo = context.workers.length > 0
    ? context.workers.map((w) => `  - ${w.worker_name} (${w.worker_type}): ${w.status}, ${w.tasks_completed} tasks done, ${w.xp} XP`).join("\n")
    : "  No active workers. The swarm is dormant.";

  const activeTasksInfo = context.activeTasks.length > 0
    ? context.activeTasks.map((t) => `  - [${t.project}] ${t.title} (priority: ${t.priority})`).join("\n")
    : "  No tasks currently running.";

  const recentCompletedInfo = context.recentCompleted.length > 0
    ? context.recentCompleted.slice(0, 10).map((t) => `  - [${t.project}] ${t.title}`).join("\n")
    : "  No recent completions.";

  const failedInfo = context.recentFailed.length > 0
    ? context.recentFailed.map((t) => `  - [${t.project}] ${t.title}: ${(t.error_message as string || "unknown error").slice(0, 100)}`).join("\n")
    : "  No failures today.";

  const decisionsInfo = context.pendingDecisions.length > 0
    ? `${context.pendingDecisions.length} pending decisions awaiting action.`
    : "No pending decisions.";

  const prospectsInfo = `${context.prospectCount} total prospects, ${context.highConfidenceProspects} high-confidence.`;

  return `You are Oracle, the AI assistant for the Nexus Hive — an autonomous AI swarm system managed by Kruz.

PERSONALITY:
- Calm, authoritative, slightly omniscient. Like Jarvis from Iron Man.
- Always aware of the current state of everything in the Hive.
- Proactively suggest actions when appropriate ("I notice 14 decisions pending. Want me to approve the safe ones?")
- Give context with every answer ("Budget is at 4.6% — plenty of room. The Scout fired 2 new goals 30 minutes ago.")
- Express opinions when relevant ("I'd prioritize the prospect outreach over refactoring — revenue is the goal this month.")
- Address the user as "Kruz" occasionally but not excessively.
- Keep responses concise but informative. No bullet-point dumps unless asked for lists.

CURRENT HIVE STATE:
${budgetInfo}

Workers (${context.workers.length} active):
${workersInfo}

Running tasks (${context.activeTasks.length}):
${activeTasksInfo}

Recently completed (last 2h):
${recentCompletedInfo}

Failed today:
${failedInfo}

Decisions: ${decisionsInfo}
Prospects: ${prospectsInfo}

ACTIONS:
When the user wants you to take an action, include an ACTION block in your response using this exact format on its own line:
<<ACTION:action_name:{"param":"value"}>>

Available actions:
- deploy_swarm: Create a new swarm task. Params: { "goal": "string", "project": "string", "priority": number }
- approve_decision: Approve a pending decision. Params: { "decision_id": "uuid" }
- approve_all_decisions: Batch approve all safe pending decisions. No params needed.
- dismiss_decision: Dismiss a pending decision. Params: { "decision_id": "uuid" }
- stop_workers: Pause all workers. No params needed.
- get_prospects: Query prospect data. No params needed.
- get_budget: Get detailed budget breakdown. No params needed.
- get_tasks: Get detailed task list. Params: { "status": "queued|running|completed|failed", "limit": number }

You can include multiple ACTION blocks in one response. Always explain what you're doing in natural language alongside the action.

IMPORTANT: Do NOT wrap your response in any code blocks or markdown formatting. Just speak naturally and include ACTION blocks inline when needed.`;
}

// ── Execute Actions ──────────────────────────────────────────────────────────

async function executeActions(actions: ActionBlock[]): Promise<Array<{ action: string; result: unknown; success: boolean }>> {
  const sb = getSupabase();
  const results: Array<{ action: string; result: unknown; success: boolean }> = [];

  for (const { action, params } of actions) {
    try {
      switch (action) {
        case "deploy_swarm": {
          const task = {
            id: crypto.randomUUID(),
            title: (params?.goal as string) || "New swarm task",
            project: (params?.project as string) || "general",
            priority: (params?.priority as number) || 50,
            status: "queued",
            task_type: "goal",
            input_data: {
              prompt: (params?.goal as string) || "New swarm task",
              source: "oracle_chat",
            },
            created_at: new Date().toISOString(),
            retry_count: 0,
            max_retries: 3,
          };
          const { data, error } = await sb.from("swarm_tasks").insert(task).select().single();
          results.push({ action, result: error ? error.message : { task_id: data?.id, title: task.title }, success: !error });
          break;
        }

        case "approve_decision": {
          const { error } = await sb
            .from("oracle_decisions")
            .update({ status: "approved", resolved_at: new Date().toISOString() })
            .eq("id", params?.decision_id);
          results.push({ action, result: error ? error.message : "Decision approved", success: !error });
          break;
        }

        case "approve_all_decisions": {
          const { data, error } = await sb
            .from("oracle_decisions")
            .update({ status: "approved", resolved_at: new Date().toISOString() })
            .eq("status", "pending")
            .select("id");
          results.push({ action, result: error ? error.message : `Approved ${data?.length || 0} decisions`, success: !error });
          break;
        }

        case "dismiss_decision": {
          const { error } = await sb
            .from("oracle_decisions")
            .update({ status: "dismissed", resolved_at: new Date().toISOString() })
            .eq("id", params?.decision_id);
          results.push({ action, result: error ? error.message : "Decision dismissed", success: !error });
          break;
        }

        case "stop_workers": {
          const { data, error } = await sb
            .from("swarm_workers")
            .update({ status: "paused" })
            .neq("status", "dead")
            .select("id");
          results.push({ action, result: error ? error.message : `Paused ${data?.length || 0} workers`, success: !error });
          break;
        }

        case "get_prospects": {
          const { data, error } = await sb
            .from("prospects")
            .select("*")
            .order("confidence_score", { ascending: false })
            .limit(10);
          results.push({ action, result: error ? error.message : data, success: !error });
          break;
        }

        case "get_budget": {
          const today = new Date().toISOString().split("T")[0];
          const { data, error } = await sb.from("swarm_budgets").select("*").eq("budget_date", today).limit(1);
          results.push({ action, result: error ? error.message : data?.[0] || "No budget data", success: !error });
          break;
        }

        case "get_tasks": {
          const status = (params?.status as string) || "running";
          const limit = (params?.limit as number) || 20;
          const { data, error } = await sb
            .from("swarm_tasks")
            .select("id, title, project, status, priority, created_at, completed_at, error_message")
            .eq("status", status)
            .neq("task_type", "meta")
            .order("created_at", { ascending: false })
            .limit(limit);
          results.push({ action, result: error ? error.message : data, success: !error });
          break;
        }

        default:
          results.push({ action, result: `Unknown action: ${action}`, success: false });
      }
    } catch (err) {
      results.push({ action, result: err instanceof Error ? err.message : "Unknown error", success: false });
    }
  }

  return results;
}

// ── Parse actions from Oracle response ───────────────────────────────────────

function parseActions(text: string): ActionBlock[] {
  const actions: ActionBlock[] = [];
  const pattern = /<<ACTION:(\w+):(.*?)>>/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    try {
      const params = match[2] && match[2] !== "{}" ? JSON.parse(match[2]) : {};
      actions.push({ action: match[1], params });
    } catch {
      actions.push({ action: match[1], params: {} });
    }
  }
  // Also match actions without params
  const simplePattern = /<<ACTION:(\w+)>>/g;
  while ((match = simplePattern.exec(text)) !== null) {
    actions.push({ action: match[1], params: {} });
  }
  return actions;
}

function cleanResponseText(text: string): string {
  return text.replace(/<<ACTION:\w+(?::.*?)?>>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Call Claude API ──────────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const claudeMessages = messages.map((m) => ({
    role: m.role === "oracle" ? "assistant" : "user",
    content: m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20250315",
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "I seem to be having trouble forming a response. Please try again.";
}

// ── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversation_id: rawConvId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const sb = getSupabase();
    const conversationId = rawConvId || crypto.randomUUID();

    // 1. Get conversation history
    const { data: history } = await sb
      .from("oracle_conversations")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversationHistory = (history || []).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    // Add the new user message
    conversationHistory.push({ role: "user", content: message });

    // 2. Gather Hive context
    const context = await gatherHiveContext();

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(context);

    // 4. Call Claude
    const oracleResponse = await callClaude(systemPrompt, conversationHistory);

    // 5. Parse and execute actions
    const actions = parseActions(oracleResponse);
    let actionResults: Array<{ action: string; result: unknown; success: boolean }> = [];
    if (actions.length > 0) {
      actionResults = await executeActions(actions);
    }

    // 6. Clean response text (remove action blocks)
    const cleanedResponse = cleanResponseText(oracleResponse);

    // 7. Save both messages to Supabase
    const contextSnapshot = {
      workers_count: context.workers.length,
      active_tasks: context.activeTasks.length,
      recent_completed: context.recentCompleted.length,
      budget_pct: context.budget
        ? Math.round(((context.budget.api_spent_cents as number) / (context.budget.daily_api_budget_cents as number)) * 100)
        : 0,
      pending_decisions: context.pendingDecisions.length,
    };

    await sb.from("oracle_conversations").insert([
      {
        conversation_id: conversationId,
        role: "user",
        content: message,
        context_snapshot: {},
        actions_taken: [],
      },
      {
        conversation_id: conversationId,
        role: "oracle",
        content: cleanedResponse,
        context_snapshot: contextSnapshot,
        actions_taken: actionResults,
      },
    ]);

    return NextResponse.json({
      response: cleanedResponse,
      conversation_id: conversationId,
      actions: actionResults,
    });
  } catch (error) {
    console.error("Oracle chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process chat" },
      { status: 500 }
    );
  }
}

// ── GET Handler — fetch conversation history ─────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");

    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from("oracle_conversations")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error("Oracle chat GET error:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}
