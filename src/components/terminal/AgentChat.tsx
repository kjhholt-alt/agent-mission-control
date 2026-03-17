"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Worker, Building } from "../game3d/types";
import type { TERMINAL_THEMES } from "./terminal-constants";
import { WORKER_ICONS } from "./terminal-constants";
import { WORKER_TYPE_CONFIG } from "../game3d/constants";

interface AgentChatProps {
  workers: Worker[];
  buildings: Building[];
  theme: (typeof TERMINAL_THEMES)[keyof typeof TERMINAL_THEMES];
}

interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  direction: "out" | "in"; // out = user→agent, in = agent→user
  text: string;
  timestamp: string;
}

// Simulated agent responses based on their type and status
function generateResponse(agent: Worker, prompt: string, buildings: Building[]): string {
  const building = buildings.find(b => b.id === agent.currentBuildingId);
  const loc = building?.shortName || "???";

  if (agent.status === "idle") {
    const idleResponses = [
      `Standing by at ${loc}. Ready for assignment.`,
      `Idle at ${loc}. What do you need?`,
      `Awaiting orders at ${loc}. Send it.`,
    ];
    return idleResponses[Math.floor(Math.random() * idleResponses.length)];
  }

  if (agent.status === "moving") {
    const target = buildings.find(b => b.id === agent.targetBuildingId);
    return `In transit to ${target?.shortName || "???"}. ETA ~${Math.floor(Math.random() * 30) + 5}s. Will report on arrival.`;
  }

  // Working agent — respond contextually
  const lower = prompt.toLowerCase();

  if (lower.includes("status") || lower.includes("report")) {
    return `Working on "${agent.task}" at ${loc}. Progress: ${agent.progress}%. On track.`;
  }
  if (lower.includes("eta") || lower.includes("done") || lower.includes("finish")) {
    const remaining = 100 - agent.progress;
    const eta = Math.ceil(remaining * 0.6);
    return `Estimated ${eta}s remaining. Currently at ${agent.progress}%.`;
  }
  if (lower.includes("help") || lower.includes("stuck")) {
    return `Running nominal at ${loc}. No blockers. Task: "${agent.task}"`;
  }
  if (lower.includes("stop") || lower.includes("abort") || lower.includes("cancel")) {
    return `Acknowledged. Wrapping up current step before halting. Stand by.`;
  }

  const workingResponses = [
    `Copy. ${agent.progress}% through "${agent.task}" at ${loc}.`,
    `Roger. Processing at ${loc}. Will ping on completion.`,
    `Acknowledged. Task in progress — ${agent.progress}% complete.`,
    `On it. Working ${loc}, progress ${agent.progress}%.`,
  ];
  return workingResponses[Math.floor(Math.random() * workingResponses.length)];
}

export function AgentChat({ workers, buildings, theme }: AgentChatProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agent = selectedAgent ? workers.find(w => w.id === selectedAgent) : null;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input when agent selected
  useEffect(() => {
    if (selectedAgent) {
      inputRef.current?.focus();
    }
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
    setInput("");
    setIsTyping(true);

    // Simulate agent "thinking" delay
    const delay = 400 + Math.random() * 800;
    setTimeout(() => {
      const response = generateResponse(agent, userMsg.text, buildings);
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
    }, delay);
  }, [input, agent, buildings]);

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
          {workers.map(w => {
            const icon = WORKER_ICONS[w.type] || "?";
            const color = WORKER_TYPE_CONFIG[w.type]?.color || theme.primary;
            const statusColor = w.status === "working" ? "#00ff41" : w.status === "moving" ? "#ffb000" : theme.dim;
            const building = buildings.find(b => b.id === w.currentBuildingId);
            const msgCount = messages.filter(m => m.agentId === w.id).length;

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
                  {w.status === "working" ? "ONLINE" : w.status === "moving" ? "TRANSIT" : "STANDBY"}
                </span>
                <span style={{ color: theme.dim, fontSize: 11 }}>@ {building?.shortName || "???"}</span>
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
          {agent?.status === "working" ? `${agent.progress}%` : agent?.status?.toUpperCase()}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto terminal-scroll px-3 py-1.5">
        {agentMessages.length === 0 && !isTyping && (
          <div className="text-center py-4" style={{ color: theme.dim, fontFamily: "monospace", fontSize: 12 }}>
            Send a message to {agent?.name}
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
            <div
              className="pl-3 text-[13px] leading-relaxed"
              style={{ color: msg.direction === "out" ? theme.secondary : theme.primary }}
            >
              {msg.direction === "out" ? "▸ " : "◂ "}{msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="mb-1.5" style={{ fontFamily: "monospace" }}>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
              <span style={{ color: agentColor, fontWeight: 700 }}>
                {agent?.name?.toUpperCase()}
              </span>
            </div>
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
