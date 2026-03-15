"use client";

import { useEffect, useCallback } from "react";

type HotkeyHandler = () => void;

interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  handler: HotkeyHandler;
  /** Don't fire if user is typing in an input/textarea */
  ignoreInputs?: boolean;
}

/**
 * Global hotkey hook for Nexus.
 * Registers keyboard shortcuts across all pages.
 */
export function useHotkeys(hotkeys: HotkeyConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      for (const hotkey of hotkeys) {
        const keyMatch = e.key.toLowerCase() === hotkey.key.toLowerCase();
        const ctrlMatch = hotkey.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;

        if (keyMatch && ctrlMatch) {
          // Skip if in input and ignoreInputs is true (default)
          if (isInput && hotkey.ignoreInputs !== false) continue;

          e.preventDefault();
          hotkey.handler();
          return;
        }
      }
    },
    [hotkeys]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Pre-built navigation hotkeys for any Nexus page.
 */
export function useNavigationHotkeys(extras?: HotkeyConfig[]) {
  useHotkeys([
    { key: "1", handler: () => (window.location.href = "/") },
    { key: "2", handler: () => (window.location.href = "/ops") },
    { key: "3", handler: () => (window.location.href = "/game") },
    { key: "4", handler: () => (window.location.href = "/oracle") },
    { key: "5", handler: () => (window.location.href = "/sessions") },
    { key: "6", handler: () => (window.location.href = "/templates") },
    { key: "7", handler: () => (window.location.href = "/fusion") },
    ...(extras || []),
  ]);
}
