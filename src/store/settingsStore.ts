import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from '../services/storageService';

interface SettingsState {
  voiceEnabled: boolean;
  mockGps: boolean; // tryb symulacji jazdy
  highAccuracy: boolean;
  offlineTiles: boolean; // cache kafli mapy (scaffold, sekcja 4.6)
  autoCheckUpdates: boolean; // automatyczne sprawdzanie aktualizacji APK
  setVoiceEnabled: (v: boolean) => void;
  setMockGps: (v: boolean) => void;
  setHighAccuracy: (v: boolean) => void;
  setOfflineTiles: (v: boolean) => void;
  setAutoCheckUpdates: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      mockGps: true, // domyślnie ON, by dało się testować bez realnego GPS
      highAccuracy: true,
      offlineTiles: false,
      autoCheckUpdates: true,
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setMockGps: (mockGps) => set({ mockGps }),
      setHighAccuracy: (highAccuracy) => set({ highAccuracy }),
      setOfflineTiles: (offlineTiles) => set({ offlineTiles }),
      setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
    }),
    {
      name: 'nav-settings',
      storage: createJSONStorage(() => capacitorStorage),
    },
  ),
);
