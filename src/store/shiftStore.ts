// Czas pracy kierowcy (busiarz): zmiana, jazda, przerwy.
// Uproszczony tracker zgodny z duchem przepisów o czasie pracy — przypomina
// o przerwie po określonym czasie ciągłej jazdy.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from '../services/storageService';

export interface BreakEntry {
  start: string; // ISO
  end?: string; // ISO
}

interface ShiftState {
  shiftStart?: string; // ISO — początek zmiany
  onBreak: boolean;
  breaks: BreakEntry[];
  // Próg ciągłej jazdy do przypomnienia o przerwie (sekundy). UE: 4.5 h.
  breakReminderSeconds: number;

  startShift: () => void;
  endShift: () => void;
  startBreak: () => void;
  endBreak: () => void;
  reset: () => void;

  // selektory liczone na żądanie (now = Date.now())
  breakSeconds: (now: number) => number;
  shiftSeconds: (now: number) => number;
  drivingSeconds: (now: number) => number; // zmiana minus przerwy
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      shiftStart: undefined,
      onBreak: false,
      breaks: [],
      breakReminderSeconds: 4.5 * 3600,

      startShift: () =>
        set({ shiftStart: new Date().toISOString(), onBreak: false, breaks: [] }),

      endShift: () => {
        const s = get();
        // domknij ewentualną otwartą przerwę
        const breaks = s.onBreak
          ? s.breaks.map((b, i) =>
              i === s.breaks.length - 1 && !b.end
                ? { ...b, end: new Date().toISOString() }
                : b,
            )
          : s.breaks;
        set({ shiftStart: undefined, onBreak: false, breaks });
      },

      startBreak: () => {
        const s = get();
        if (!s.shiftStart || s.onBreak) return;
        set({ onBreak: true, breaks: [...s.breaks, { start: new Date().toISOString() }] });
      },

      endBreak: () => {
        const s = get();
        if (!s.onBreak) return;
        set({
          onBreak: false,
          breaks: s.breaks.map((b, i) =>
            i === s.breaks.length - 1 && !b.end
              ? { ...b, end: new Date().toISOString() }
              : b,
          ),
        });
      },

      reset: () => set({ shiftStart: undefined, onBreak: false, breaks: [] }),

      breakSeconds: (now) => {
        const s = get();
        return s.breaks.reduce((acc, b) => {
          const start = new Date(b.start).getTime();
          const end = b.end ? new Date(b.end).getTime() : now;
          return acc + Math.max(0, (end - start) / 1000);
        }, 0);
      },

      shiftSeconds: (now) => {
        const s = get();
        if (!s.shiftStart) return 0;
        return Math.max(0, (now - new Date(s.shiftStart).getTime()) / 1000);
      },

      drivingSeconds: (now) => {
        const s = get();
        if (!s.shiftStart) return 0;
        const total = (now - new Date(s.shiftStart).getTime()) / 1000;
        return Math.max(0, total - s.breakSeconds(now));
      },
    }),
    {
      name: 'nav-shift',
      storage: createJSONStorage(() => capacitorStorage),
    },
  ),
);
