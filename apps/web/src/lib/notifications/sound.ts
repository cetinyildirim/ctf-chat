/**
 * Cyber-feeling notification sounds, generated entirely with the WebAudio API
 * so we don't need binary assets. Each "kind" plays a small synthesized blip.
 */

type SoundKind = 'mention' | 'message' | 'ticket' | 'incident' | 'announcement';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Cls = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Cls) return null;
  ctx = new Cls();
  return ctx;
}

function tone(freq: number, dur: number, gain = 0.06, type: OscillatorType = 'sine', when = 0): void {
  const audio = getCtx();
  if (!audio) return;
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

export function playSound(kind: SoundKind): void {
  if (typeof window === 'undefined') return;
  try {
    const audio = getCtx();
    if (!audio) return;
    if (audio.state === 'suspended') void audio.resume();
    presets[kind]?.();
  } catch {
    // sound is best-effort
  }
}
