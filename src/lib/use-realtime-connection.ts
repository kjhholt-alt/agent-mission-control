"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface ConnectionState {
  status: "connected" | "disconnected" | "connecting" | "reconnecting";
  lastUpdate: Date | null;
  reconnectAttempt: number;
  channels: Set<string>;
}

const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
const BASE_RECONNECT_DELAY = 1000; // 1 second base

let globalState: ConnectionState = {
  status: "disconnected",
  lastUpdate: null,
  reconnectAttempt: 0,
  channels: new Set(),
};

const listeners = new Set<(state: ConnectionState) => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener({ ...globalState }));
}

function updateConnectionState(updates: Partial<ConnectionState>) {
  globalState = { ...globalState, ...updates };
  notifyListeners();
}

export function useRealtimeConnection() {
  const [state, setState] = useState<ConnectionState>(globalState);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const healthCheckChannel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, globalState.reconnectAttempt),
      MAX_RECONNECT_DELAY
    );

    updateConnectionState({
      status: "reconnecting",
      reconnectAttempt: globalState.reconnectAttempt + 1,
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      // Remove old health check channel
      if (healthCheckChannel.current) {
        supabase.removeChannel(healthCheckChannel.current);
      }

      // Create new health check channel
      const channel = supabase
        .channel("nexus_health_check")
        .on("presence", { event: "sync" }, () => {
          // Connection successful
          updateConnectionState({
            status: "connected",
            lastUpdate: new Date(),
            reconnectAttempt: 0,
          });
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            updateConnectionState({
              status: "connected",
              lastUpdate: new Date(),
              reconnectAttempt: 0,
            });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            updateConnectionState({ status: "disconnected" });
            // Retry
            if (globalState.reconnectAttempt < 10) {
              attemptReconnect();
            }
          }
        });

      healthCheckChannel.current = channel;
    }, delay);
  }, []);

  // Monitor connection health
  useEffect(() => {
    const channel = supabase
      .channel("nexus_health_monitor")
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          updateConnectionState({
            status: "connected",
            lastUpdate: new Date(),
            reconnectAttempt: 0,
          });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          updateConnectionState({ status: "disconnected" });
          attemptReconnect();
        }
      });

    healthCheckChannel.current = channel;

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [attemptReconnect]);

  const markDataUpdate = useCallback(() => {
    updateConnectionState({ lastUpdate: new Date() });
  }, []);

  const registerChannel = useCallback((name: string) => {
    const channels = new Set(globalState.channels);
    channels.add(name);
    updateConnectionState({ channels });
  }, []);

  const unregisterChannel = useCallback((name: string) => {
    const channels = new Set(globalState.channels);
    channels.delete(name);
    updateConnectionState({ channels });
  }, []);

  return {
    ...state,
    markDataUpdate,
    registerChannel,
    unregisterChannel,
    attemptReconnect,
  };
}
