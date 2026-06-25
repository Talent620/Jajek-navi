// Czyste funkcje geometryczne — bez zależności od React/Capacitor (testowalne).
import type { LngLat } from '../../types';

const R = 6371000; // promień Ziemi w metrach
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Odległość haversine między dwoma punktami w metrach. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Azymut (bearing) z punktu a do b w stopniach [0,360). */
export function bearing(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Lokalna projekcja równopromieniowa (equirectangular) względem punktu odniesienia.
 * Wystarczająco dokładna dla dystansów rzędu kilometrów; pozwala liczyć
 * odległość punkt–odcinek w metrach na płaszczyźnie.
 */
function project(p: LngLat, ref: LngLat): { x: number; y: number } {
  const x = toRad(p.lng - ref.lng) * Math.cos(toRad(ref.lat)) * R;
  const y = toRad(p.lat - ref.lat) * R;
  return { x, y };
}

/** Odległość punktu od odcinka (a–b) w metrach + parametr t rzutu [0,1]. */
export function pointToSegmentMeters(
  p: LngLat,
  a: LngLat,
  b: LngLat,
): { distance: number; t: number } {
  const pp = project(p, a);
  const bb = project(b, a);
  const len2 = bb.x * bb.x + bb.y * bb.y;
  if (len2 === 0) return { distance: Math.hypot(pp.x, pp.y), t: 0 };
  let t = (pp.x * bb.x + pp.y * bb.y) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = bb.x * t;
  const projY = bb.y * t;
  return { distance: Math.hypot(pp.x - projX, pp.y - projY), t };
}

export interface PolylineDistance {
  /** Najmniejsza odległość punktu od polilinii (metry). */
  distance: number;
  /** Indeks segmentu, na który pada rzut. */
  segmentIndex: number;
  /** Parametr rzutu na tym segmencie [0,1]. */
  t: number;
}

/**
 * Odległość punktu od polilinii liczona po WSZYSTKICH segmentach
 * (nie tylko do najbliższego wierzchołka) — sekcja 7 specyfikacji.
 * Współrzędne polilinii w formacie [lng, lat] (GeoJSON).
 */
export function distanceToPolyline(
  p: LngLat,
  coords: number[][],
): PolylineDistance {
  let best: PolylineDistance = { distance: Infinity, segmentIndex: 0, t: 0 };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lng: coords[i][0], lat: coords[i][1] };
    const b = { lng: coords[i + 1][0], lat: coords[i + 1][1] };
    const { distance, t } = pointToSegmentMeters(p, a, b);
    if (distance < best.distance) best = { distance, segmentIndex: i, t };
  }
  return best;
}

/**
 * Interpolacja punktu wzdłuż polilinii na zadanym dystansie od początku (metry).
 * Wykorzystywana przez tryb mock GPS (przejazd po geometrii trasy).
 */
export function pointAlongPolyline(
  coords: number[][],
  distanceFromStart: number,
): { point: LngLat; bearing: number; reachedEnd: boolean } {
  if (coords.length === 0) {
    return { point: { lng: 0, lat: 0 }, bearing: 0, reachedEnd: true };
  }
  if (coords.length === 1) {
    return {
      point: { lng: coords[0][0], lat: coords[0][1] },
      bearing: 0,
      reachedEnd: true,
    };
  }
  let acc = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lng: coords[i][0], lat: coords[i][1] };
    const b = { lng: coords[i + 1][0], lat: coords[i + 1][1] };
    const segLen = haversine(a, b);
    if (acc + segLen >= distanceFromStart) {
      const remain = distanceFromStart - acc;
      const t = segLen === 0 ? 0 : remain / segLen;
      return {
        point: {
          lng: a.lng + (b.lng - a.lng) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        },
        bearing: bearing(a, b),
        reachedEnd: false,
      };
    }
    acc += segLen;
  }
  const last = coords[coords.length - 1];
  const prev = coords[coords.length - 2];
  return {
    point: { lng: last[0], lat: last[1] },
    bearing: bearing({ lng: prev[0], lat: prev[1] }, { lng: last[0], lat: last[1] }),
    reachedEnd: true,
  };
}

/** Łączna długość polilinii w metrach. */
export function polylineLength(coords: number[][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversine(
      { lng: coords[i][0], lat: coords[i][1] },
      { lng: coords[i + 1][0], lat: coords[i + 1][1] },
    );
  }
  return total;
}
