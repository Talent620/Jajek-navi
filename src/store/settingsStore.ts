import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from '../services/storageService';

interface SettingsState {
  voiceEnabled: boolean;
  mockGps: boolean; // tryb symulacji jazdy
  highAccuracy: boolean;
  setVoiceEnabled: (v: boolean) => void;
  setMockGps: (v: boolean) => void;
  setHighAccuracy: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      mockGps: true, // domyślnie ON, by dało się testować bez realnego GPS
      highAccuracy: true,
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setMockGps: (mockGps) => set({ mockGps }),
      setHighAccuracy: (highAccuracy) => set({ highAccuracy }),
    }),
    {
      name: 'nav-settings',
      storage: createJSONStorage(() => capacitorStorage),
    },
  ),
);
