"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert, Info } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  source: string;
}

// ── Severity Config ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    icon: ShieldAlert,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    label: "CRITICAL",
    labelBg: "bg-red-500/20",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    label: "WARNING",
    labelBg: "bg-amber-500/20",
  },
  info: {
    icon: Info,
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    label: "INFO",
    labelBg: "bg-cyan-500/20",
  },
} as const;

// ── Alert Item ──────────────────────────────────────────────────────────────

function AlertItem({
  alert,
  onDismiss,
}: {
  alert: Alert;
  onDismiss: (id: string) => void;
}) {
  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`${config.bg} ${config.border} border rounded-lg px-3 py-2 flex items-center gap-2.5`}
    >
      <Icon className={`w-4 h-4 ${config.text} shrink-0`} />

      <span
        className={`text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ${config.labelBg} ${config.text} shrink-0`}
      >
        {config.label}
      </span>

      <p className={`text-xs ${config.text} flex-1 min-w-0 truncate font-medium`}>
        {alert.message}
      </p>

      <span className="text-[9px] text-zinc-600 font-mono shrink-0 hidden sm:block">
        {alert.source}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(alert.id);
        }}
        className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
        aria-label="Dismiss alert"
      >
        <X className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
      </button>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts && Array.isArray(data.alerts)) {
        setAlerts(data.alerts);
      }
    } catch {
      // Silently fail — alert banner is non-critical
    }
  }, []);

  // Initial fetch + poll every 60 seconds
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  // Filter: only critical + warning, exclude dismissed
  const visibleAlerts = alerts.filter(
    (a) =>
      (a.severity === "critical" || a.severity === "warning") &&
      !dismissed.has(a.id)
  );

  // Don't render anything if no alerts
  if (visibleAlerts.length === 0) return null;

  // Sort: critical first, then warning
  const sorted = [...visibleAlerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="fixed top-10 left-0 right-0 z-[90] px-3 py-1.5 space-y-1.5"
      style={{
        background:
          "linear-gradient(to bottom, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.8) 80%, transparent 100%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <AnimatePresence mode="popLayout">
        {sorted.map((alert) => (
          <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
