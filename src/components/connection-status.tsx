"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useRealtimeConnection } from "@/lib/use-realtime-connection";
import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const { status, lastUpdate, reconnectAttempt } = useRealtimeConnection();
  const [showTooltip, setShowTooltip] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  // Pulse animation when data updates
  useEffect(() => {
    if (lastUpdate) {
      setPulseKey((k) => k + 1);
    }
  }, [lastUpdate]);

  const isConnected = status === "connected";
  const isReconnecting = status === "reconnecting";

  const statusText = isConnected
    ? "Connected"
    : isReconnecting
      ? `Reconnecting (${reconnectAttempt})...`
      : "Disconnected";

  const Icon = isConnected ? Wifi : isReconnecting ? Loader2 : WifiOff;

  // Use explicit color classes for proper Tailwind compilation
  const iconColor = isConnected
    ? "text-emerald-400"
    : isReconnecting
      ? "text-amber-400"
      : "text-red-400";

  const dotColor = isConnected
    ? "bg-emerald-400"
    : isReconnecting
      ? "bg-amber-400"
      : "bg-red-400";

  const textColor = isConnected
    ? "text-emerald-400"
    : isReconnecting
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
        <div className="relative">
          <Icon
            className={`w-3 h-3 ${iconColor} ${isReconnecting ? "animate-spin" : ""}`}
          />
          {isConnected && (
            <AnimatePresence>
              <motion.div
                key={pulseKey}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className={`absolute inset-0 rounded-full ${dotColor}`}
              />
            </AnimatePresence>
          )}
        </div>
        <div className="relative w-2 h-2">
          {isConnected && (
            <span
              className={`absolute inset-0 rounded-full ${dotColor} animate-ping opacity-75`}
            />
          )}
          <span
            className={`relative block w-2 h-2 rounded-full ${dotColor}`}
          />
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full right-0 mt-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[200] min-w-[200px]"
          >
            <p className={`text-xs font-medium ${textColor} mb-1`}>
              {statusText}
            </p>
            {lastUpdate && (
              <p className="text-[10px] text-zinc-500">
                Last update:{" "}
                {new Date(lastUpdate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
            {isReconnecting && (
              <p className="text-[10px] text-amber-500 mt-1">
                Attempting to reconnect...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
