// ─── TERMINAL CONSTANTS ─────────────────────────────────────────────────────

// Terminal color themes (user can toggle)
export const TERMINAL_THEMES = {
  green: {
    primary: "#00ff41",
    secondary: "#00cc33",
    dim: "#005f15",
    bg: "#0a0a0a",
    scanline: "rgba(0,255,65,0.03)",
  },
  amber: {
    primary: "#ffb000",
    secondary: "#cc8e00",
    dim: "#664700",
    bg: "#0a0a0a",
    scanline: "rgba(255,176,0,0.03)",
  },
  cyan: {
    primary: "#00e5ff",
    secondary: "#00b8cc",
    dim: "#005c66",
    bg: "#0a0a0a",
    scanline: "rgba(0,229,255,0.03)",
  },
} as const;

export type TerminalThemeName = keyof typeof TERMINAL_THEMES;

// ASCII building art — 3 sizes based on building.size
// Large (size >= 2.5): 7 lines tall
// Medium (size >= 1.75): 5 lines tall
// Small (size < 1.75): 3 lines tall
// Use simple box/tower ASCII art with the building shortName inside
export const ASCII_BUILDINGS: Record<"large" | "medium" | "small", string[]> = {
  large: [
    "  ┌─────────┐  ",
    "  │ ▓▓▓▓▓▓▓ │  ",
    "  │ ▓ {id} ▓ │  ",
    "  │ ▓▓▓▓▓▓▓ │  ",
    "  ├─────────┤  ",
    "  │ ░░░░░░░ │  ",
    "  └─────────┘  ",
  ],
  medium: [
    "  ┌───────┐  ",
    "  │ ▓▓▓▓▓ │  ",
    "  │ {id}  │  ",
    "  │ ▓▓▓▓▓ │  ",
    "  └───────┘  ",
  ],
  small: [
    "  ┌─────┐  ",
    "  │{id} │  ",
    "  └─────┘  ",
  ],
};

// Status indicators for terminal
export const STATUS_CHARS = {
  active: "●",
  idle: "○",
  warning: "▲",
  error: "✖",
} as const;

// Data flow arrows
export const FLOW_CHARS = {
  right: "→",
  left: "←",
  up: "↑",
  down: "↓",
  bidirectional: "↔",
} as const;

// Worker type terminal icons (single char)
export const WORKER_ICONS: Record<string, string> = {
  builder: "⚒",
  inspector: "⊕",
  miner: "⛏",
  scout: "⚡",
  deployer: "▶",
  messenger: "✉",
  browser: "◎",
  supervisor: "★",
};
