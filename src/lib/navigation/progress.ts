// Postęp po krokach manewrów — czysta logika (testowalna).
import type { Fix, ManeuverStep, RouteLeg } from '../../types';
import { haversine } from './geo';
import { NAV } from '../../config';

export interface NavProgress {
  legIndex: number;
  stepIndex: number;
  /** Dystans do punktu manewru bieżącego kroku (metry). */
  distanceToManeuver: number;
  /** Czy właśnie przekroczyliśmy próg i przeszliśmy do kolejnego kroku. */
  advanced: boolean;
  /** Czy zapowiedzieć manewr z wyprzedzeniem (announceAhead). */
  shouldAnnounceAhead: boolean;
  /** Aktualny krok (jeśli istnieje). */
  step?: ManeuverStep;
}

export interface ProgressState {
  legIndex: number;
  stepIndex: number;
  announcedAhead: boolean; // czy już zapowiedziano "za X metrów" dla tego kroku
}

export function initialProgress(): ProgressState {
  return { legIndex: 0, stepIndex: 0, announcedAhead: false };
}

/**
 * Wylicza postęp na podstawie pozycji i stanu. Zwraca nowy stan + opis
 * (czy odpalić głos, czy przejść do kolejnego kroku/legu).
 */
export function advanceProgress(
  state: ProgressState,
  fix: Fix,
  legs: RouteLeg[],
): { state: ProgressState; progress: NavProgress } {
  let { legIndex, stepIndex, announcedAhead } = state;

  // Pomijaj puste legi / wyjdź poza zakres.
  if (legIndex >= legs.length) {
    return {
      state,
      progress: {
        legIndex,
        stepIndex,
        distanceToManeuver: 0,
        advanced: false,
        shouldAnnounceAhead: false,
      },
    };
  }

  let leg = legs[legIndex];
  let step = leg.steps[stepIndex];

  // Jeśli z jakiegoś powodu brak kroku — spróbuj przejść do kolejnego legu.
  if (!step) {
    if (legIndex + 1 < legs.length) {
      legIndex += 1;
      stepIndex = 0;
      announcedAhead = false;
      leg = legs[legIndex];
      step = leg.steps[stepIndex];
    }
    if (!step) {
      return {
        state: { legIndex, stepIndex, announcedAhead },
        progress: {
          legIndex,
          stepIndex,
          distanceToManeuver: 0,
          advanced: false,
          shouldAnnounceAhead: false,
        },
      };
    }
  }

  const dist = haversine(fix, {
    lat: step.maneuverLat,
    lng: step.maneuverLng,
  });

  let advanced = false;
  let shouldAnnounceAhead = false;

  // Zapowiedź z wyprzedzeniem (raz na krok).
  if (!announcedAhead && dist <= NAV.announceAheadMeters && dist > NAV.stepAdvanceMeters) {
    shouldAnnounceAhead = true;
    announcedAhead = true;
  }

  // Przejście do kolejnego kroku po osiągnięciu progu.
  if (dist <= NAV.stepAdvanceMeters) {
    advanced = true;
    announcedAhead = false;
    if (stepIndex + 1 < leg.steps.length) {
      stepIndex += 1;
    } else if (legIndex + 1 < legs.length) {
      legIndex += 1;
      stepIndex = 0;
    }
  }

  return {
    state: { legIndex, stepIndex, announcedAhead },
    progress: {
      legIndex,
      stepIndex,
      distanceToManeuver: dist,
      advanced,
      shouldAnnounceAhead,
      step,
    },
  };
}

/** Pozostały dystans/czas od bieżącej pozycji do końca trasy (przybliżenie). */
export function remainingToEnd(
  state: ProgressState,
  fix: Fix,
  legs: RouteLeg[],
): { distanceMeters: number; durationSeconds: number } {
  let distance = 0;
  let duration = 0;
  for (let li = state.legIndex; li < legs.length; li++) {
    const leg = legs[li];
    if (li === state.legIndex) {
      // pierwszy leg: licz od pozycji do końca geometrii (przybliżenie po krokach)
      const steps = leg.steps.slice(state.stepIndex);
      let legDist = 0;
      if (steps.length > 0) {
        legDist += haversine(fix, {
          lat: steps[0].maneuverLat,
          lng: steps[0].maneuverLng,
        });
        for (let s = 0; s < steps.length - 1; s++) {
          legDist += haversine(
            { lat: steps[s].maneuverLat, lng: steps[s].maneuverLng },
            { lat: steps[s + 1].maneuverLat, lng: steps[s + 1].maneuverLng },
          );
        }
      } else {
        legDist = leg.distanceMeters;
      }
      distance += legDist;
      // proporcjonalny czas
      const frac = leg.distanceMeters > 0 ? legDist / leg.distanceMeters : 1;
      duration += leg.durationSeconds * Math.min(1, frac);
    } else {
      distance += leg.distanceMeters;
      duration += leg.durationSeconds;
    }
  }
  return { distanceMeters: distance, durationSeconds: duration };
}
