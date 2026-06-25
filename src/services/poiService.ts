// Wyszukiwanie POI w pobliżu (paliwo / parking / jedzenie / WC) — Overpass API
// (OpenStreetMap, bez klucza). Przydatne dla kierowcy: najbliższa stacja itp.
import type { LngLat } from '../types';
import { haversine } from '../lib/navigation/geo';

export type PoiKind = 'fuel' | 'parking' | 'food' | 'toilets' | 'atm';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  distanceMeters: number;
}

const KIND_QUERY: Record<PoiKind, string> = {
  fuel: 'node(around:RADIUS,LAT,LNG)[amenity=fuel];',
  parking: 'node(around:RADIUS,LAT,LNG)[amenity=parking];',
  food: 'node(around:RADIUS,LAT,LNG)[amenity~"restaurant|fast_food|cafe"];',
  toilets: 'node(around:RADIUS,LAT,LNG)[amenity=toilets];',
  atm: 'node(around:RADIUS,LAT,LNG)[amenity~"atm|bank"];',
};

export const KIND_LABEL: Record<PoiKind, { label: string; icon: string }> = {
  fuel: { label: 'Paliwo', icon: '⛽' },
  parking: { label: 'Parking', icon: '🅿️' },
  food: { label: 'Jedzenie', icon: '🍔' },
  toilets: { label: 'Toaleta', icon: '🚻' },
  atm: { label: 'Bankomat', icon: '🏧' },
};

/** Sortuje i przycina wyniki wg odległości — czysta funkcja (testowalna). */
export function sortByDistance(pois: Poi[], limit = 5): Poi[] {
  return [...pois].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
}

export async function findNearby(
  center: LngLat,
  kind: PoiKind,
  radiusMeters = 4000,
): Promise<Poi[]> {
  try {
    const q = KIND_QUERY[kind]
      .replace('RADIUS', String(radiusMeters))
      .replace('LAT', String(center.lat))
      .replace('LNG', String(center.lng));
    const body = `[out:json][timeout:15];(${q});out body 20;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pois: Poi[] = (data.elements ?? [])
      .filter((e: any) => e.lat && e.lon)
      .map((e: any): Poi => ({
        id: String(e.id),
        name: e.tags?.name || e.tags?.brand || KIND_LABEL[kind].label,
        kind,
        lat: e.lat,
        lng: e.lon,
        distanceMeters: haversine(center, { lat: e.lat, lng: e.lon }),
      }));
    return sortByDistance(pois, 6);
  } catch {
    return [];
  }
}
