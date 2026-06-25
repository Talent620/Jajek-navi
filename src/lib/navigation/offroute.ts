// Detekcja zjazdu z trasy — czysta logika (testowalna).
import type { Fix, RouteLeg } from '../../types';
import { distanceToPolyline } from './geo';
import { NAV } from '../../config';

export interface OffRouteState {
  consecutive: number; // liczba kolejnych pomiarów poza trasą
}

export function initialOffRoute(): OffRouteState {
  return { consecutive: 0 };
}

export interface OffRouteResult {
  state: OffRouteState;
  /** Najmniejsza odległość od trasy (metry). */
  distance: number;
  /** Czy NALEŻY przeliczyć trasę (przekroczono próg N razy z rzędu). */
  shouldReroute: boolean;
  /** Czy aktualny pomiar jest poza trasą. */
  offRoute: boolean;
}

/** Zwraca współrzędne wszystkich legów połączone w jedną listę [lng,lat]. */
export function combinedRouteCoords(legs: RouteLeg[]): number[][] {
  const coords: number[][] = [];
  for (const leg of legs) {
    const c = leg.geometry?.coordinates ?? [];
    if (coords.length > 0 && c.length > 0) {
      // unikamy duplikatu na styku legów
      const last = coords[coords.length - 1];
      const first = c[0];
      if (last[0] === first[0] && last[1] === first[1]) {
        coords.push(...c.slice(1));
        continue;
      }
    }
    coords.push(...c);
  }
  return coords;
}

export function checkOffRoute(
  state: OffRouteState,
  fix: Fix,
  legs: RouteLeg[],
): OffRouteResult {
  const coords = combinedRouteCoords(legs);
  if (coords.length < 2) {
    return { state, distance: 0, shouldReroute: false, offRoute: false };
  }

  // Odrzucaj pomiary o słabej dokładności — nie fałszuj off-route (sekcja 7).
  if (fix.accuracy != null && fix.accuracy > NAV.maxAcceptableAccuracy) {
    return { state, distance: 0, shouldReroute: false, offRoute: false };
  }

  const { distance } = distanceToPolyline(fix, coords);
  const offRoute = distance > NAV.offRouteMeters;

  const consecutive = offRoute ? state.consecutive + 1 : 0;
  const shouldReroute = consecutive >= NAV.offRouteConsecutive;

  return {
    state: { consecutive: shouldReroute ? 0 : consecutive },
    distance,
    shouldReroute,
    offRoute,
  };
}
