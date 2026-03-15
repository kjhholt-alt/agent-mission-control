"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Rocket,
  LayoutDashboard,
  Factory,
  Eye,
  Terminal,
  Clock,
  FileText,
  Zap,
  Upload,
  Settings,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  category: "navigate" | "action";
  action: () => void;
}

interface CommandBarProps {
  onSpawn: () => void;
  onRefresh?: () => void;
}

export function CommandBar({ onSpawn, onRefresh }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: "spawn",
      label: "New Mission",
      shortcut: "N",
      icon: <Rocket className="w-4 h-4" />,
      category: "action",
      action: () => {
        setOpen(false);
        onSpawn();
      },
    },
    {
      id: "dashboard",
      label: "Dashboard",
      shortcut: "1",
      icon: <LayoutDashboard className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/";
      },
    },
    {
      id: "ops",
      label: "Operations Center",
      shortcut: "2",
      icon: <Zap className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/ops";
      },
    },
    {
      id: "factory",
      label: "3D Factory",
      shortcut: "3",
      icon: <Factory className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/game";
      },
    },
    {
      id: "oracle",
      label: "Oracle",
      shortcut: "4",
      icon: <Eye className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/oracle";
      },
    },
    {
      id: "sessions",
      label: "Session History",
      shortcut: "5",
      icon: <Clock className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/sessions";
      },
    },
    {
      id: "templates",
      label: "Mission Templates",
      shortcut: "6",
      icon: <FileText className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/templates";
      },
    },
    {
      id: "terminal",
      label: "Mobile Terminal",
      icon: <Terminal className="w-4 h-4" />,
      category: "navigate",
      action: () => {
        window.location.href = "/mobile";
      },
    },
    {
      id: "deploy",
      label: "Quick Deploy...",
      icon: <Upload className="w-4 h-4" />,
      category: "action",
      action: () => {
        setOpen(false);
        // Will be enhanced with project picker
      },
    },
    {
      id: "refresh",
      label: "Refresh Data",
      shortcut: "R",
      icon: <Settings className="w-4 h-4" />,
      category: "action",
      action: () => {
        setOpen(false);
        onRefresh?.();
      },
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+K to toggle
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
        return;
      }

      if (!open) return;

      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    },
    [open, filtered, selectedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={() => setOpen(false)}
          />

          {/* Command palette */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[201]"
          >
            <div className="bg-[#0f0f18] border border-cyan-500/20 rounded-xl shadow-2xl shadow-cyan-500/5 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Search className="w-4 h-4 text-cyan-400/60" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
                />
                <kbd className="text-[10px] text-zinc-600 px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-zinc-600 text-sm">
                    No matching commands
                  </div>
                ) : (
                  filtered.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === selectedIndex
                          ? "bg-cyan-500/10 text-cyan-400"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={
                          i === selectedIndex
                            ? "text-cyan-400"
                            : "text-zinc-600"
                        }
                      >
                        {cmd.icon}
                      </span>
                      <span className="flex-1 text-sm">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="text-[10px] text-zinc-600 px-1.5 py-0.5 bg-zinc-800/80 rounded border border-zinc-700/50">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      <span className="text-[9px] uppercase tracking-wider text-zinc-700">
                        {cmd.category}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px] text-zinc-700">
                <span>
                  <kbd className="px-1 bg-zinc-800 rounded">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="px-1 bg-zinc-800 rounded">↵</kbd> select
                </span>
                <span>
                  <kbd className="px-1 bg-zinc-800 rounded">esc</kbd> close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
