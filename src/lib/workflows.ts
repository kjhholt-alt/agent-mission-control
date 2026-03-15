"use client";

/**
 * Nexus Workflow Engine — chains mission templates into multi-step pipelines.
 *
 * A workflow is a sequence of steps. Each step spawns a mission via /api/spawn.
 * Steps can depend on previous steps (output feeds into next input).
 * Workflows are stored in localStorage.
 */

export interface WorkflowStep {
  id: string;
  template_name: string;
  goal: string;
  project: string;
  worker_type: string;
  priority: number;
  /** Prepend previous step's output to this step's goal */
  use_previous_output: boolean;
  /** Pause and wait for user approval before running */
  wait_for_approval: boolean;
  /** Max minutes before timeout */
  timeout_minutes: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  project: string;
  trigger: "manual" | "scheduled" | "webhook";
  cron?: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  run_count: number;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: "running" | "completed" | "failed" | "paused";
  current_step: number;
  total_steps: number;
  step_results: Array<{
    step_id: string;
    task_id: string;
    status: string;
    output?: string;
    started_at: string;
    completed_at?: string;
  }>;
  started_at: string;
  completed_at?: string;
  error?: string;
}

const WORKFLOW_KEY = "nexus-workflows";
const RUNS_KEY = "nexus-workflow-runs";

// ── Storage ─────────────────────────────────────────────────────────

export function loadWorkflows(): Workflow[] {
  if (typeof window === "undefined") return DEFAULT_WORKFLOWS;
  try {
    const stored = localStorage.getItem(WORKFLOW_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_WORKFLOWS;
}

export function saveWorkflows(workflows: Workflow[]) {
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflows));
}

export function loadRuns(): WorkflowRun[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RUNS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveRuns(runs: WorkflowRun[]) {
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, 50)));
}

// ── Step ID generator ───────────────────────────────────────────────

export function newStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newWorkflowId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Default Workflows ───────────────────────────────────────────────

const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: "wf-morning-standup",
    name: "Morning Standup",
    description: "Check git activity, run health check, generate daily brief, post to Discord",
    steps: [
      {
        id: "s1",
        template_name: "Git Activity Check",
        goal: "Check git log for all projects in the last 24 hours. List commits by project with authors and descriptions.",
        project: "nexus",
        worker_type: "scout",
        priority: 40,
        use_previous_output: false,
        wait_for_approval: false,
        timeout_minutes: 5,
      },
      {
        id: "s2",
        template_name: "Health Check",
        goal: "Check the health of all deployed services: nexus.buildkit.store, services.buildkit.store, pcbottleneck.buildkit.store, ai-finance-brief.vercel.app. Report status of each.",
        project: "nexus",
        worker_type: "inspector",
        priority: 40,
        use_previous_output: false,
        wait_for_approval: false,
        timeout_minutes: 5,
      },
      {
        id: "s3",
        template_name: "Daily Brief",
        goal: "Based on the following project activity and health status, write a concise daily briefing (under 200 words). Include: key accomplishments, issues requiring attention, and top priorities for today.",
        project: "nexus",
        worker_type: "scout",
        priority: 30,
        use_previous_output: true,
        wait_for_approval: false,
        timeout_minutes: 5,
      },
    ],
    project: "nexus",
    trigger: "scheduled",
    cron: "0 7 * * *",
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-03-15T00:00:00Z",
    run_count: 0,
  },
  {
    id: "wf-code-ship",
    name: "Code Ship",
    description: "Run tests, code review, fix issues, deploy, verify",
    steps: [
      {
        id: "s1",
        template_name: "Run Tests",
        goal: "Run the full test suite for this project. Report all passing and failing tests. If there are failures, list each one with the error message.",
        project: "nexus",
        worker_type: "inspector",
        priority: 20,
        use_previous_output: false,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
      {
        id: "s2",
        template_name: "Code Review",
        goal: "Review the latest uncommitted changes for bugs, security issues, and code quality problems. Report only HIGH confidence issues.",
        project: "nexus",
        worker_type: "inspector",
        priority: 30,
        use_previous_output: false,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
      {
        id: "s3",
        template_name: "Fix Issues",
        goal: "Based on the test results and code review findings below, fix any critical issues. Commit the fixes.",
        project: "nexus",
        worker_type: "builder",
        priority: 20,
        use_previous_output: true,
        wait_for_approval: true,
        timeout_minutes: 15,
      },
      {
        id: "s4",
        template_name: "Deploy",
        goal: "Deploy the project to production. Verify the deployment is live and working. Report the deployment URL.",
        project: "nexus",
        worker_type: "deployer",
        priority: 10,
        use_previous_output: false,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
    ],
    project: "nexus",
    trigger: "manual",
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-03-15T00:00:00Z",
    run_count: 0,
  },
  {
    id: "wf-monthly-close",
    name: "Monthly Close Prep",
    description: "Gather data, variance analysis, draft report, format presentation",
    steps: [
      {
        id: "s1",
        template_name: "Gather Data",
        goal: "Compile all relevant financial data for the monthly close: revenue figures, expense categories, budget allocations, and any outstanding items. Organize by department/cost center.",
        project: "nexus",
        worker_type: "miner",
        priority: 30,
        use_previous_output: false,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
      {
        id: "s2",
        template_name: "Variance Analysis",
        goal: "Perform variance analysis on the data below. For each line item: calculate $ variance and % variance vs budget. Flag items exceeding 5% threshold. Provide root cause hypotheses.",
        project: "nexus",
        worker_type: "inspector",
        priority: 25,
        use_previous_output: true,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
      {
        id: "s3",
        template_name: "Draft Report",
        goal: "Based on the variance analysis below, draft a monthly close report. Include: executive summary, key variances with explanations, recommended actions, and outlook for next month.",
        project: "nexus",
        worker_type: "scout",
        priority: 30,
        use_previous_output: true,
        wait_for_approval: true,
        timeout_minutes: 10,
      },
      {
        id: "s4",
        template_name: "Format Presentation",
        goal: "Convert the report below into presentation slides. Each slide: title + 3-5 bullet points + speaker notes. Include: summary slide, variance slides, recommendation slide, next steps.",
        project: "nexus",
        worker_type: "builder",
        priority: 40,
        use_previous_output: true,
        wait_for_approval: false,
        timeout_minutes: 10,
      },
    ],
    project: "nexus",
    trigger: "manual",
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-03-15T00:00:00Z",
    run_count: 0,
  },
];
