// Warstwa integracji z Mapbox: geocoding, optimization (TSP), directions.
// Gdy brak tokena → tryb MOCK (deterministyczne dane przykładowe), żeby
// aplikacja i build działały bez klucza (sekcja 12 — nie blokuj budowy).
import type { LineString } from 'geojson';
import type { ManeuverStep, RouteLeg, Stop, LngLat } from '../types';
import { HAS_MAPBOX_TOKEN, MAPBOX_TOKEN } from '../config';
import { haversine, bearing } from '../lib/navigation/geo';

const BASE = 'https://api.mapbox.com';

export interface GeocodeResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/* --------------------------- GEOCODING --------------------------- */

export async function geocode(
  query: string,
  proximity?: LngLat,
): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  if (!HAS_MAPBOX_TOKEN) return mockGeocode(query);

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    limit: '5',
    language: 'pl',
    country: 'pl',
  });
  if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);

  const url = `${BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = await res.json();
  return (data.features ?? []).map((f: any) => ({
    label: f.text ?? f.place_name,
    address: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}

/* --------------------- OPTIMIZATION (TSP) ----------------------- */

export interface OptimizeResult {
  /** Nowa kolejność — indeksy wejściowych przystanków. */
  order: number[];
}

/**
 * Optymalizacja kolejności przystanków.
 * Mapbox Optimization API v1 ma limit 12 współrzędnych na zapytanie.
 * Powyżej — fallback nearest-neighbour po stronie klienta (sekcja 7).
 */
export async function optimizeOrder(
  start: LngLat,
  stops: LngLat[],
): Promise<OptimizeResult> {
  if (stops.length <= 1) return { order: stops.map((_, i) => i) };

  const MAX = 12; // start + przystanki
  if (!HAS_MAPBOX_TOKEN || stops.length + 1 > MAX) {
    return { order: nearestNeighbourOrder(start, stops) };
  }

  const coords = [start, ...stops]
    .map((c) => `${c.lng},${c.lat}`)
    .join(';');
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    source: 'first', // start jest pierwszy
    roundtrip: 'false',
    geometries: 'geojson',
    overview: 'simplified',
  });
  const url = `${BASE}/optimized-trips/v1/mapbox/driving/${coords}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    // Fallback przy błędzie API
    return { order: nearestNeighbourOrder(start, stops) };
  }
  const data = await res.json();
  if (data.code !== 'Ok' || !data.waypoints) {
    return { order: nearestNeighbourOrder(start, stops) };
  }
  // waypoints[i].waypoint_index = pozycja punktu i w zoptymalizowanej trasie.
  // Pomijamy indeks 0 (start). Sortujemy przystanki wg waypoint_index.
  const wps: { inputIndex: number; tripIndex: number }[] = data.waypoints
    .map((w: any, i: number) => ({ inputIndex: i, tripIndex: w.waypoint_index }))
    .filter((w: any) => w.inputIndex !== 0); // odetnij start
  wps.sort((a, b) => a.tripIndex - b.tripIndex);
  // inputIndex był przesunięty o 1 (start na 0) → odejmujemy 1
  const order = wps.map((w) => w.inputIndex - 1);
  return { order };
}

/** Heurystyka najbliższego sąsiada — fallback bez API / dla wielu punktów. */
export function nearestNeighbourOrder(start: LngLat, stops: LngLat[]): number[] {
  const remaining = stops.map((_, i) => i);
  const order: number[] = [];
  let current: LngLat = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let k = 0; k < remaining.length; k++) {
      const d = haversine(current, stops[remaining[k]]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    order.push(chosen);
    current = stops[chosen];
  }
  return order;
}

/* ----------------------- DIRECTIONS ----------------------------- */

/**
 * Zwraca legi (geometria + kroki manewrów) dla podanej sekwencji punktów.
 * points[0] = start, kolejne = przystanki w docelowej kolejności.
 * stopIds[i] odpowiada points[i+1] (start nie ma stopId — używamy 'start').
 */
export async function getDirections(
  points: LngLat[],
  stopIds: string[],
): Promise<RouteLeg[]> {
  if (points.length < 2) return [];
  if (!HAS_MAPBOX_TOKEN) return mockDirections(points, stopIds);

  const coords = points.map((c) => `${c.lng},${c.lat}`).join(';');
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'pl',
    voice_instructions: 'true',
    annotations: 'distance',
  });
  const url = `${BASE}/directions/v5/mapbox/driving/${coords}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(`Directions: ${data.code ?? 'brak trasy'}`);
  }
  const route = data.routes[0];
  const ids = ['start', ...stopIds];

  return route.legs.map((leg: any, i: number): RouteLeg => {
    const steps: ManeuverStep[] = (leg.steps ?? []).map((s: any): ManeuverStep => {
      const loc = s.maneuver?.location ?? [0, 0];
      const voice =
        s.voiceInstructions?.[0]?.announcement ??
        s.maneuver?.instruction ??
        '';
      return {
        instruction: s.maneuver?.instruction ?? '',
        voiceInstruction: voice,
        maneuverLng: loc[0],
        maneuverLat: loc[1],
        distanceMeters: s.distance ?? 0,
        type: s.maneuver?.type ?? 'turn',
        modifier: s.maneuver?.modifier,
      };
    });

    // Geometria pojedynczego legu — sklejamy z geometrii kroków,
    // bo Directions zwraca geometrię całej trasy łącznie.
    const legCoords: number[][] = [];
    for (const s of leg.steps ?? []) {
      const c = s.geometry?.coordinates ?? [];
      if (legCoords.length && c.length) legCoords.push(...c.slice(1));
      else legCoords.push(...c);
    }
    const geometry: LineString = {
      type: 'LineString',
      coordinates: legCoords.length ? legCoords : [
        [points[i].lng, points[i].lat],
        [points[i + 1].lng, points[i + 1].lat],
      ],
    };

    return {
      fromStopId: ids[i],
      toStopId: ids[i + 1],
      distanceMeters: leg.distance ?? 0,
      durationSeconds: leg.duration ?? 0,
      steps,
      geometry,
    };
  });
}

/** Pomocniczo buduje sekwencję punktów ze startu + uporządkowanych stopów. */
export function pointsFromStops(
  start: LngLat | undefined,
  stops: Stop[],
): { points: LngLat[]; stopIds: string[] } {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  const points: LngLat[] = [];
  if (start) points.push(start);
  for (const s of ordered) points.push({ lng: s.lng, lat: s.lat });
  return { points, stopIds: ordered.map((s) => s.id) };
}

/* --------------------------- MOCKI ------------------------------ */
// Deterministyczne dane, by aplikacja działała bez tokena Mapbox.

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockGeocode(query: string): GeocodeResult[] {
  // Bazujemy na Olsztynie (przykład z PRD) z deterministycznym rozrzutem.
  const base = { lat: 53.7784, lng: 20.4801 };
  const h = hashStr(query);
  const results: GeocodeResult[] = [];
  for (let i = 0; i < 3; i++) {
    const dLat = (((h >> (i * 3)) % 200) - 100) / 5000; // ±0.02
    const dLng = (((h >> (i * 3 + 1)) % 200) - 100) / 3000;
    results.push({
      label: `${query}${i === 0 ? '' : ` (wariant ${i + 1})`}`,
      address: `${query}, Olsztyn (MOCK — brak tokena Mapbox)`,
      lat: base.lat + dLat,
      lng: base.lng + dLng,
    });
  }
  return results;
}

function mockDirections(points: LngLat[], stopIds: string[]): RouteLeg[] {
  const ids = ['start', ...stopIds];
  const legs: RouteLeg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = haversine(a, b);
    const dur = (dist / 11.1) * 1.3; // ~40 km/h + objazdy
    // Prosta geometria z kilkoma punktami pośrednimi (lekko łamana).
    const coords: number[][] = [];
    const segs = 6;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const jitter = Math.sin(t * Math.PI) * 0.0006 * (i % 2 === 0 ? 1 : -1);
      coords.push([
        a.lng + (b.lng - a.lng) * t + jitter,
        a.lat + (b.lat - a.lat) * t + jitter * 0.5,
      ]);
    }
    const brg = bearing(a, b);
    const dirWord = brg > 45 && brg < 135 ? 'wschód' : brg >= 135 && brg < 225 ? 'południe' : brg >= 225 && brg < 315 ? 'zachód' : 'północ';
    const steps: ManeuverStep[] = [
      {
        instruction: `Jedź na ${dirWord}`,
        voiceInstruction: `Jedź prosto na ${dirWord} przez ${Math.round(dist)} metrów`,
        maneuverLng: coords[Math.floor(segs / 2)][0],
        maneuverLat: coords[Math.floor(segs / 2)][1],
        distanceMeters: dist * 0.7,
        type: 'depart',
        modifier: 'straight',
      },
      {
        instruction: 'Dotarłeś do celu',
        voiceInstruction: 'Dotarłeś do przystanku',
        maneuverLng: b.lng,
        maneuverLat: b.lat,
        distanceMeters: dist * 0.3,
        type: 'arrive',
      },
    ];
    legs.push({
      fromStopId: ids[i],
      toStopId: ids[i + 1],
      distanceMeters: dist,
      durationSeconds: dur,
      steps,
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  return legs;
}
