"use client";

import { useState, useCallback, useEffect } from "react";
import { TERMINAL_THEMES, type TerminalThemeName } from "./terminal-constants";

const STORAGE_KEY = "nexus-terminal-theme";

export function useTerminalTheme() {
  const [themeName, setThemeName] = useState<TerminalThemeName>("green");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as TerminalThemeName | null;
    if (saved && saved in TERMINAL_THEMES) setThemeName(saved);
  }, []);

  const setTheme = useCallback((name: TerminalThemeName) => {
    setThemeName(name);
    localStorage.setItem(STORAGE_KEY, name);
  }, []);

  const cycleTheme = useCallback(() => {
    const names = Object.keys(TERMINAL_THEMES) as TerminalThemeName[];
    const next = names[(names.indexOf(themeName) + 1) % names.length];
    setTheme(next);
  }, [themeName, setTheme]);

  return {
    themeName,
    theme: TERMINAL_THEMES[themeName],
    setTheme,
    cycleTheme,
  };
}
