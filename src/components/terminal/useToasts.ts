"use client";
import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => {
        const next = [...prev, { id, message, type }];
        // Keep max 3
        return next.length > 3 ? next.slice(-3) : next;
      });
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
