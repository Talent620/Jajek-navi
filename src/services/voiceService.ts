// Prowadzenie głosowe (TTS) z kolejką i deduplikacją.
// Preferuje plugin @capacitor-community/text-to-speech (stabilny na Androidzie),
// z fallbackiem na Web Speech API w przeglądarce.

interface TtsPlugin {
  speak(opts: {
    text: string;
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    category?: string;
  }): Promise<void>;
  stop(): Promise<void>;
}

let ttsPlugin: TtsPlugin | null = null;
let triedLoad = false;

async function loadTts(): Promise<TtsPlugin | null> {
  if (triedLoad) return ttsPlugin;
  triedLoad = true;
  try {
    const isNative =
      typeof (window as any).Capacitor !== 'undefined' &&
      (window as any).Capacitor?.isNativePlatform?.() === true;
    if (isNative) {
      const mod = await import('@capacitor-community/text-to-speech');
      ttsPlugin = mod.TextToSpeech as unknown as TtsPlugin;
    }
  } catch {
    ttsPlugin = null;
  }
  return ttsPlugin;
}

class VoiceService {
  private queue: string[] = [];
  private speaking = false;
  private lastSpoken = '';
  private lastSpokenAt = 0;
  private enabled = true;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  /** Dodaje komunikat do kolejki (z deduplikacją powtórzeń). */
  speak(text: string, opts?: { dedupeMs?: number }) {
    if (!this.enabled || !text.trim()) return;
    const dedupeMs = opts?.dedupeMs ?? 8000;
    const now = Date.now();
    if (text === this.lastSpoken && now - this.lastSpokenAt < dedupeMs) return;
    this.queue.push(text);
    void this.pump();
  }

  /** Komunikat priorytetowy — czyści kolejkę i mówi natychmiast. */
  speakNow(text: string) {
    if (!this.enabled || !text.trim()) return;
    this.queue = [text];
    void this.stopCurrent().then(() => this.pump());
  }

  clear() {
    this.queue = [];
    void this.stopCurrent();
  }

  private async stopCurrent() {
    try {
      const tts = await loadTts();
      if (tts) await tts.stop();
      else if (typeof window !== 'undefined' && 'speechSynthesis' in window)
        window.speechSynthesis.cancel();
    } catch {
      /* ignoruj */
    }
    this.speaking = false;
  }

  private async pump() {
    if (this.speaking) return;
    const text = this.queue.shift();
    if (!text) return;
    this.speaking = true;
    this.lastSpoken = text;
    this.lastSpokenAt = Date.now();
    try {
      await this.utter(text);
    } catch {
      /* ignoruj błędy TTS */
    } finally {
      this.speaking = false;
      if (this.queue.length > 0) void this.pump();
    }
  }

  private async utter(text: string): Promise<void> {
    const tts = await loadTts();
    if (tts) {
      await tts.speak({
        text,
        lang: 'pl-PL',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      });
      return;
    }
    // Fallback: Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pl-PL';
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
      return;
    }
    // Brak TTS — log tylko w dev
    if (import.meta.env.DEV) console.info('[voice]', text);
  }
}

export const voiceService = new VoiceService();
