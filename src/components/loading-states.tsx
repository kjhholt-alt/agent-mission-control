"use client";

import { motion } from "framer-motion";
import {
  SkeletonCard,
  SkeletonStatBox,
  SkeletonList,
  SkeletonChart,
  SkeletonTimeline,
  SkeletonKanban,
  SkeletonWorkerFleet,
  SkeletonOpsPage,
  SkeletonDashboard,
} from "./ui/skeleton";

/**
 * Loading state for main dashboard page
 */
export function DashboardLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SkeletonDashboard />
    </div>
  );
}

/**
 * Loading state for /today page
 */
export function TodayPageLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStatBox key={i} />
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Tasks list */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/50">
            <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
          </div>
          <SkeletonList items={10} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
            </div>
            <SkeletonList items={5} />
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
            </div>
            <SkeletonList items={5} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state for /ops page
 */
export function OpsPageLoading() {
  return <SkeletonOpsPage />;
}

/**
 * Loading state for /sessions page
 */
export function SessionsPageLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatBox key={i} />
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
        <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
        <SkeletonList items={12} />
      </div>
    </div>
  );
}

/**
 * Loading state for /workflows page
 */
export function WorkflowsPageLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} rows={3} />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for /templates page
 */
export function TemplatesPageLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} rows={2} />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for /fusion page
 */
export function FusionPageLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatBox key={i} />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
        <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
        <SkeletonChart height="h-64" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
          <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
          <SkeletonList items={8} />
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
          <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
          <SkeletonTimeline events={8} />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state for /command page
 */
export function CommandPageLoading() {
  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Kanban-style grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4"
          >
            <div className="h-5 w-24 bg-zinc-800 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-2.5"
                >
                  <div className="h-3 w-full bg-zinc-800 rounded animate-pulse mb-1.5" />
                  <div className="h-2 w-3/4 bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Work logs */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
        <SkeletonList items={6} />
      </div>
    </div>
  );
}

/**
 * Loading state for /game page (factory)
 */
export function GamePageLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-600 uppercase tracking-widest">
          Initializing Factory...
        </p>
      </div>
    </div>
  );
}

/**
 * Loading state for /oracle page
 */
export function OraclePageLoading() {
  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6"
          >
            <div className="h-5 w-48 bg-zinc-800 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-4/6 bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
