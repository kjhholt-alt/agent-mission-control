"use client";

/**
 * Tauri Bridge — typed wrappers for Tauri commands.
 * All functions no-op gracefully when running in browser (not Tauri).
 */

export interface DaemonStatus {
  status: "Stopped" | "Starting" | "Running" | "Crashed";
  pid: number | null;
  uptime_seconds: number | null;
  crash_count: number;
  recent_stdout: string[];
  recent_stderr: string[];
}

// Check if running inside Tauri desktop app
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export async function startDaemon(): Promise<void> {
  await invoke("start_daemon");
}

export async function stopDaemon(): Promise<void> {
  await invoke("stop_daemon");
}

export async function restartDaemon(): Promise<void> {
  await invoke("restart_daemon");
}

export async function getDaemonStatus(): Promise<DaemonStatus | null> {
  return invoke<DaemonStatus>("daemon_status");
}

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  await invoke("set_always_on_top", { value });
}

export async function sendNotification(
  title: string,
  body: string
): Promise<void> {
  if (!isTauri()) return;
  try {
    const { sendNotification: notify } = await import(
      "@tauri-apps/plugin-notification"
    );
    notify({ title, body });
  } catch {
    // Notifications not available
  }
}

// ── Event listeners ─────────────────────────────────────────────────

type UnlistenFn = () => void;

export function onDaemonStdout(
  callback: (line: string) => void
): UnlistenFn {
  if (!isTauri()) return () => {};

  let unlisten: (() => void) | null = null;

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<string>("daemon-stdout", (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
  });

  return () => unlisten?.();
}

export function onDaemonStderr(
  callback: (line: string) => void
): UnlistenFn {
  if (!isTauri()) return () => {};

  let unlisten: (() => void) | null = null;

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<string>("daemon-stderr", (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
  });

  return () => unlisten?.();
}

export function onDaemonStatusChange(
  callback: (status: string) => void
): UnlistenFn {
  if (!isTauri()) return () => {};

  let unlisten: (() => void) | null = null;

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<string>("daemon-status", (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
  });

  return () => unlisten?.();
}

export function onDaemonCrash(
  callback: (message: string) => void
): UnlistenFn {
  if (!isTauri()) return () => {};

  let unlisten: (() => void) | null = null;

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<string>("daemon-crash", (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
  });

  return () => unlisten?.();
}
