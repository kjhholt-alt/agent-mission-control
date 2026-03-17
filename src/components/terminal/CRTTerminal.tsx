"use client";
import { type ReactNode } from "react";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface CRTTerminalProps {
  children: ReactNode;
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

export function CRTTerminal({ children, theme }: CRTTerminalProps) {
  return (
    <div
      className="crt-shell relative w-full h-full overflow-hidden"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Scanline overlay */}
      <div className="crt-scanlines pointer-events-none absolute inset-0 z-50"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${theme.scanline} 2px, ${theme.scanline} 4px)`
        }}
      />

      {/* Vignette overlay */}
      <div className="crt-vignette pointer-events-none absolute inset-0 z-40" />

      {/* Screen content */}
      <div className="crt-screen relative z-10 w-full h-full">
        {children}
      </div>

      {/* Subtle noise texture */}
      <div className="crt-noise pointer-events-none absolute inset-0 z-30 opacity-[0.015]" />
    </div>
  );
}
