// Tryb offline mapy — SZKIELET ARCHITEKTONICZNY (sekcja 4.6, pozycja ⬜).
//
// Pełny offline wymaga: (1) źródła kafli rastrowych/wektorowych z licencją na
// cache (np. MapTiler/Protomaps), (2) prefetchu kafli wzdłuż geometrii trasy w
// zakresie zoomów, (3) trwałego magazynu (Cache Storage API w webview lub
// @capacitor/filesystem), (4) warstwy serwującej kafle offline w Mapbox/MapLibre
// (transformRequest -> lokalny URI). Tu zostawiamy interfejs + TODO, by nie
// rozdmuchiwać MVP.

import type { RouteLeg } from '../../types';
import { combinedRouteCoords } from '../navigation/offroute';

export interface TilePrefetchPlan {
  tiles: { z: number; x: number; y: number }[];
  estimatedBytes: number;
}

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { z, x, y };
}

/** Wyznacza listę kafli pokrywających trasę (do późniejszego prefetchu). */
export function planRouteTiles(legs: RouteLeg[], zooms = [12, 13, 14]): TilePrefetchPlan {
  const coords = combinedRouteCoords(legs);
  const set = new Set<string>();
  for (const z of zooms) {
    for (const [lng, lat] of coords) {
      const t = lngLatToTile(lng, lat, z);
      set.add(`${t.z}/${t.x}/${t.y}`);
      // sąsiednie kafle dla marginesu
      set.add(`${t.z}/${t.x + 1}/${t.y}`);
      set.add(`${t.z}/${t.x}/${t.y + 1}`);
    }
  }
  const tiles = [...set].map((s) => {
    const [z, x, y] = s.split('/').map(Number);
    return { z, x, y };
  });
  // ~15 kB / kafel (szacunek)
  return { tiles, estimatedBytes: tiles.length * 15_000 };
}

/**
 * TODO: faktyczny prefetch i zapis kafli do Cache Storage / filesystem.
 * Obecnie zwraca tylko plan (rozmiar/ilość) do pokazania w ustawieniach.
 */
export async function prefetchRouteTiles(_legs: RouteLeg[]): Promise<TilePrefetchPlan> {
  const plan = planRouteTiles(_legs);
  // TODO: pobierz kafle i zapisz; podłącz transformRequest w MapView.
  return plan;
}
