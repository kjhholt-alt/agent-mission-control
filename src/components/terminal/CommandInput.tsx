"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Building, Worker } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { WORKER_ICONS } from "./terminal-constants";

interface CommandInputProps {
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  buildings: Building[];
  workers: Worker[];
  onCommand?: (cmd: string) => void;
}

interface HistoryEntry {
  input: string;
  output: string;
  type: "success" | "error" | "info";
}

const COMMANDS: Record<string, string> = {
  help: "Show available commands",
  status: "System status overview",
  agents: "List all agents and their current tasks",
  projects: "List all projects with status",
  inspect: "inspect <CODE> — Open detail view for a project (e.g. inspect CMD)",
  spawn: "spawn <CODE> <task> — Queue a task for a project",
  move: "move <AGENT> <CODE> — Reassign agent to a building",
  scan: "scan <CODE> — Quick scan of a project's vitals",
  focus: "focus <events|flows|agents|system> — Switch right panel tab",
  alert: "alert <message> — Broadcast a custom event",
  workers: "Show worker type legend with icons",
  theme: "Cycle terminal color theme (green → amber → cyan)",
  clear: "Clear command history",
  uptime: "Show session uptime",
  flows: "Show active data flows between projects",
  budget: "Show current API spend",
};

export function CommandInput({ theme, buildings, workers, onCommand }: CommandInputProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll and focus
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const execute = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (!trimmed) return;

    setCmdHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    let output = "";
    let type: HistoryEntry["type"] = "info";

    switch (trimmed) {
      case "help": {
        output = Object.entries(COMMANDS)
          .map(([k, v]) => `  ${k.padEnd(12)} ${v}`)
          .join("\n");
        break;
      }
      case "status": {
        const active = buildings.filter(b => b.status === "active").length;
        const working = workers.filter(w => w.status === "working").length;
        output = [
          `  PROJECTS:  ${active}/${buildings.length} active`,
          `  AGENTS:    ${working}/${workers.length} working`,
          `  BUILDINGS: ${buildings.map(b => b.shortName).join(", ")}`,
        ].join("\n");
        type = "success";
        break;
      }
      case "agents": {
        if (workers.length === 0) {
          output = "  No agents online";
          type = "error";
        } else {
          output = workers
            .map(w => {
              const icon = WORKER_ICONS[w.type] || "?";
              const status = w.status === "working" ? `WORKING ${w.progress}%` : w.status.toUpperCase();
              return `  ${icon} ${w.name.padEnd(14)} ${w.type.padEnd(12)} ${status}`;
            })
            .join("\n");
          type = "success";
        }
        break;
      }
      case "projects": {
        output = buildings
          .map(b => {
            const status = b.status === "active" ? "●" : b.status === "warning" ? "▲" : b.status === "error" ? "✖" : "○";
            return `  ${status} ${b.shortName.padEnd(5)} ${b.name.padEnd(28)} ${b.stats.uptime}`;
          })
          .join("\n");
        type = "success";
        break;
      }
      case "workers": {
        const workerTypes: [string, string, string][] = [
          ["builder",    WORKER_ICONS.builder,    "cyan"],
          ["inspector",  WORKER_ICONS.inspector,  "yellow"],
          ["miner",      WORKER_ICONS.miner,      "green"],
          ["scout",      WORKER_ICONS.scout,      "purple"],
          ["deployer",   WORKER_ICONS.deployer,   "orange"],
          ["messenger",  WORKER_ICONS.messenger,  "blue"],
          ["browser",    WORKER_ICONS.browser,    "sky"],
          ["supervisor", WORKER_ICONS.supervisor, "amber"],
        ];
        output = workerTypes
          .map(([name, icon, color]) => `  ${icon}  ${name.padEnd(12)} ${color}`)
          .join("\n");
        type = "success";
        break;
      }
      case "theme": {
        output = "  Theme cycled. Use [THEME] button in status bar or press Ctrl+T.";
        onCommand?.("theme");
        break;
      }
      case "clear": {
        setHistory([]);
        setInput("");
        return;
      }
      case "uptime": {
        output = `  Session started: ${new Date().toLocaleTimeString("en-US", { hour12: false })}`;
        break;
      }
      case "flows": {
        output = "  Active data flows shown in quadrant headers (throughput/s)";
        break;
      }
      case "budget": {
        output = "  Budget info displayed in status bar below";
        break;
      }
      default: {
        // inspect <shortname>
        if (trimmed.startsWith("inspect ")) {
          const code = trimmed.slice(8).trim().toUpperCase();
          const found = buildings.find(b => b.shortName.toUpperCase() === code);
          if (found) {
            output = `  Opening ${found.name}...`;
            type = "success";
            onCommand?.(`inspect:${found.id}`);
          } else {
            output = `  Unknown project code '${code}'. Use 'projects' to see codes.`;
            type = "error";
          }
          break;
        }
        // spawn <CODE> <task description>
        if (trimmed.startsWith("spawn ")) {
          const rest = trimmed.slice(6).trim();
          const spaceIdx = rest.indexOf(" ");
          if (spaceIdx === -1) {
            output = "  Usage: spawn <CODE> <task description>";
            type = "error";
            break;
          }
          const code = rest.slice(0, spaceIdx).toUpperCase();
          const task = cmd.trim().slice(6).trim().slice(spaceIdx + 1).trim();
          const found = buildings.find(b => b.shortName.toUpperCase() === code);
          if (!found) {
            output = `  Unknown project code '${code}'. Use 'projects' to see codes.`;
            type = "error";
            break;
          }
          if (!task) {
            output = "  Usage: spawn <CODE> <task description>";
            type = "error";
            break;
          }
          output = `  Spawning task on ${found.name}: "${task}"`;
          type = "success";
          onCommand?.(`spawn:${found.id}:${task}`);
          break;
        }
        // move <AGENT_NAME> <BUILDING_CODE>
        if (trimmed.startsWith("move ")) {
          const rest = trimmed.slice(5).trim();
          const spaceIdx = rest.lastIndexOf(" ");
          if (spaceIdx === -1) {
            output = "  Usage: move <AGENT_NAME> <CODE>";
            type = "error";
            break;
          }
          const agentName = rest.slice(0, spaceIdx).trim();
          const code = rest.slice(spaceIdx + 1).trim().toUpperCase();
          const agent = workers.find(w => w.name.toLowerCase() === agentName.toLowerCase());
          const target = buildings.find(b => b.shortName.toUpperCase() === code);
          if (!agent) {
            output = `  Unknown agent '${agentName}'. Use 'agents' to see roster.`;
            type = "error";
            break;
          }
          if (!target) {
            output = `  Unknown building '${code}'. Use 'projects' to see codes.`;
            type = "error";
            break;
          }
          const currentBuilding = buildings.find(b => b.id === agent.currentBuildingId);
          output = `  ${agent.name} → ${target.shortName} (from ${currentBuilding?.shortName || "???"})`;
          type = "success";
          onCommand?.(`move:${agent.id}:${target.id}`);
          break;
        }
        // scan <CODE>
        if (trimmed.startsWith("scan ")) {
          const code = trimmed.slice(5).trim().toUpperCase();
          const found = buildings.find(b => b.shortName.toUpperCase() === code);
          if (!found) {
            output = `  Unknown project '${code}'. Use 'projects' to see codes.`;
            type = "error";
            break;
          }
          const bWorkers = workers.filter(w => w.currentBuildingId === found.id);
          const statusIcon = found.status === "active" ? "●" : found.status === "warning" ? "▲" : found.status === "error" ? "✖" : "○";
          output = [
            `  ┌─ SCAN: ${found.shortName} ─────────────────`,
            `  │ ${statusIcon} ${found.name}`,
            `  │ Status:  ${found.status.toUpperCase()}`,
            `  │ Uptime:  ${found.stats.uptime}`,
            `  │ Tests:   ${found.stats.tests}`,
            `  │ Deploys: ${found.stats.deploys}`,
            `  │ Agents:  ${bWorkers.length > 0 ? bWorkers.map(w => w.name).join(", ") : "none"}`,
            `  │ ${found.description}`,
            `  └──────────────────────────────`,
          ].join("\n");
          type = "success";
          break;
        }
        // focus <tab>
        if (trimmed.startsWith("focus ")) {
          const tab = trimmed.slice(6).trim().toLowerCase();
          const validTabs = ["events", "flows", "agents", "system"];
          if (!validTabs.includes(tab)) {
            output = `  Unknown panel '${tab}'. Options: ${validTabs.join(", ")}`;
            type = "error";
            break;
          }
          output = `  Switched to ${tab.toUpperCase()} panel`;
          type = "success";
          onCommand?.(`focus:${tab}`);
          break;
        }
        // alert <message>
        if (trimmed.startsWith("alert ")) {
          const msg = cmd.trim().slice(6).trim();
          if (!msg) {
            output = "  Usage: alert <message>";
            type = "error";
            break;
          }
          output = `  Alert broadcast: "${msg}"`;
          type = "success";
          onCommand?.(`alert:${msg}`);
          break;
        }
        output = `  Unknown command: '${trimmed}'. Type 'help' for available commands.`;
        type = "error";
      }
    }

    setHistory(prev => [...prev, { input: trimmed, output, type }]);
    setInput("");
  }, [buildings, workers, onCommand]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      execute(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIndex = historyIndex === -1 ? cmdHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(cmdHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= cmdHistory.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(cmdHistory[newIndex]);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={() => inputRef.current?.focus()}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b text-[13px] font-bold tracking-[0.15em] uppercase shrink-0"
        style={{ borderColor: theme.dim, color: theme.secondary }}
      >
        <span style={{ color: theme.primary }}>▸</span>
        COMMAND
        <span className="ml-auto" style={{ color: theme.dim }}>
          type &apos;help&apos; for commands
        </span>
      </div>

      {/* History output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto terminal-scroll px-3 py-1 font-mono text-[14px]">
        {history.map((entry, i) => (
          <div key={i} className="mb-1">
            {/* Input line */}
            <div className="flex items-center gap-1">
              <span style={{ color: theme.primary }}>❯</span>
              <span style={{ color: theme.secondary }}>{entry.input}</span>
            </div>
            {/* Output */}
            <pre
              className="whitespace-pre-wrap text-[13px] leading-relaxed pl-3"
              style={{
                color: entry.type === "error" ? "#ff3333" : entry.type === "success" ? theme.primary : theme.dim,
              }}
            >
              {entry.output}
            </pre>
          </div>
        ))}
      </div>

      {/* Input line */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0"
        style={{ borderColor: theme.dim }}
      >
        <span style={{ color: theme.primary }}>❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-[14px] font-mono caret-transparent"
          style={{ color: theme.primary }}
          spellCheck={false}
          autoComplete="off"
        />
        <span
          className="inline-block w-[7px] h-[13px]"
          style={{ backgroundColor: theme.primary, animation: "crt-cursor 1s step-end infinite" }}
        />
      </div>
    </div>
  );
}
