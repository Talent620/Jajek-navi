import { create } from 'zustand';
import type { Fix, ManeuverStep } from '../types';
import { initialProgress, type ProgressState } from '../lib/navigation/progress';
import { initialOffRoute, type OffRouteState } from '../lib/navigation/offroute';

interface NavState {
  active: boolean;
  fix: Fix | null;
  progress: ProgressState;
  offRoute: OffRouteState;
  rerouting: boolean;
  offRouteDistance: number;

  // bieżący manewr (do banera)
  currentStep: ManeuverStep | null;
  distanceToManeuver: number;
  // następny manewr (podgląd „potem…")
  nextStep: ManeuverStep | null;

  // pozostałe do końca trasy
  remainingDistance: number;
  remainingDuration: number;

  // indeks aktywnego przystanku (do którego jedziemy)
  activeStopIndex: number;

  // bottom-sheet check-listy
  sheetStopId: string | null;

  setActive: (v: boolean) => void;
  setFix: (f: Fix) => void;
  setProgress: (p: ProgressState) => void;
  setOffRoute: (o: OffRouteState) => void;
  setRerouting: (v: boolean) => void;
  setOffRouteDistance: (d: number) => void;
  setBanner: (step: ManeuverStep | null, distance: number) => void;
  setNextStep: (step: ManeuverStep | null) => void;
  setRemaining: (distance: number, duration: number) => void;
  setActiveStopIndex: (i: number) => void;
  openSheet: (stopId: string) => void;
  closeSheet: () => void;
  reset: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  active: false,
  fix: null,
  progress: initialProgress(),
  offRoute: initialOffRoute(),
  rerouting: false,
  offRouteDistance: 0,
  currentStep: null,
  distanceToManeuver: 0,
  nextStep: null,
  remainingDistance: 0,
  remainingDuration: 0,
  activeStopIndex: 0,
  sheetStopId: null,

  setActive: (active) => set({ active }),
  setFix: (fix) => set({ fix }),
  setProgress: (progress) => set({ progress }),
  setOffRoute: (offRoute) => set({ offRoute }),
  setRerouting: (rerouting) => set({ rerouting }),
  setOffRouteDistance: (offRouteDistance) => set({ offRouteDistance }),
  setBanner: (currentStep, distanceToManeuver) =>
    set({ currentStep, distanceToManeuver }),
  setNextStep: (nextStep) => set({ nextStep }),
  setRemaining: (remainingDistance, remainingDuration) =>
    set({ remainingDistance, remainingDuration }),
  setActiveStopIndex: (activeStopIndex) => set({ activeStopIndex }),
  openSheet: (stopId) => set({ sheetStopId: stopId }),
  closeSheet: () => set({ sheetStopId: null }),
  reset: () =>
    set({
      active: false,
      fix: null,
      progress: initialProgress(),
      offRoute: initialOffRoute(),
      rerouting: false,
      offRouteDistance: 0,
      currentStep: null,
      distanceToManeuver: 0,
      nextStep: null,
      remainingDistance: 0,
      remainingDuration: 0,
      activeStopIndex: 0,
      sheetStopId: null,
    }),
}));
