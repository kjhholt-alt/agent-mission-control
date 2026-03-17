"use client";

import { Clock } from "lucide-react";
import { useState, useEffect } from "react";

export function LastUpdated({ timestamp }: { timestamp: Date | null }) {
  const [, setTick] = useState(0);

  // Re-render every second to update "ago" time
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-zinc-600">
        <Clock className="w-3 h-3" />
        Never
      </span>
    );
  }

  const now = Date.now();
  const diff = now - timestamp.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  let timeAgo: string;
  if (seconds < 60) {
    timeAgo = `${seconds}s ago`;
  } else if (minutes < 60) {
    timeAgo = `${minutes}m ago`;
  } else {
    timeAgo = `${hours}h ago`;
  }

  return (
    <span className="flex items-center gap-1 text-[10px] text-zinc-600">
      <Clock className="w-3 h-3" />
      {timeAgo}
    </span>
  );
}
