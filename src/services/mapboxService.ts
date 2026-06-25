// Warstwa danych geo — DARMOWY, OTWARTY STOS (bez kluczy API):
//  • Geokodowanie: Nominatim (OpenStreetMap)
//  • Trasy + kroki manewrów: OSRM (/route)
//  • Optymalizacja kolejności (TSP): OSRM (/trip)
// Działa od razu na urządzeniu (telefon ma internet). Mock pozostaje wyłącznie
// jako awaryjny fallback przy błędzie sieci, by aplikacja nigdy się nie wywaliła.
import type { LineString } from 'geojson';
import type { ManeuverStep, RouteLeg, Stop, LngLat } from '../types';
import { OSRM_URL, NOMINATIM_URL } from '../config';
import { haversine, bearing } from '../lib/navigation/geo';

export interface GeocodeResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/* --------------------------- GEOCODING (Nominatim) --------------------------- */

export async function geocode(
  query: string,
  proximity?: LngLat,
): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      'accept-language': 'pl',
    });
    // Bias wyników w okolicy bieżącej pozycji (bez twardego ograniczenia).
    if (proximity) {
      const d = 0.5;
      params.set(
        'viewbox',
        `${proximity.lng - d},${proximity.lat + d},${proximity.lng + d},${proximity.lat - d}`,
      );
    }
    const res = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = await res.json();
    return (data as any[]).map((f) => {
      const a = f.address ?? {};
      const street = [a.road, a.house_number].filter(Boolean).join(' ');
      const city = a.city || a.town || a.village || a.municipality || a.county || '';
      const label = f.name || street || city || String(f.display_name).split(',')[0];
      return {
        label,
        address: f.display_name as string,
        lat: parseFloat(f.lat),
        lng: parseFloat(f.lon),
      };
    });
  } catch {
    return mockGeocode(query);
  }
}

/* --------------------- OPTIMIZATION (OSRM /trip) ----------------------- */

export interface OptimizeResult {
  order: number[];
}

/**
 * Optymalizacja kolejności przystanków (problem komiwojażera) — OSRM /trip.
 * OSRM ogranicza liczbę punktów; powyżej rozsądnego progu lub przy błędzie
 * używamy heurystyki nearest-neighbour po stronie klienta.
 */
export async function optimizeOrder(
  start: LngLat,
  stops: LngLat[],
): Promise<OptimizeResult> {
  if (stops.length <= 1) return { order: stops.map((_, i) => i) };
  const MAX = 100; // OSRM trip — bezpieczny limit
  if (stops.length + 1 > MAX) return { order: nearestNeighbourOrder(start, stops) };

  try {
    const coords = [start, ...stops].map((c) => `${c.lng},${c.lat}`).join(';');
    const params = new URLSearchParams({
      source: 'first',
      roundtrip: 'false',
      geometries: 'geojson',
      overview: 'false',
    });
    const res = await fetch(
      `${OSRM_URL}/trip/v1/driving/${coords}?${params.toString()}`,
    );
    if (!res.ok) throw new Error(`OSRM trip HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.waypoints) {
      return { order: nearestNeighbourOrder(start, stops) };
    }
    // waypoints[i].waypoint_index = pozycja punktu i w zoptymalizowanej trasie.
    const wps: { inputIndex: number; tripIndex: number }[] = data.waypoints
      .map((w: any, i: number) => ({ inputIndex: i, tripIndex: w.waypoint_index }))
      .filter((w: any) => w.inputIndex !== 0); // odetnij start
    wps.sort((a, b) => a.tripIndex - b.tripIndex);
    return { order: wps.map((w) => w.inputIndex - 1) };
  } catch {
    return { order: nearestNeighbourOrder(start, stops) };
  }
}

/** Heurystyka najbliższego sąsiada — fallback bez sieci / dla wielu punktów. */
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

/* ----------------------- DIRECTIONS (OSRM /route) ----------------------------- */

export async function getDirections(
  points: LngLat[],
  stopIds: string[],
): Promise<RouteLeg[]> {
  if (points.length < 2) return [];
  try {
    const coords = points.map((c) => `${c.lng},${c.lat}`).join(';');
    const params = new URLSearchParams({
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      annotations: 'distance',
    });
    const res = await fetch(
      `${OSRM_URL}/route/v1/driving/${coords}?${params.toString()}`,
    );
    if (!res.ok) throw new Error(`OSRM route HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) {
      throw new Error(`OSRM: ${data.code ?? 'brak trasy'}`);
    }
    const route = data.routes[0];
    const ids = ['start', ...stopIds];

    return route.legs.map((leg: any, i: number): RouteLeg => {
      const steps: ManeuverStep[] = (leg.steps ?? []).map((s: any): ManeuverStep => {
        const loc = s.maneuver?.location ?? [0, 0];
        const { instruction, voice } = osrmStepToPl(s);
        return {
          instruction,
          voiceInstruction: voice,
          maneuverLng: loc[0],
          maneuverLat: loc[1],
          distanceMeters: s.distance ?? 0,
          type: s.maneuver?.type ?? 'turn',
          modifier: s.maneuver?.modifier,
        };
      });

      const legCoords: number[][] = [];
      for (const s of leg.steps ?? []) {
        const c = s.geometry?.coordinates ?? [];
        if (legCoords.length && c.length) legCoords.push(...c.slice(1));
        else legCoords.push(...c);
      }
      const geometry: LineString = {
        type: 'LineString',
        coordinates: legCoords.length
          ? legCoords
          : [
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
  } catch {
    return mockDirections(points, stopIds);
  }
}

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

/* ---------------- OSRM maneuver → instrukcja po polsku ---------------- */

const MOD_PL: Record<string, string> = {
  left: 'w lewo',
  right: 'w prawo',
  'slight left': 'lekko w lewo',
  'slight right': 'lekko w prawo',
  'sharp left': 'ostro w lewo',
  'sharp right': 'ostro w prawo',
  straight: 'prosto',
  uturn: 'zawróć',
};

function osrmStepToPl(step: any): { instruction: string; voice: string } {
  const m = step.maneuver ?? {};
  const type: string = m.type ?? 'turn';
  const modifier: string = m.modifier ?? '';
  const road: string = step.name ? ` w ${step.name}` : '';
  const modPl = MOD_PL[modifier] ?? '';

  let instruction = '';
  switch (type) {
    case 'depart':
      instruction = step.name ? `Rusz, jedź ${step.name}` : 'Rozpocznij trasę';
      break;
    case 'arrive':
      instruction = 'Dotarłeś do celu';
      break;
    case 'turn':
    case 'end of road':
      instruction = modifier === 'uturn' ? 'Zawróć' : `Skręć ${modPl}${road}`;
      break;
    case 'new name':
    case 'continue':
      instruction = step.name ? `Jedź dalej ${step.name}` : 'Jedź prosto';
      break;
    case 'merge':
      instruction = `Włącz się do ruchu${modPl ? ` ${modPl}` : ''}`;
      break;
    case 'on ramp':
      instruction = `Wjedź na drogę${road}`;
      break;
    case 'off ramp':
      instruction = `Zjedź${modPl ? ` ${modPl}` : ''}${road}`;
      break;
    case 'fork':
      instruction = `Trzymaj się ${modifier.includes('left') ? 'lewej' : 'prawej'}${road}`;
      break;
    case 'roundabout':
    case 'rotary':
      instruction = m.exit
        ? `Na rondzie zjedź ${m.exit}. zjazdem${road}`
        : `Wjedź na rondo${road}`;
      break;
    default:
      instruction = modPl ? `Skręć ${modPl}${road}` : `Jedź dalej${road}`;
  }
  return { instruction, voice: instruction };
}

/* --------------------------- MOCKI (fallback) ------------------------------ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockGeocode(query: string): GeocodeResult[] {
  const base = { lat: 53.7784, lng: 20.4801 };
  const h = hashStr(query);
  const results: GeocodeResult[] = [];
  for (let i = 0; i < 3; i++) {
    const dLat = (((h >> (i * 3)) % 200) - 100) / 5000;
    const dLng = (((h >> (i * 3 + 1)) % 200) - 100) / 3000;
    results.push({
      label: `${query}${i === 0 ? '' : ` (wariant ${i + 1})`}`,
      address: `${query} (offline — brak połączenia z Nominatim)`,
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
    const dur = (dist / 11.1) * 1.3;
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
    const dir = brg > 45 && brg < 135 ? 'wschód' : brg >= 135 && brg < 225 ? 'południe' : brg >= 225 && brg < 315 ? 'zachód' : 'północ';
    const steps: ManeuverStep[] = [
      {
        instruction: `Jedź na ${dir}`,
        voiceInstruction: `Jedź na ${dir} przez ${Math.round(dist)} metrów`,
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
