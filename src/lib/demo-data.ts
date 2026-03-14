import { HeartbeatPayload } from "./types";

const DEMO_AGENTS: {
  agent_id: string;
  agent_name: string;
  project: string;
  steps: string[];
  total_steps: number;
  finalOutput: string;
  finalStatus: "completed" | "failed";
}[] = [
  {
    agent_id: "pl-engine-001",
    agent_name: "PL Engine Optimizer",
    project: "pl-engine",
    steps: [
      "Scanning codebase for improvement targets...",
      "Analyzing function complexity in src/core/engine.py",
      "Refactoring calculate_pnl() — reduced from 47 to 23 lines",
      "Running test suite (142 tests)...",
      "All tests passing. Generating PR...",
      "PR #47 created: 'Optimize PnL calculation pipeline'",
    ],
    total_steps: 6,
    finalOutput:
      "Refactored 3 functions, reduced complexity by 38%. PR #47 ready for review.",
    finalStatus: "completed",
  },
  {
    agent_id: "email-enricher-002",
    agent_name: "Email Enricher",
    project: "buildkit-services",
    steps: [
      "Loading prospect list (500 domains)...",
      "Scanning rainmasterqc.com — found office@rainmasterqc.com",
      "Scanning alpineoutdoor.com — found info@alpineoutdoor.com",
      "Scanning trailblaze.io — no email found, trying LinkedIn...",
      "Batch 1 complete: 127/150 emails found (84.7% hit rate)",
      "Enriching contact records with company data...",
      "Writing results to Supabase...",
    ],
    total_steps: 500,
    finalOutput:
      "500 prospects scanned, 312 emails found (62.4% hit rate). Results saved.",
    finalStatus: "completed",
  },
  {
    agent_id: "code-review-003",
    agent_name: "Code Reviewer",
    project: "ai-finance-brief",
    steps: [
      "Checking out PR #23: 'Add portfolio analytics page'",
      "Analyzing 12 changed files...",
      "Found potential SQL injection in src/api/portfolio.ts:47",
      "Found missing error boundary in PortfolioChart component",
      "Generating review comments...",
    ],
    total_steps: 5,
    finalOutput:
      "Review complete: 2 critical issues, 3 suggestions. Comments posted to PR #23.",
    finalStatus: "completed",
  },
  {
    agent_id: "seo-autopilot-004",
    agent_name: "SEO Autopilot",
    project: "pc-bottleneck-analyzer",
    steps: [
      "Researching trending keywords: 'RTX 5070 bottleneck'",
      "Generating article outline (2,400 words target)...",
      "Writing section 1/5: Introduction...",
      "Writing section 3/5: Benchmark Analysis...",
      "Generating meta tags and internal links...",
      "Publishing to /blog/rtx-5070-bottleneck-guide",
    ],
    total_steps: 6,
    finalOutput:
      "Published: 'RTX 5070 Bottleneck Guide' — 2,847 words, 14 internal links, SEO score 94/100.",
    finalStatus: "completed",
  },
];

export function generateDemoHeartbeats(): {
  payloads: HeartbeatPayload[];
  delays: number[];
}[] {
  return DEMO_AGENTS.map((agent) => {
    const payloads: HeartbeatPayload[] = [];
    const delays: number[] = [];

    agent.steps.forEach((step, i) => {
      payloads.push({
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
        project: agent.project,
        status: i === agent.steps.length - 1 ? agent.finalStatus : "running",
        current_step: step,
        steps_completed: Math.min(i + 1, agent.total_steps),
        total_steps: agent.total_steps,
        output:
          i === agent.steps.length - 1 ? agent.finalOutput : undefined,
      });
      delays.push(1500 + Math.random() * 3000);
    });

    return { payloads, delays };
  });
}

export { DEMO_AGENTS };
