import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "shimmer";
}

/**
 * Base skeleton component with pulse animation
 */
export function Skeleton({ className, variant = "shimmer", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-zinc-800/50",
        variant === "shimmer" && "relative overflow-hidden",
        variant === "shimmer" &&
          "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-zinc-700/30 before:to-transparent",
        variant === "default" && "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton for stat cards/boxes
 */
export function SkeletonStatBox() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-16 mt-1" />
    </div>
  );
}

/**
 * Skeleton for agent/session cards
 */
export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Skeleton className="h-2 w-12" />
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-2 w-10" />
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4 pb-2 border-b border-zinc-800/30">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for list items (tasks, events, etc.)
 */
export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="divide-y divide-zinc-800/30">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="h-2 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for chart/graph placeholder
 */
export function SkeletonChart({ height = "h-48" }: { height?: string }) {
  return (
    <div className={cn("relative", height)}>
      <div className="absolute inset-0 flex items-end justify-around gap-2 px-4 pb-4">
        {Array.from({ length: 12 }).map((_, i) => {
          const randomHeight = Math.random() * 0.6 + 0.2; // 20-80%
          return (
            <Skeleton
              key={i}
              className="flex-1 max-w-8"
              style={{ height: `${randomHeight * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Skeleton for agent activity timeline
 */
export function SkeletonTimeline({ events = 6 }: { events?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: events }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-2 h-2 rounded-full mt-1 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-1/3" />
          </div>
          <Skeleton className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for kanban column
 */
export function SkeletonKanban({ columns = 4, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div key={colIdx} className="space-y-2">
          <Skeleton className="h-6 w-20 mb-3" />
          {Array.from({ length: cardsPerColumn }).map((_, cardIdx) => (
            <div key={cardIdx} className="bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-2.5">
              <Skeleton className="h-3 w-full mb-1.5" />
              <Skeleton className="h-2 w-3/4" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for worker/agent fleet panel
 */
export function SkeletonWorkerFleet({ workers = 3 }: { workers?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: workers }).map((_, i) => (
        <div key={i} className="bg-zinc-900/30 border border-zinc-800/40 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="w-8 h-8 rounded" />
            <div className="flex-1">
              <Skeleton className="h-3 w-24 mb-1" />
              <Skeleton className="h-2 w-16" />
            </div>
            <Skeleton className="w-2 h-2 rounded-full" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Full page skeleton for dashboard
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStatBox key={i} />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Task list */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/50">
            <Skeleton className="h-4 w-32" />
          </div>
          <SkeletonList items={8} />
        </div>

        {/* Right: Cards */}
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <Skeleton className="h-4 w-24 mb-3" />
            <SkeletonList items={4} />
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <Skeleton className="h-4 w-24 mb-3" />
            <SkeletonList items={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for ops page (kanban + workers + timeline)
 */
export function SkeletonOpsPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden p-2 gap-2">
      {/* Top status ribbon */}
      <div className="flex-shrink-0 bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 min-h-0 flex gap-2">
        {/* Kanban */}
        <div className="w-[35%] bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-2">
          <SkeletonKanban columns={4} cardsPerColumn={3} />
        </div>

        {/* Worker Fleet */}
        <div className="w-[30%] bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-2">
          <SkeletonWorkerFleet workers={4} />
        </div>

        {/* Timeline */}
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-4">
          <Skeleton className="h-4 w-32 mb-4" />
          <SkeletonTimeline events={8} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
