"use client";
import type { Building, Worker } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";

interface QuickActionsProps {
  buildings: Building[];
  workers: Worker[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  onCommand: (cmd: string) => void;
}

interface ActionDef {
  label: string;
  icon: string;
  color: string;
  fire: (props: QuickActionsProps) => void;
}

function buildActions(theme: QuickActionsProps["theme"]): ActionDef[] {
  return [
    {
      label: "DEPLOY",
      icon: "▶",
      color: "#00ff41",
      fire: ({ onCommand }) =>
        onCommand("spawn:buildkit:Deploy latest changes"),
    },
    {
      label: "TEST",
      icon: "⊕",
      color: "#00e5ff",
      fire: ({ onCommand }) =>
        onCommand("spawn:command-center:Run full test suite"),
    },
    {
      label: "SCAN ALL",
      icon: "⚡",
      color: "#ffb000",
      fire: ({ buildings, onCommand }) => {
        const active = buildings.filter((b) => b.status === "active").length;
        const idle = buildings.filter((b) => b.status === "idle").length;
        onCommand(`alert:Scan complete — ${active} active, ${idle} idle`);
      },
    },
    {
      label: "BRIEF",
      icon: "✉",
      color: "#3b82f6",
      fire: ({ onCommand }) =>
        onCommand("spawn:finance-brief:Generate daily market briefing"),
    },
    {
      label: "STATUS",
      icon: "★",
      color: theme.primary,
      fire: ({ workers, buildings, onCommand }) => {
        const activeBuildings = buildings.filter(
          (b) => b.status === "active"
        ).length;
        onCommand(
          `alert:${workers.length} agents, ${activeBuildings} active buildings`
        );
      },
    },
    {
      label: "MINE",
      icon: "⛏",
      color: "#00ff41",
      fire: ({ onCommand }) =>
        onCommand("spawn:pc-bottleneck:Mine SEO keywords and affiliate data"),
    },
  ];
}

export function QuickActions({
  buildings,
  workers,
  theme,
  onCommand,
}: QuickActionsProps) {
  const actions = buildActions(theme);

  return (
    <div
      className="terminal-quadrant"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        overflowX: "auto",
        overflowY: "hidden",
        whiteSpace: "nowrap",
        padding: "0 8px",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          color: theme.dim,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginRight: 4,
          flexShrink: 0,
        }}
      >
        QUICK OPS
      </span>

      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() =>
            action.fire({ buildings, workers, theme, onCommand })
          }
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: action.color,
            background: "transparent",
            border: `1px solid ${action.color}4d`,
            padding: "2px 8px",
            borderRadius: 2,
            cursor: "pointer",
            flexShrink: 0,
            lineHeight: "18px",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = `${action.color}1a`;
            el.style.borderColor = action.color;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.borderColor = `${action.color}4d`;
          }}
        >
          {action.icon} {action.label}
        </button>
      ))}
    </div>
  );
}
