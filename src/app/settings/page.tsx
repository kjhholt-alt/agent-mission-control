"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  envKey: string;
  testUrl?: string;
  required: boolean;
}

const SERVICES: ServiceConfig[] = [
  {
    id: "supabase",
    name: "Supabase",
    description: "Database, auth, and realtime subscriptions",
    envKey: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
  },
  {
    id: "supabase-key",
    name: "Supabase Anon Key",
    description: "Public anon key for client-side queries",
    envKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "AI model API for Oracle and agent tasks",
    envKey: "ANTHROPIC_API_KEY",
    required: false,
  },
  {
    id: "discord",
    name: "Discord Webhook",
    description: "Notifications for missions, deploys, and alerts",
    envKey: "DISCORD_WEBHOOK_URL",
    required: false,
  },
  {
    id: "nexus-key",
    name: "Nexus API Key",
    description: "Authentication for protected API endpoints",
    envKey: "NEXUS_API_KEY",
    required: false,
  },
];

const STORAGE_KEY = "nexus-service-keys";

function loadKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveKeys(keys: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, "connected" | "error" | "unknown">>({});

  useEffect(() => {
    setKeys(loadKeys());
    // Auto-detect env vars that are already configured server-side
    checkServerConfig();
  }, []);

  const checkServerConfig = async () => {
    // Check Supabase connectivity
    try {
      const res = await fetch("/api/collector/agents");
      if (res.ok) {
        setStatus((prev) => ({
          ...prev,
          supabase: "connected",
          "supabase-key": "connected",
        }));
      }
    } catch {
      setStatus((prev) => ({
        ...prev,
        supabase: "error",
        "supabase-key": "error",
      }));
    }

    // Check Discord webhook
    try {
      const res = await fetch("/api/discord/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nexus-key": keys["nexus-key"] || "nexus-hive-2026",
        },
        body: JSON.stringify({ type: "test", data: {} }),
      });
      // 500 with "not configured" = not set, 200 = configured, 502 = bad webhook
      if (res.ok) {
        setStatus((prev) => ({ ...prev, discord: "connected" }));
      } else {
        const data = await res.json();
        if (data.error?.includes("not configured")) {
          setStatus((prev) => ({ ...prev, discord: "error" }));
        }
      }
    } catch {
      // Ignore
    }
  };

  const updateKey = (serviceId: string, value: string) => {
    const updated = { ...keys, [serviceId]: value };
    setKeys(updated);
    saveKeys(updated);
  };

  const testConnection = async (service: ServiceConfig) => {
    setTesting((prev) => ({ ...prev, [service.id]: true }));
    try {
      // Simple connectivity test
      if (service.id === "supabase" || service.id === "supabase-key") {
        const res = await fetch("/api/collector/agents");
        setStatus((prev) => ({
          ...prev,
          [service.id]: res.ok ? "connected" : "error",
        }));
      } else if (service.id === "discord") {
        const res = await fetch("/api/discord/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "session_summary",
            data: { project: "nexus", model: "test", tools: 0, cost: "0.00" },
          }),
        });
        setStatus((prev) => ({
          ...prev,
          discord: res.ok ? "connected" : "error",
        }));
      } else {
        // For other services, just mark as "has key"
        setStatus((prev) => ({
          ...prev,
          [service.id]: keys[service.id] ? "connected" : "error",
        }));
      }
    } finally {
      setTesting((prev) => ({ ...prev, [service.id]: false }));
    }
  };

  const connectedCount = Object.values(status).filter((s) => s === "connected").length;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-zinc-500/10 border border-zinc-500/20">
              <Settings className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                API Connections
              </h1>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">
                {connectedCount}/{SERVICES.length} services connected
              </p>
            </div>
          </div>
          <button
            onClick={checkServerConfig}
            className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
        </motion.header>

        {/* Services list */}
        <div className="space-y-3">
          {SERVICES.map((service, i) => {
            const st = status[service.id] || "unknown";
            const isTesting = testing[service.id];
            const isShown = showKeys[service.id];

            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-zinc-900/50 border rounded-xl p-4 transition-colors ${
                  st === "connected"
                    ? "border-emerald-500/20"
                    : st === "error"
                      ? "border-red-500/20"
                      : "border-zinc-800/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {st === "connected" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : st === "error" ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {service.name}
                        {service.required && (
                          <span className="ml-2 text-[9px] text-red-400">
                            REQUIRED
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-zinc-600">
                        {service.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => testConnection(service)}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] text-zinc-400 bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors disabled:opacity-50"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    Test
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-zinc-600 w-32 shrink-0">
                    {service.envKey}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type={isShown ? "text" : "password"}
                      value={keys[service.id] || ""}
                      onChange={(e) => updateKey(service.id, e.target.value)}
                      placeholder="Set in .env.local (server-side)"
                      className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-700 outline-none focus:border-cyan-500/40 pr-10"
                    />
                    <button
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [service.id]: !prev[service.id],
                        }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"
                    >
                      {isShown ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Keyboard shortcuts reference */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4"
        >
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { key: "Ctrl+K", action: "Command Bar" },
              { key: "N", action: "New Mission" },
              { key: "R", action: "Refresh" },
              { key: "1", action: "Dashboard" },
              { key: "2", action: "Ops Center" },
              { key: "3", action: "Factory" },
              { key: "4", action: "Oracle" },
              { key: "5", action: "Sessions" },
              { key: "6", action: "Templates" },
              { key: "7", action: "Fusion" },
              { key: "Esc", action: "Close modal" },
            ].map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between px-3 py-2 bg-zinc-800/30 rounded-lg"
              >
                <kbd className="text-[10px] text-cyan-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                  {shortcut.key}
                </kbd>
                <span className="text-zinc-500">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hook setup info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4"
        >
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Claude Code Hook Setup
          </h2>
          <p className="text-xs text-zinc-500 mb-3">
            Run the setup script to configure Claude Code to send events to
            Nexus:
          </p>
          <div className="bg-[#0a0a12] rounded-lg px-4 py-3 text-xs text-cyan-400 font-mono">
            bash scripts/setup-hooks.sh
          </div>
        </motion.div>
      </div>
    </div>
  );
}
