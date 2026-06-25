import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from '../services/storageService';

interface SettingsState {
  voiceEnabled: boolean;
  mockGps: boolean; // tryb symulacji jazdy
  highAccuracy: boolean;
  offlineTiles: boolean; // cache kafli mapy (scaffold, sekcja 4.6)
  autoCheckUpdates: boolean; // automatyczne sprawdzanie aktualizacji APK
  currency: string; // waluta pobrań (COD)
  driverName: string; // podpis na raportach
  mode: 'courier' | 'passenger'; // tryb pracy busiarza
  mapStyle: 'dark' | 'light' | 'satellite'; // styl mapy
  haptics: boolean; // wibracje
  keepAwake: boolean; // ekran zawsze włączony w nawigacji
  weather: boolean; // pokazuj pogodę
  accent: 'cyan' | 'magenta' | 'emerald' | 'amber' | 'plasma'; // motyw kolorystyczny
  sounds: boolean; // dźwięki interfejsu / gong dojazdu
  quality: 'auto' | 'high' | 'eco'; // jakość/wydajność grafiki 3D
  coachDone: boolean; // czy pokazano samouczek pierwszego uruchomienia
  setVoiceEnabled: (v: boolean) => void;
  setMockGps: (v: boolean) => void;
  setHighAccuracy: (v: boolean) => void;
  setOfflineTiles: (v: boolean) => void;
  setAutoCheckUpdates: (v: boolean) => void;
  setCurrency: (v: string) => void;
  setDriverName: (v: string) => void;
  setMode: (v: 'courier' | 'passenger') => void;
  setMapStyle: (v: 'dark' | 'light' | 'satellite') => void;
  setHaptics: (v: boolean) => void;
  setKeepAwake: (v: boolean) => void;
  setWeather: (v: boolean) => void;
  setAccent: (v: 'cyan' | 'magenta' | 'emerald' | 'amber' | 'plasma') => void;
  setSounds: (v: boolean) => void;
  setQuality: (v: 'auto' | 'high' | 'eco') => void;
  setCoachDone: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      mockGps: true, // domyślnie ON, by dało się testować bez realnego GPS
      highAccuracy: true,
      offlineTiles: false,
      autoCheckUpdates: true,
      currency: 'PLN',
      driverName: '',
      mode: 'courier',
      mapStyle: 'dark',
      haptics: true,
      keepAwake: true,
      weather: true,
      accent: 'cyan',
      sounds: true,
      quality: 'auto',
      coachDone: false,
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setMockGps: (mockGps) => set({ mockGps }),
      setHighAccuracy: (highAccuracy) => set({ highAccuracy }),
      setOfflineTiles: (offlineTiles) => set({ offlineTiles }),
      setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
      setCurrency: (currency) => set({ currency }),
      setDriverName: (driverName) => set({ driverName }),
      setMode: (mode) => set({ mode }),
      setMapStyle: (mapStyle) => set({ mapStyle }),
      setHaptics: (haptics) => set({ haptics }),
      setKeepAwake: (keepAwake) => set({ keepAwake }),
      setWeather: (weather) => set({ weather }),
      setAccent: (accent) => set({ accent }),
      setSounds: (sounds) => set({ sounds }),
      setQuality: (quality) => set({ quality }),
      setCoachDone: (coachDone) => set({ coachDone }),
    }),
    {
      name: 'nav-settings',
      storage: createJSONStorage(() => capacitorStorage),
    },
  ),
);
