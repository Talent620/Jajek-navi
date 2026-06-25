// Śledzenie pozycji GPS + tryb symulacji (mock GPS) do testów nawigacji.
// Realny GPS: @capacitor/geolocation (native) / Web Geolocation (przeglądarka).
// Tło: @capacitor-community/background-geolocation (foreground service) — patrz README.
import type { Fix, RouteLeg } from '../types';
import { combinedRouteCoords } from '../lib/navigation/offroute';
import { pointAlongPolyline, polylineLength } from '../lib/navigation/geo';

export type FixCallback = (fix: Fix) => void;

interface GeolocationPlugin {
  getCurrentPosition(opts: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<any>;
  watchPosition(
    opts: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
    cb: (pos: any, err: any) => void,
  ): Promise<string>;
  clearWatch(opts: { id: string }): Promise<void>;
  requestPermissions(): Promise<{ location: string; coarseLocation?: string }>;
  checkPermissions(): Promise<{ location: string }>;
}

function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

async function loadGeo(): Promise<GeolocationPlugin | null> {
  try {
    const mod = await import('@capacitor/geolocation');
    return mod.Geolocation as unknown as GeolocationPlugin;
  } catch {
    return null;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  if (isNative()) {
    const geo = await loadGeo();
    if (geo) {
      try {
        const res = await geo.requestPermissions();
        return res.location === 'granted';
      } catch {
        return false;
      }
    }
  }
  // Przeglądarka: uprawnienia są pytane przy pierwszym watchPosition.
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Jednorazowy odczyt pozycji — najpewniejszy sposób na „moją lokalizację".
 * Próbuje: niska dokładność (szybko) → wysoka dokładność. Zwraca null gdy się nie uda.
 */
export async function getCurrentFix(timeoutMs = 15000): Promise<Fix | null> {
  // 1) Natywny plugin Capacitor
  if (isNative()) {
    const geo = await loadGeo();
    if (geo) {
      try {
        await geo.requestPermissions();
      } catch {
        /* mimo to spróbuj odczytać */
      }
      for (const hi of [false, true]) {
        try {
          const pos = await geo.getCurrentPosition({
            enableHighAccuracy: hi,
            timeout: timeoutMs,
            maximumAge: 30000,
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
      return null;
    }
  }
  // 2) Web Geolocation
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
    const geo = await loadGeo();
    if (geo) {
      const id = await geo.watchPosition(
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
          void geo.clearWatch({ id });
        },
      };
    }
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
