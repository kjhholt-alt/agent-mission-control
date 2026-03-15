"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Database,
  Webhook,
  Terminal,
  Zap,
  PartyPopper,
} from "lucide-react";

interface Step {
  id: string;
  title: string;
  description: string;
  status: "pending" | "checking" | "pass" | "fail" | "skipped";
  detail?: string;
}

export default function SetupPage() {
  const [steps, setSteps] = useState<Step[]>([
    {
      id: "supabase",
      title: "Supabase Connection",
      description: "Database, realtime subscriptions, and task storage",
      status: "pending",
    },
    {
      id: "tables",
      title: "Database Tables",
      description: "All required tables exist with correct schema",
      status: "pending",
    },
    {
      id: "hooks",
      title: "Claude Code Hooks",
      description: "Session tracking sends events to Nexus collector",
      status: "pending",
    },
    {
      id: "api",
      title: "API Routes",
      description: "All Nexus API endpoints respond correctly",
      status: "pending",
    },
    {
      id: "test-mission",
      title: "Test Mission",
      description: "Spawn a mission and verify it appears in the queue",
      status: "pending",
    },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);

  const updateStep = useCallback(
    (id: string, status: Step["status"], detail?: string) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status, detail: detail || s.detail } : s
        )
      );
    },
    []
  );

  const runSetup = async () => {
    setRunning(true);
    setComplete(false);

    // Step 1: Check Supabase
    setCurrentStep(0);
    updateStep("supabase", "checking");
    try {
      const res = await fetch("/api/collector/agents");
      if (res.ok) {
        updateStep("supabase", "pass", "Connected to Supabase");
      } else {
        updateStep("supabase", "fail", `HTTP ${res.status}`);
      }
    } catch {
      updateStep("supabase", "fail", "Cannot reach Supabase");
    }
    await sleep(500);

    // Step 2: Check tables
    setCurrentStep(1);
    updateStep("tables", "checking");
    try {
      const tableEndpoints = [
        { name: "nexus_sessions", url: "/api/sessions?limit=0" },
        { name: "swarm_tasks", url: "/api/tasks?limit=0" },
        { name: "agent_activity", url: "/api/agents" },
        { name: "nexus_hook_events", url: "/api/collector/agents" },
        { name: "radiant_engine", url: "/api/radiant" },
      ];
      let ok = 0;
      for (const { url } of tableEndpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) ok++;
        } catch { /* table check failed */ }
      }
      if (ok === tableEndpoints.length) {
        updateStep(
          "tables",
          "pass",
          `All ${tableEndpoints.length} core tables verified`
        );
      } else {
        updateStep("tables", "fail", `${ok}/${tableEndpoints.length} tables found`);
      }
    } catch {
      updateStep("tables", "fail", "Table check failed");
    }
    await sleep(500);

    // Step 3: Check hooks
    setCurrentStep(2);
    updateStep("hooks", "checking");
    try {
      // Send a test hook event
      const testSid = `setup-test-${Date.now()}`;
      const res = await fetch("/api/collector/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: testSid,
          event_type: "PreToolUse",
          tool_name: "SetupWizard",
          workspace_path: "C:/Users/Kruz/Desktop/Projects/nexus",
        }),
      });
      if (res.ok) {
        updateStep("hooks", "pass", "Collector endpoint accepts events");
      } else {
        updateStep("hooks", "fail", "Collector returned error");
      }
    } catch {
      updateStep("hooks", "fail", "Cannot reach collector");
    }
    await sleep(500);

    // Step 4: Check API routes
    setCurrentStep(3);
    updateStep("api", "checking");
    try {
      const routes = [
        "/api/agents",
        "/api/sessions",
        "/api/radiant",
        "/api/collector/agents",
      ];
      let ok = 0;
      for (const route of routes) {
        try {
          const res = await fetch(route);
          if (res.ok) ok++;
        } catch {
          // Route failed
        }
      }
      if (ok === routes.length) {
        updateStep("api", "pass", `All ${routes.length} routes healthy`);
      } else {
        updateStep("api", "fail", `${ok}/${routes.length} routes responding`);
      }
    } catch {
      updateStep("api", "fail", "API check failed");
    }
    await sleep(500);

    // Step 5: Test mission
    setCurrentStep(4);
    updateStep("test-mission", "checking");
    try {
      const res = await fetch("/api/spawn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nexus-key": "nexus-hive-2026",
        },
        body: JSON.stringify({
          goal: "Setup wizard test — say hello",
          project: "nexus",
          priority: 99,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        updateStep(
          "test-mission",
          "pass",
          `Mission queued: ${data.task_id?.slice(0, 8)}...`
        );
      } else {
        updateStep("test-mission", "fail", data.error || "Spawn failed");
      }
    } catch {
      updateStep("test-mission", "fail", "Cannot spawn mission");
    }

    setRunning(false);
    setComplete(true);
  };

  const passedCount = steps.filter((s) => s.status === "pass").length;
  const allPassed = passedCount === steps.length;

  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: "#0a0a0f" }}
    >
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Rocket className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Nexus Setup Wizard
          </h1>
          <p className="text-sm text-zinc-500">
            Verify your installation and get the factory running in 2 minutes
          </p>
        </motion.div>

        {/* Progress bar */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">
              {passedCount}/{steps.length} checks passed
            </span>
            <span className="text-xs text-zinc-500">
              {Math.round((passedCount / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              animate={{
                width: `${(passedCount / steps.length) * 100}%`,
              }}
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const icons = [
              <Database key="db" className="w-5 h-5" />,
              <Database key="tbl" className="w-5 h-5" />,
              <Webhook key="hook" className="w-5 h-5" />,
              <Terminal key="api" className="w-5 h-5" />,
              <Zap key="test" className="w-5 h-5" />,
            ];

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`border rounded-xl p-4 transition-colors ${
                  step.status === "pass"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : step.status === "fail"
                      ? "border-red-500/20 bg-red-500/5"
                      : step.status === "checking"
                        ? "border-cyan-500/20 bg-cyan-500/5"
                        : "border-zinc-800/50 bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      step.status === "pass"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : step.status === "fail"
                          ? "bg-red-500/20 text-red-400"
                          : step.status === "checking"
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {step.status === "checking" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : step.status === "pass" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : step.status === "fail" ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      icons[i]
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="text-xs text-zinc-500">{step.description}</p>
                    {step.detail && (
                      <p
                        className={`text-xs mt-1 ${
                          step.status === "pass"
                            ? "text-emerald-400"
                            : step.status === "fail"
                              ? "text-red-400"
                              : "text-cyan-400"
                        }`}
                      >
                        {step.detail}
                      </p>
                    )}
                  </div>
                  {step.status === "pending" && (
                    <ChevronRight className="w-4 h-4 text-zinc-700" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Action button */}
        <div className="text-center">
          {!complete ? (
            <button
              onClick={runSetup}
              disabled={running}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running checks...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Run Setup Checks
                </>
              )}
            </button>
          ) : allPassed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <PartyPopper className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-emerald-400">
                All Systems Go!
              </p>
              <p className="text-sm text-zinc-500">
                Nexus is fully configured. Head to the dashboard to start
                deploying agents.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/30 transition-colors"
              >
                Open Dashboard
                <ChevronRight className="w-4 h-4" />
              </a>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-400">
                {passedCount}/{steps.length} checks passed — fix issues above
                and re-run
              </p>
              <button
                onClick={runSetup}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/30 transition-colors"
              >
                Re-run Checks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
