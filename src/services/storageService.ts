// Persystencja przez @capacitor/preferences z fallbackiem na localStorage
// (przeglądarka / dev). Eksponuje adapter zgodny ze `StateStorage` z Zustand.
import type { StateStorage } from 'zustand/middleware';

let preferences: typeof import('@capacitor/preferences').Preferences | null = null;

async function getPreferences() {
  if (preferences) return preferences;
  try {
    const mod = await import('@capacitor/preferences');
    preferences = mod.Preferences;
    return preferences;
  } catch {
    return null;
  }
}

function isNativeAvailable(): boolean {
  // Capacitor wstrzykuje window.Capacitor; w czystej przeglądarce go nie ma.
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

export const capacitorStorage: StateStorage = {
  async getItem(name: string): Promise<string | null> {
    if (isNativeAvailable()) {
      const prefs = await getPreferences();
      if (prefs) {
        const { value } = await prefs.get({ key: name });
        return value ?? null;
      }
    }
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string): Promise<void> {
    if (isNativeAvailable()) {
      const prefs = await getPreferences();
      if (prefs) {
        await prefs.set({ key: name, value });
        return;
      }
    }
    try {
      localStorage.setItem(name, value);
    } catch {
      /* brak miejsca / prywatny tryb — ignoruj */
    }
  },
  async removeItem(name: string): Promise<void> {
    if (isNativeAvailable()) {
      const prefs = await getPreferences();
      if (prefs) {
        await prefs.remove({ key: name });
        return;
      }
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignoruj */
    }
  },
};
