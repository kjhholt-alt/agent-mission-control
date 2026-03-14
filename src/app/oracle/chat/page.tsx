"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "oracle";
  content: string;
  actions_taken?: Array<{ action: string; result: unknown; success: boolean }>;
  created_at?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GOLD = "#e8a019";
const GOLD_DIM = "#b87a0d";
const GOLD_GLOW = "rgba(232, 160, 25, 0.15)";
const BG = "#0a0a0f";
const CARD_BG = "#111118";
const CARD_BORDER = "#1a1a2e";

// ── Oracle Eye Icon ──────────────────────────────────────────────────────────

function OracleEye({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${GOLD} 0%, ${GOLD_DIM} 70%, transparent 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 20px ${GOLD}50, 0 0 40px ${GOLD}20`,
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0a0a0f"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </div>
  );
}

// ── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
      <OracleEye size={28} />
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${GOLD_DIM}30`,
          borderRadius: "12px",
          borderTopLeftRadius: "4px",
          padding: "12px 16px",
          display: "flex",
          gap: "4px",
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: GOLD_DIM,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Action Badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: { action: string; result: unknown; success: boolean } }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: action.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
        border: `1px solid ${action.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "10px",
        color: action.success ? "#10b981" : "#ef4444",
        fontFamily: "'JetBrains Mono', monospace",
        marginTop: "6px",
        marginRight: "4px",
      }}
    >
      <span>{action.success ? "\u2713" : "\u2717"}</span>
      <span>{action.action.replace(/_/g, " ")}</span>
    </div>
  );
}

// ── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isOracle = message.role === "oracle";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      style={{
        display: "flex",
        justifyContent: isOracle ? "flex-start" : "flex-end",
        gap: "10px",
        marginBottom: "16px",
        alignItems: "flex-start",
      }}
    >
      {isOracle && <OracleEye size={28} />}
      <div style={{ maxWidth: "75%", minWidth: "60px" }}>
        <div
          style={{
            background: isOracle ? CARD_BG : "rgba(255, 255, 255, 0.08)",
            border: isOracle ? `1px solid ${GOLD_DIM}30` : "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "12px",
            borderTopLeftRadius: isOracle ? "4px" : "12px",
            borderTopRightRadius: isOracle ? "12px" : "4px",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              lineHeight: "1.6",
              color: isOracle ? "#d4d4d4" : "#f0f0f0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message.content}
          </div>
        </div>
        {/* Action badges */}
        {message.actions_taken && message.actions_taken.length > 0 && (
          <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap" }}>
            {message.actions_taken.map((a, i) => (
              <ActionBadge key={i} action={a} />
            ))}
          </div>
        )}
        {/* Timestamp */}
        {message.created_at && (
          <div
            style={{
              fontSize: "9px",
              color: "#444",
              marginTop: "4px",
              textAlign: isOracle ? "left" : "right",
              paddingLeft: isOracle ? "4px" : undefined,
              paddingRight: !isOracle ? "4px" : undefined,
            }}
          >
            {new Date(message.created_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Suggested Prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What's the budget looking like?",
  "What did the Hive accomplish today?",
  "Show me the top prospects",
  "Approve all pending decisions",
  "How many workers are active?",
  "Deploy a swarm to improve the PL Engine",
];

// ── Main Chat Page ───────────────────────────────────────────────────────────

export default function OracleChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/oracle/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      if (!conversationId) {
        setConversationId(data.conversation_id);
      }

      const oracleMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "oracle",
        content: data.response,
        actions_taken: data.actions,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, oracleMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "oracle",
        content: `I encountered an issue: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div
      style={{
        background: BG,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#e0e0e0",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: `1px solid ${CARD_BORDER}`,
          background: "rgba(17, 17, 24, 0.8)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a
            href="/oracle"
            style={{
              color: "#555",
              textDecoration: "none",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </a>
          <OracleEye size={32} />
          <div>
            <h1
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: GOLD,
                margin: 0,
                textShadow: `0 0 15px ${GOLD}30`,
              }}
            >
              ORACLE
            </h1>
            <div style={{ fontSize: "9px", color: "#555" }}>
              Hive AI Assistant
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={startNewConversation}
            style={{
              background: "transparent",
              border: `1px solid ${CARD_BORDER}`,
              color: "#666",
              padding: "5px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "10px",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = GOLD_DIM;
              e.currentTarget.style.color = GOLD_DIM;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = CARD_BORDER;
              e.currentTarget.style.color = "#666";
            }}
          >
            New Chat
          </button>
          <a
            href="/oracle"
            style={{
              background: "transparent",
              border: `1px solid ${CARD_BORDER}`,
              color: "#666",
              padding: "5px 12px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "10px",
              fontFamily: "'JetBrains Mono', monospace",
              display: "flex",
              alignItems: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = GOLD_DIM;
              e.currentTarget.style.color = GOLD_DIM;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = CARD_BORDER;
              e.currentTarget.style.color = "#666";
            }}
          >
            Dashboard
          </a>
        </div>
      </motion.div>

      {/* ── Messages Area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: "400px",
              gap: "24px",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <OracleEye size={64} />
            </motion.div>
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontSize: "20px",
                  color: GOLD,
                  marginBottom: "8px",
                  textShadow: `0 0 20px ${GOLD}30`,
                }}
              >
                Oracle is ready
              </h2>
              <p style={{ fontSize: "12px", color: "#555", maxWidth: "400px", lineHeight: "1.6" }}>
                I have full visibility into the Hive — workers, tasks, budget, prospects. Ask me anything or tell me to take action.
              </p>
            </div>
            {/* Suggestion chips */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "center",
                maxWidth: "600px",
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    background: GOLD_GLOW,
                    border: `1px solid ${GOLD_DIM}25`,
                    color: GOLD_DIM,
                    padding: "6px 14px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${GOLD_DIM}60`;
                    e.currentTarget.style.background = `${GOLD}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${GOLD_DIM}25`;
                    e.currentTarget.style.background = GOLD_GLOW;
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: "12px 20px 16px",
          borderTop: `1px solid ${CARD_BORDER}`,
          background: "rgba(17, 17, 24, 0.9)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Oracle..."
            rows={1}
            style={{
              flex: 1,
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "12px",
              padding: "12px 16px",
              color: "#e0e0e0",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
              resize: "none",
              outline: "none",
              lineHeight: "1.5",
              maxHeight: "120px",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = `${GOLD_DIM}50`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = CARD_BORDER;
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? `${GOLD}20` : `linear-gradient(135deg, ${GOLD}, ${GOLD_DIM})`,
              border: "none",
              borderRadius: "12px",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
              transition: "all 0.2s",
              boxShadow: loading || !input.trim() ? "none" : `0 0 15px ${GOLD}30`,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={loading || !input.trim() ? "#555" : "#0a0a0f"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div
          style={{
            maxWidth: "900px",
            margin: "6px auto 0",
            fontSize: "9px",
            color: "#333",
            textAlign: "center",
          }}
        >
          Oracle sees all Hive data in real-time. Shift+Enter for new line.
        </div>
      </motion.div>
    </div>
  );
}
