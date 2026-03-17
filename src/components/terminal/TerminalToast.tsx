"use client";
import { useEffect } from "react";
import type { TERMINAL_THEMES } from "./terminal-constants";
import type { Toast } from "./useToasts";

interface TerminalToastProps {
  toasts: Toast[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  onDismiss: (id: string) => void;
}

const ACCENT_COLORS: Record<Toast["type"], string> = {
  success: "#00ff41",
  error: "#ff3333",
  warning: "#ffb000",
  info: "", // filled dynamically from theme.primary
};

const TYPE_ICONS: Record<Toast["type"], string> = {
  success: "\u2713",
  error: "\u2716",
  warning: "\u25B2",
  info: "\u25CF",
};

function ToastItem({
  toast,
  theme,
  onDismiss,
}: {
  toast: Toast;
  theme: TerminalToastProps["theme"];
  onDismiss: (id: string) => void;
}) {
  const accent =
    toast.type === "info" ? theme.primary : ACCENT_COLORS[toast.type];
  const truncated =
    toast.message.length > 50
      ? toast.message.slice(0, 50) + "\u2026"
      : toast.message;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "rgba(10,10,10,0.95)",
        border: `1px solid ${accent}`,
        borderRadius: 2,
        overflow: "hidden",
        marginBottom: 4,
        animation: "toast-slide-in 0.2s ease-out",
        maxWidth: 320,
        minWidth: 200,
      }}
    >
      {/* Left accent strip */}
      <div
        style={{
          width: 3,
          flexShrink: 0,
          background: accent,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Icon */}
        <span
          style={{
            color: accent,
            fontSize: 12,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {TYPE_ICONS[toast.type]}
        </span>

        {/* Message */}
        <span
          style={{
            color: theme.primary,
            fontSize: 13,
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
          }}
        >
          {truncated}
        </span>

        {/* Close button */}
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            background: "none",
            border: "none",
            color: theme.dim,
            cursor: "pointer",
            fontSize: 13,
            padding: "0 2px",
            lineHeight: 1,
            flexShrink: 0,
            fontFamily: "inherit",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = theme.primary;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = theme.dim;
          }}
          aria-label="Dismiss toast"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

export function TerminalToast({ toasts, theme, onDismiss }: TerminalToastProps) {
  return (
    <>
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          top: 44,
          right: 8,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
        }}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            theme={theme}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </>
  );
}
