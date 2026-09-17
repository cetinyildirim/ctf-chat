/**
 * Notification beeps via WebAudio oscillators (no media files / data-URIs).
 * HTMLAudio data: URIs triggered NotSupportedError in Chromium.
 */

import { useNotificationStore } from '@/store/notifications';

type SoundKind = 'mention' | 'message' | 'ticket' | 'incident' | 'announcement';

let unlockBound = false;
let ctx: AudioContext | null = null;
const lastPlayedAt: Partial<Record<SoundKind, number>> = {};
const SOUND_DEDUPE_MS = 700;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Cls =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Cls) return null;
  ctx = new Cls();
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  gain = 0.06,
  type: OscillatorType = 'sine',
  when = 0,
): void {
  const audio = getCtx();
  if (!audio || audio.state !== 'running') return;
  const start = audio.currentTime + when;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(audio.destination);
  osc.start(start);
  osc.stop(start + dur);
}

const presets: Record<SoundKind, () => void> = {
  mention: () => {
    tone(880, 0.12, 0.08, 'triangle');
    tone(1320, 0.16, 0.06, 'sine', 0.06);
  },
  message: () => {
    tone(660, 0.08, 0.04, 'sine');
  },
  ticket: () => {
    tone(440, 0.1, 0.06, 'square');
    tone(660, 0.12, 0.05, 'square', 0.08);
  },
  incident: () => {
    tone(330, 0.18, 0.08, 'sawtooth');
    tone(280, 0.18, 0.08, 'sawtooth', 0.18);
  },
  announcement: () => {
    tone(523, 0.14, 0.06, 'triangle');
    tone(659, 0.14, 0.06, 'triangle', 0.12);
    tone(784, 0.18, 0.06, 'triangle', 0.24);
  },
};

async function resumeAndPlay(kind: SoundKind): Promise<void> {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') {
    try {
      await audio.resume();
    } catch {
      return;
    }
  }
  if (audio.state !== 'running') return;
  presets[kind]?.();
}

function primeFromGesture(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') {
    void audio.resume().catch(() => undefined);
  }
}

/** Unlock audio on first user gesture so later socket alerts can beep. */
export function ensureAudioUnlocked(): void {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;
  window.addEventListener('pointerdown', primeFromGesture, { passive: true });
  window.addEventListener('keydown', primeFromGesture, { passive: true });
}

/**
 * Play a notification sound if the user has sound enabled and DND off.
 * Prefs are read live from the store (avoids stale SocketBridge closures).
 */
export function playSound(kind: SoundKind): void {
  if (typeof window === 'undefined') return;
  ensureAudioUnlocked();
  const { soundEnabled, dnd } = useNotificationStore.getState();
  if (!soundEnabled || dnd) return;
  const now = Date.now();
  const last = lastPlayedAt[kind] ?? 0;
  if (now - last < SOUND_DEDUPE_MS) return;
  lastPlayedAt[kind] = now;
  void resumeAndPlay(kind).catch(() => undefined);
}

/** Play during a user gesture (settings / bell toggle) to unlock + confirm audio. */
export function playSoundFromUserGesture(kind: SoundKind = 'ticket'): void {
  if (typeof window === 'undefined') return;
  ensureAudioUnlocked();
  primeFromGesture();
  const { soundEnabled } = useNotificationStore.getState();
  if (!soundEnabled) return;
  void resumeAndPlay(kind).catch(() => undefined);
}
