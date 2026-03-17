"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface BootSequenceProps {
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  onComplete: () => void;
}

const BOOT_LINES = [
  { text: "NEXUS TERMINAL v1.0", delay: 0 },
  { text: "═══════════════════════════════════════", delay: 80 },
  { text: "", delay: 120 },
  { text: "Initializing kernel................ OK", delay: 200 },
  { text: "Loading agent registry............. OK", delay: 350 },
  { text: "Connecting to Supabase Realtime..... OK", delay: 550 },
  { text: "Mounting project quadrants......... OK", delay: 700 },
  { text: "Scanning 12 buildings.............. OK", delay: 820 },
  { text: "Starting event stream.............. OK", delay: 950 },
  { text: "", delay: 1000 },
  { text: "All systems nominal. Terminal ready.", delay: 1100 },
];

export function BootSequence({ theme, onComplete }: BootSequenceProps) {
  const [visibleLines, setVisibleLines] = useState(0);

  const completeFired = useRef(false);

  const advanceLine = useCallback(() => {
    setVisibleLines((prev) => prev + 1);
  }, []);

  // Fire onComplete once all lines are visible
  useEffect(() => {
    if (visibleLines >= BOOT_LINES.length && !completeFired.current) {
      completeFired.current = true;
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [visibleLines, onComplete]);

  useEffect(() => {
    const timers = BOOT_LINES.map((line) =>
      setTimeout(() => advanceLine(), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [advanceLine]);

  return (
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ backgroundColor: theme.bg }}
    >
      <div className="font-mono text-[16px] leading-relaxed max-w-lg px-8">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} style={{ color: i === 0 ? theme.primary : line.text.includes("OK") ? "#00ff41" : theme.secondary }}>
            {line.text || "\u00A0"}
          </div>
        ))}
        {visibleLines < BOOT_LINES.length && (
          <span
            className="inline-block w-[8px] h-[15px]"
            style={{ backgroundColor: theme.primary, animation: "crt-cursor 1s step-end infinite" }}
          />
        )}
      </div>
    </div>
  );
}
