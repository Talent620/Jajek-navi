// Śledzenie pozycji GPS + tryb symulacji (mock GPS) do testów nawigacji.
// Realny GPS: @capacitor/geolocation (native) / Web Geolocation (przeglądarka).
// Tło: @capacitor-community/background-geolocation (foreground service) — patrz README.
import type { Fix, RouteLeg } from '../types';
import { combinedRouteCoords } from '../lib/navigation/offroute';
import { pointAlongPolyline, polylineLength } from '../lib/navigation/geo';
// Import STATYCZNY pluginu — gwarantuje, że jest w paczce i dostępny od razu
// (dynamiczny import potrafił zawieść w WebView → brak okna zgody i lokalizacji).
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type FixCallback = (fix: Fix) => void;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Pełen przebieg uprawnień lokalizacji na urządzeniu (z oknem systemowym). */
export async function ensureLocationPermission(): Promise<'granted' | 'denied' | 'web'> {
  if (!isNative()) return 'web';
  try {
    const cur = await Geolocation.checkPermissions();
    if (cur.location === 'granted' || cur.coarseLocation === 'granted') return 'granted';
    const req = await Geolocation.requestPermissions();
    return req.location === 'granted' || req.coarseLocation === 'granted'
      ? 'granted'
      : 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  const state = await ensureLocationPermission();
  if (state === 'web') return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  return state === 'granted';
}

/**
 * Jednorazowy odczyt pozycji — najpewniejszy sposób na „moją lokalizację".
 * Próbuje: niska dokładność (szybko) → wysoka dokładność. Zwraca null gdy się nie uda.
 */
export async function getCurrentFix(timeoutMs = 15000): Promise<Fix | null> {
  // 1) Plugin Capacitor na urządzeniu — pokazuje systemowe okno zgody.
  if (isNative()) {
    await ensureLocationPermission();
    for (const hi of [false, true]) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: hi,
          timeout: timeoutMs,
          // na próbie wysokiej dokładności wymuś świeży pomiar (nie cache)
          maximumAge: hi ? 0 : 30000,
        });
        if (pos?.coords) {
          return {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          };
        }
      } catch {
        /* spróbuj kolejny wariant */
      }
    }
  }
  // 2) Ostateczny fallback: surowe Web Geolocation API
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    return new Promise<Fix | null>((resolve) => {
      let done = false;
      const finish = (f: Fix | null) => {
        if (!done) {
          done = true;
          resolve(f);
        }
      };
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          finish({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          }),
        () => finish(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
      );
      setTimeout(() => finish(null), timeoutMs + 1000);
    });
  }
  return null;
}

export interface Tracker {
  stop(): void;
}

/** Uruchamia śledzenie realnego GPS i woła cb przy każdym pomiarze. */
export async function startTracking(
  cb: FixCallback,
  onError?: (e: string) => void,
): Promise<Tracker> {
  if (isNative()) {
    await ensureLocationPermission();
    const id = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
      (pos, err) => {
        if (err) {
          onError?.(String(err.message ?? err));
          return;
        }
        if (!pos) return;
        cb({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
    );
    return {
      stop() {
        void Geolocation.clearWatch({ id });
      },
    };
  }

  // Fallback: Web Geolocation API
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        cb({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        }),
      (err) => onError?.(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
    );
    return {
      stop() {
        navigator.geolocation.clearWatch(id);
      },
    };
  }

  onError?.('Brak dostępu do GPS');
  return { stop() {} };
}

/**
 * MOCK GPS — odtwarza przejazd wzdłuż geometrii trasy (sekcja 7).
 * Pozwala testować nawigację bez wychodzenia na drogę.
 */
export function startMockDrive(
  legs: RouteLeg[],
  cb: FixCallback,
  opts?: { speedMps?: number; intervalMs?: number; onFinish?: () => void },
): Tracker {
  const coords = combinedRouteCoords(legs);
  if (coords.length < 2) {
    return { stop() {} }; // brak trasy — nic nie symuluj
  }
  const total = polylineLength(coords);
  const speed = opts?.speedMps ?? 13.9; // ~50 km/h
  const interval = opts?.intervalMs ?? 1000;
  let distance = 0;
  let prevPoint = coords.length ? { lng: coords[0][0], lat: coords[0][1] } : null;

  const timer = setInterval(() => {
    distance += (speed * interval) / 1000;
    const { point, bearing: brg, reachedEnd } = pointAlongPolyline(coords, distance);
    cb({
      lat: point.lat,
      lng: point.lng,
      accuracy: 5,
      heading: brg,
      speed,
      timestamp: Date.now(),
    });
    prevPoint = point;
    if (reachedEnd || distance >= total) {
      clearInterval(timer);
      opts?.onFinish?.();
    }
  }, interval);

  // Pierwszy pomiar natychmiast
  if (prevPoint) {
    cb({ lat: prevPoint.lat, lng: prevPoint.lng, accuracy: 5, heading: 0, speed: 0, timestamp: Date.now() });
  }

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
