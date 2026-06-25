// Silnik nawigacji: konsumuje pomiary GPS, liczy postęp po krokach,
// wykrywa zjazd z trasy, wyzwala głos i re-routing. Wydzielony od UI.
import { useEffect, useRef } from 'react';
import { useNavStore } from '../../store/navStore';
import { useTripStore } from '../../store/tripStore';
import { useSettingsStore } from '../../store/settingsStore';
import { voiceService } from '../../services/voiceService';
import {
  startTracking,
  startMockDrive,
  requestLocationPermission,
  type Tracker,
} from '../../services/locationService';
import { getDirections } from '../../services/mapboxService';
import { haptic, notify } from '../../services/deviceService';
import { advanceProgress, remainingToEnd } from './progress';
import { checkOffRoute } from './offroute';
import { haversine } from './geo';
import { NAV } from '../../config';
import type { Fix, RouteLeg, Stop } from '../../types';
import { formatDistance } from '../format';

/** Buduje listę przystanków w kolejności trasy. */
function orderedStops(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.order - b.order);
}

export function useNavigationEngine(tripId: string | null) {
  const trackerRef = useRef<Tracker | null>(null);
  const rerouteInFlight = useRef(false);

  const active = useNavStore((s) => s.active);
  const mockGps = useSettingsStore((s) => s.mockGps);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);

  // Synchronizuj włączenie głosu z serwisem.
  useEffect(() => {
    voiceService.setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    if (!active || !tripId) return;

    let stopped = false;

    const onFix = (rawFix: Fix) => {
      if (stopped) return;
      const trip = useTripStore.getState().current();
      if (!trip || trip.legs.length === 0) return;

      const nav = useNavStore.getState();
      nav.setFix(rawFix);

      // 1) Postęp po krokach
      const { state: progState, progress } = advanceProgress(
        nav.progress,
        rawFix,
        trip.legs,
      );
      nav.setProgress(progState);
      if (progress.step) {
        nav.setBanner(progress.step, progress.distanceToManeuver);
      }

      // 2) Głos: zapowiedź z wyprzedzeniem + przy manewrze
      if (progress.shouldAnnounceAhead && progress.step) {
        voiceService.speak(
          progress.step.voiceInstruction ||
            `Za ${formatDistance(NAV.announceAheadMeters)} ${progress.step.instruction}`,
        );
      }
      if (progress.advanced && progress.step) {
        voiceService.speak(progress.step.instruction);
      }

      // 3) Pozostały dystans / czas
      const rem = remainingToEnd(progState, rawFix, trip.legs);
      nav.setRemaining(rem.distanceMeters, rem.durationSeconds);

      // 4) Wykrywanie dojazdu do przystanków (auto-arrival ~50 m)
      const ordered = orderedStops(trip.stops);
      for (let i = 0; i < ordered.length; i++) {
        const st = ordered[i];
        if (st.arrived || st.skipped) continue;
        const d = haversine(rawFix, { lat: st.lat, lng: st.lng });
        if (d <= NAV.arrivalRadiusMeters) {
          useTripStore.getState().markArrived(st.id);
          nav.openSheet(st.id);
          voiceService.speakNow(`Dotarłeś do: ${st.label}. Sprawdź listę zadań.`);
          if (useSettingsStore.getState().haptics) void haptic('success');
          void notify('Dotarłeś na miejsce', `${st.label} — ${st.address}`);
          break;
        }
      }

      // ustaw aktywny przystanek = pierwszy nieukończony i niepominięty
      const nextIdx = ordered.findIndex((s) => !s.completed && !s.skipped);
      nav.setActiveStopIndex(nextIdx === -1 ? ordered.length - 1 : nextIdx);

      // 5) Detekcja zjazdu z trasy → re-routing
      const offResult = checkOffRoute(nav.offRoute, rawFix, trip.legs);
      nav.setOffRoute(offResult.state);
      // Aktualizuj wskaźnik tylko przy realnym pomiarze (bez migotania na słabym GPS).
      if (offResult.measured) nav.setOffRouteDistance(offResult.distance);
      if (offResult.shouldReroute && !rerouteInFlight.current) {
        void reroute(rawFix);
      }
    };

    const reroute = async (fix: Fix) => {
      rerouteInFlight.current = true;
      useNavStore.getState().setRerouting(true);
      voiceService.speakNow('Przeliczam trasę');
      if (useSettingsStore.getState().haptics) void haptic('warning');
      try {
        const trip = useTripStore.getState().current();
        if (!trip) return;
        // Cel: pozostałe (nieukończone) przystanki w bieżącej kolejności.
        const remainingStops = orderedStops(trip.stops).filter(
          (s) => !s.completed && !s.skipped,
        );
        if (remainingStops.length === 0) return;
        const points = [
          { lng: fix.lng, lat: fix.lat },
          ...remainingStops.map((s) => ({ lng: s.lng, lat: s.lat })),
        ];
        const stopIds = remainingStops.map((s) => s.id);
        const newLegs: RouteLeg[] = await getDirections(points, stopIds);
        if (stopped) return;
        // Podmień legi i zresetuj postęp.
        const totalDistanceMeters = newLegs.reduce((a, l) => a + l.distanceMeters, 0);
        const totalDurationSeconds = newLegs.reduce((a, l) => a + l.durationSeconds, 0);
        useTripStore.setState((s) => ({
          trips: s.trips.map((t) =>
            t.id === trip.id
              ? { ...t, legs: newLegs, totalDistanceMeters, totalDurationSeconds }
              : t,
          ),
        }));
        const navState = useNavStore.getState();
        navState.setProgress({ legIndex: 0, stepIndex: 0, announcedAhead: false });
        navState.setOffRoute({ consecutive: 0 });
      } catch {
        // przy błędzie zostaw starą trasę
      } finally {
        rerouteInFlight.current = false;
        useNavStore.getState().setRerouting(false);
      }
    };

    const begin = async () => {
      const trip = useTripStore.getState().current();
      if (!trip) return;
      if (mockGps) {
        trackerRef.current = startMockDrive(trip.legs, onFix, {
          onFinish: () => voiceService.speakNow('Trasa zakończona'),
        });
      } else {
        await requestLocationPermission();
        trackerRef.current = await startTracking(onFix, (e) => {
          if (import.meta.env.DEV) console.warn('[gps]', e);
        });
      }
    };

    void begin();

    return () => {
      stopped = true;
      trackerRef.current?.stop();
      trackerRef.current = null;
      voiceService.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tripId, mockGps]);
}
