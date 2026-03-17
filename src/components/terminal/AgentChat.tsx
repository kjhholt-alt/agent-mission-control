"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Worker, Building } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { WORKER_ICONS } from "./terminal-constants";
import { WORKER_TYPE_CONFIG } from "../game3d/constants";
import type { SessionInfo, HookEvent } from "../game3d/useGameData";
import { supabase } from "@/lib/supabase";

interface AgentChatProps {
  workers: Worker[];
  buildings: Building[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
  sessions: SessionInfo[];
  hookEvents: HookEvent[];
}

interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  direction: "out" | "in";
  text: string;
  timestamp: string;
}

/** Build a real response using session + hook event data */
function generateLiveResponse(
  agent: Worker,
  prompt: string,
  buildings: Building[],
  sessions: SessionInfo[],
  hookEvents: HookEvent[],
): string {
  const building = buildings.find(b => b.id === agent.currentBuildingId);
  const loc = building?.shortName || "???";
  const lower = prompt.toLowerCase();

  // Find matching session for this agent (if it's a session-based worker)
  const sessionId = agent.id.startsWith("session-") ? agent.id.replace("session-", "") : null;
  const session = sessionId ? sessions.find(s => s.session_id === sessionId) : null;

  // Find recent hook events for this agent's session
  const agentEvents = sessionId
    ? hookEvents.filter(e => e.session_id === sessionId).slice(0, 10)
    : [];

  // If we have a real session, give real data
  if (session) {
    if (lower.includes("status") || lower.includes("report") || lower.includes("what")) {
      const cost = Number(session.cost_usd).toFixed(2);
      const lines = [
        `Session ${session.status.toUpperCase()} at ${loc}`,
        `Model: ${session.model || "unknown"}`,
        `Tools used: ${session.tool_count}`,
        `Cost: $${cost}`,
        session.current_tool ? `Current tool: ${session.current_tool}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    }

    if (lower.includes("recent") || lower.includes("history") || lower.includes("last")) {
      if (agentEvents.length === 0) return "No recent tool activity in this session.";
      const lines = agentEvents.slice(0, 5).map(e => {
        const time = new Date(e.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
        return `${time} ${e.event_type}: ${e.tool_name || "—"}`;
      });
      return lines.join("\n");
    }

    if (lower.includes("cost") || lower.includes("spend") || lower.includes("budget")) {
      return `Session spend: $${Number(session.cost_usd).toFixed(2)} across ${session.tool_count} tool calls.`;
    }

    if (lower.includes("stop") || lower.includes("abort") || lower.includes("cancel")) {
      return `Cannot stop sessions from here. Use Claude Code directly to end this session.`;
    }

    // Default session response
    return `Active on ${session.project_name || "unknown"}, ${session.tool_count} tools used. Currently ${session.current_tool ? `running ${session.current_tool}` : "idle"}.`;
  }

  // Non-session worker — use worker data
  if (agent.status === "idle") {
    return `Standing by at ${loc}. ${agent.task}`;
  }

  if (agent.status === "moving") {
    const target = buildings.find(b => b.id === agent.targetBuildingId);
    return `In transit to ${target?.shortName || "???"}. Task: ${agent.task}`;
  }

  if (lower.includes("status") || lower.includes("report")) {
    return `Working on "${agent.task}" at ${loc}. Progress: ${Math.round(agent.progress)}%.`;
  }

  return `${Math.round(agent.progress)}% through "${agent.task}" at ${loc}.`;
}

export function AgentChat({ workers, buildings, theme, sessions, hookEvents }: AgentChatProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agent = selectedAgent ? workers.find(w => w.id === selectedAgent) : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (selectedAgent) inputRef.current?.focus();
  }, [selectedAgent]);

  // Clean up reply timer on agent switch
  useEffect(() => {
    return () => {
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current);
        replyTimerRef.current = null;
      }
    };
  }, [selectedAgent]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !agent) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-out`,
      agentId: agent.id,
      agentName: agent.name,
      direction: "out",
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };

    setMessages(prev => [...prev, userMsg]);
    const promptText = input.trim();
    setInput("");
    setIsTyping(true);

    // Check if this is a task spawn command
    const lower = promptText.toLowerCase();
    const isSpawn = lower.startsWith("spawn:") || lower.startsWith("task:") || lower.startsWith("do:");

    if (isSpawn) {
      const taskDesc = promptText.slice(promptText.indexOf(":") + 1).trim();
      const building = buildings.find(b => b.id === agent.currentBuildingId);
      // Write task to Supabase
      supabase.from("swarm_tasks").insert({
        title: taskDesc,
        project: building?.id || "command-center",
        status: "queued",
        priority: "medium",
        created_at: new Date().toISOString(),
      }).then(({ error }) => {
        const response = error
          ? `Failed to queue task: ${error.message}`
          : `Task queued: "${taskDesc}" at ${building?.shortName || "CMD"}. Awaiting execution.`;
        const agentMsg: ChatMessage = {
          id: `msg-${Date.now()}-in`,
          agentId: agent.id,
          agentName: agent.name,
          direction: "in",
          text: response,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        };
        setMessages(prev => [...prev, agentMsg]);
        setIsTyping(false);
      });
      return;
    }

    // Normal message — generate response from real data
    const delay = 200 + Math.random() * 400;
    replyTimerRef.current = setTimeout(() => {
      const response = generateLiveResponse(agent, promptText, buildings, sessions, hookEvents);
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now()}-in`,
        agentId: agent.id,
        agentName: agent.name,
        direction: "in",
        text: response,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setMessages(prev => [...prev, agentMsg]);
      setIsTyping(false);
      replyTimerRef.current = null;
    }, delay);
  }, [input, agent, buildings, sessions, hookEvents]);

  const agentMessages = messages.filter(m => m.agentId === selectedAgent);

  // Agent picker view
  if (!selectedAgent) {
    return (
      <div className="terminal-quadrant flex flex-col h-full">
        <div
          className="flex items-center gap-2 px-3 py-1 border-b shrink-0"
          style={{ borderColor: theme.dim, fontFamily: "monospace", fontSize: 13 }}
        >
          <span style={{ color: theme.primary, fontWeight: 700, letterSpacing: "0.15em" }}>
            ◆ AGENT CHAT
          </span>
          <span className="ml-auto text-[12px]" style={{ color: theme.dim }}>
            Select an agent
          </span>
        </div>
        <div className="flex-1 overflow-y-auto terminal-scroll px-2 py-1">
          {workers.length === 0 && (
            <div className="text-center py-4" style={{ color: theme.dim, fontFamily: "monospace", fontSize: 12 }}>
              No agents online — start a Claude Code session
            </div>
          )}
          {workers.map(w => {
            const icon = WORKER_ICONS[w.type] || "?";
            const color = WORKER_TYPE_CONFIG[w.type]?.color || theme.primary;
            const statusColor = w.status === "working" ? "#00ff41" : w.status === "moving" ? "#ffb000" : theme.dim;
            const building = buildings.find(b => b.id === w.currentBuildingId);
            const msgCount = messages.filter(m => m.agentId === w.id).length;

            // Check if this is a live session worker
            const sessionId = w.id.startsWith("session-") ? w.id.replace("session-", "") : null;
            const session = sessionId ? sessions.find(s => s.session_id === sessionId) : null;

            return (
              <div
                key={w.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-sm hover:bg-white/[0.04] cursor-pointer transition-colors"
                style={{ fontFamily: "monospace" }}
                onClick={() => setSelectedAgent(w.id)}
              >
                <span style={{ color, fontSize: 14 }}>{icon}</span>
                <span style={{ color: theme.primary, fontWeight: 700, fontSize: 13 }}>{w.name}</span>
                <span style={{ color: statusColor, fontSize: 11, fontWeight: 700 }}>
                  {session ? "LIVE" : w.status === "working" ? "ONLINE" : w.status === "moving" ? "TRANSIT" : "STANDBY"}
                </span>
                <span style={{ color: theme.dim, fontSize: 11 }}>@ {building?.shortName || "???"}</span>
                {session && (
                  <span style={{ color: theme.dim, fontSize: 10 }}>${Number(session.cost_usd).toFixed(1)}</span>
                )}
                {msgCount > 0 && (
                  <span className="ml-auto text-[11px]" style={{ color: theme.secondary }}>
                    {msgCount} msg{msgCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Chat view
  const agentColor = WORKER_TYPE_CONFIG[agent?.type || "builder"]?.color || theme.primary;
  const agentIcon = WORKER_ICONS[agent?.type || "builder"] || "?";

  return (
    <div className="terminal-quadrant flex flex-col h-full">
      {/* Chat header */}
      <div
        className="flex items-center gap-2 px-3 py-1 border-b shrink-0"
        style={{ borderColor: theme.dim, fontFamily: "monospace", fontSize: 13 }}
      >
        <button
          onClick={() => setSelectedAgent(null)}
          className="cursor-pointer hover:opacity-80"
          style={{ color: theme.dim, fontSize: 14 }}
        >
          ◂
        </button>
        <span style={{ color: agentColor, fontSize: 14 }}>{agentIcon}</span>
        <span style={{ color: theme.primary, fontWeight: 700, letterSpacing: "0.1em" }}>
          {agent?.name || "???"}
        </span>
        <span style={{ color: theme.dim, fontSize: 11 }}>
          LVL {agent?.level || 0}
        </span>
        <span className="ml-auto text-[11px]" style={{ color: theme.dim }}>
          {agent?.status === "working" ? `${Math.round(agent.progress)}%` : agent?.status?.toUpperCase()}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto terminal-scroll px-3 py-1.5">
        {agentMessages.length === 0 && !isTyping && (
          <div style={{ color: theme.dim, fontFamily: "monospace", fontSize: 12 }}>
            <div className="py-2">Send a message to {agent?.name}.</div>
            <div className="text-[11px] space-y-0.5" style={{ color: theme.dim }}>
              <div>Try: <span style={{ color: theme.secondary }}>status</span> — agent report</div>
              <div>Try: <span style={{ color: theme.secondary }}>recent</span> — last tool calls</div>
              <div>Try: <span style={{ color: theme.secondary }}>cost</span> — session spend</div>
              <div>Try: <span style={{ color: theme.secondary }}>task: fix bug</span> — queue a task</div>
            </div>
          </div>
        )}
        {agentMessages.map(msg => (
          <div key={msg.id} className="mb-1.5" style={{ fontFamily: "monospace" }}>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
              <span style={{ color: theme.dim }}>{msg.timestamp}</span>
              <span style={{ color: msg.direction === "out" ? theme.secondary : agentColor, fontWeight: 700 }}>
                {msg.direction === "out" ? "YOU" : msg.agentName.toUpperCase()}
              </span>
            </div>
            <pre
              className="pl-3 text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{ color: msg.direction === "out" ? theme.secondary : theme.primary }}
            >
              {msg.direction === "out" ? "▸ " : "◂ "}{msg.text}
            </pre>
          </div>
        ))}
        {isTyping && (
          <div className="mb-1.5" style={{ fontFamily: "monospace" }}>
            <div className="pl-3 text-[13px]" style={{ color: theme.dim }}>
              <span style={{ animation: "crt-transit-pulse 1.2s ease-in-out infinite" }}>
                typing...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0"
        style={{ borderColor: theme.dim }}
      >
        <span style={{ color: agentColor }}>▸</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
            if (e.key === "Escape") setSelectedAgent(null);
          }}
          placeholder="Message agent..."
          className="flex-1 bg-transparent outline-none text-[13px] font-mono placeholder:opacity-30"
          style={{ color: theme.primary }}
          spellCheck={false}
          disabled={isTyping}
        />
      </div>
    </div>
  );
}
