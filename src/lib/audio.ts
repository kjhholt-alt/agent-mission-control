"use client";

/**
 * Nexus Audio System — lightweight audio feedback without Howler.js.
 * Uses Web Audio API for procedural sound generation.
 * No external dependencies, no audio files to load.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.15
) {
  const ctx = getCtx();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Mission spawned — ascending two-note chime */
export function playSpawnSound() {
  playTone(523, 0.15, "sine", 0.12); // C5
  setTimeout(() => playTone(659, 0.2, "sine", 0.12), 100); // E5
}

/** Task completed — satisfying three-note success chord */
export function playCompleteSound() {
  playTone(523, 0.15, "sine", 0.1); // C5
  setTimeout(() => playTone(659, 0.15, "sine", 0.1), 80); // E5
  setTimeout(() => playTone(784, 0.25, "sine", 0.12), 160); // G5
}

/** Task failed — descending minor tone */
export function playFailSound() {
  playTone(440, 0.2, "sawtooth", 0.08); // A4
  setTimeout(() => playTone(349, 0.3, "sawtooth", 0.06), 150); // F4
}

/** Deploy triggered — quick notification blip */
export function playDeploySound() {
  playTone(880, 0.08, "square", 0.06); // A5
  setTimeout(() => playTone(1047, 0.12, "square", 0.08), 60); // C6
}

/** Achievement unlocked — triumphant fanfare */
export function playAchievementSound() {
  playTone(523, 0.12, "sine", 0.1);
  setTimeout(() => playTone(659, 0.12, "sine", 0.1), 80);
  setTimeout(() => playTone(784, 0.12, "sine", 0.1), 160);
  setTimeout(() => playTone(1047, 0.35, "sine", 0.15), 240);
}

/** Alert/warning — attention-getting pulse */
export function playAlertSound() {
  playTone(660, 0.1, "square", 0.08);
  setTimeout(() => playTone(660, 0.1, "square", 0.08), 200);
}

/** Subtle click for UI interactions */
export function playClickSound() {
  playTone(1200, 0.03, "sine", 0.05);
}

// ── Audio preference management ────────────────────────────────

const AUDIO_KEY = "nexus-audio-enabled";

export function isAudioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUDIO_KEY) !== "false";
}

export function setAudioEnabled(enabled: boolean) {
  localStorage.setItem(AUDIO_KEY, String(enabled));
}

/** Wrapper that checks if audio is enabled before playing */
export function playSound(sound: () => void) {
  if (isAudioEnabled()) sound();
}
