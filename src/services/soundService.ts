// Lekki dźwięk interfejsu przez Web Audio API (bez plików) — gong dojazdu,
// potwierdzenia, kliknięcia. Subtelne, wyłączalne w ustawieniach.
import { useSettingsStore } from '../store/settingsStore';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (!ctx) return null;
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function enabled(): boolean {
  try {
    return useSettingsStore.getState().sounds;
  } catch {
    return true;
  }
}

function tone(
  freq: number,
  durMs: number,
  type: OscillatorType = 'sine',
  gain = 0.06,
  delayMs = 0,
  glideTo?: number,
) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delayMs / 1000;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + durMs / 1000);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.02);
}

export const sound = {
  /** Odblokuj kontekst audio po pierwszym geście (wywołać raz). */
  unlock() {
    ac();
  },
  tap() {
    if (enabled()) tone(520, 60, 'triangle', 0.04);
  },
  success() {
    if (!enabled()) return;
    tone(660, 120, 'sine', 0.06, 0);
    tone(990, 160, 'sine', 0.06, 90);
  },
  /** Gong dojazdu do przystanku. */
  arrival() {
    if (!enabled()) return;
    tone(880, 220, 'sine', 0.07, 0);
    tone(1320, 280, 'sine', 0.06, 120);
    tone(1760, 320, 'sine', 0.05, 240);
  },
  reroute() {
    if (enabled()) tone(420, 240, 'sawtooth', 0.05, 0, 300);
  },
  error() {
    if (!enabled()) return;
    tone(220, 200, 'square', 0.05, 0);
    tone(160, 260, 'square', 0.05, 120);
  },
};
