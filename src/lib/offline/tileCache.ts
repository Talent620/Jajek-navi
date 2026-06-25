// Tryb offline mapy — prefetch kafli wzdłuż trasy do Cache Storage.
// Serwowaniem offline zajmuje się Service Worker (public/sw.js). Tu liczymy
// listę kafli korytarza trasy i pobieramy je z kontrolą współbieżności.
import type { RouteLeg } from '../../types';
import { combinedRouteCoords } from '../navigation/offroute';

const CACHE = 'jajek-tiles';
export type MapStyle = 'dark' | 'light' | 'satellite';

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

// UWAGA: jeden subdomena/host, by URL-e były identyczne jak w MapView (cache hit).
function tileUrl(style: MapStyle, z: number, x: number, y: number): string {
  if (style === 'satellite')
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const layer = style === 'light' ? 'light_all' : 'dark_all';
  return `https://a.basemaps.cartocdn.com/${layer}/${z}/${x}/${y}.png`;
}

export interface TilePlan {
  urls: string[];
  estBytes: number;
  capped: boolean;
}

/** Kafle korytarza trasy (punkty + sąsiedzi) dla zakresu zoomów. */
export function routeTileUrls(
  legs: RouteLeg[],
  style: MapStyle,
  zooms = [11, 12, 13, 14, 15],
  maxTiles = 1800,
): TilePlan {
  const coords = combinedRouteCoords(legs);
  const set = new Set<string>();
  if (coords.length >= 2) {
    for (const z of zooms) {
      const n = 2 ** z;
      for (const [lng, lat] of coords) {
        const t = lngLatToTile(lng, lat, z);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++) {
            const x = t.x + dx;
            const y = t.y + dy;
            if (x < 0 || y < 0 || x >= n || y >= n) continue; // poza zakresem
            set.add(tileUrl(style, z, x, y));
          }
      }
    }
  }
  let urls = [...set];
  const capped = urls.length > maxTiles;
  if (capped) urls = urls.slice(0, maxTiles); // ogranicz rozmiar pobrania
  return { urls, estBytes: urls.length * 16_000, capped };
}

export interface PrefetchResult {
  total: number;
  ok: number;
  failed: number;
}

/** Pobiera kafle do Cache Storage (SW serwuje je offline). */
export async function prefetchRouteTiles(
  legs: RouteLeg[],
  style: MapStyle,
  onProgress?: (done: number, total: number) => void,
): Promise<PrefetchResult> {
  if (typeof caches === 'undefined') return { total: 0, ok: 0, failed: 0 };
  const { urls } = routeTileUrls(legs, style);
  const cache = await caches.open(CACHE);
  let done = 0;
  let ok = 0;
  let failed = 0;
  let idx = 0;
  const POOL = 6;

  const worker = async () => {
    while (idx < urls.length) {
      const u = urls[idx++];
      try {
        const existing = await cache.match(u);
        if (existing) {
          ok++;
        } else {
          // CORS (nie no-cors), by móc sprawdzić status i nie cache'ować 404.
          const res = await fetch(u, { mode: 'cors' });
          if (res.ok) {
            await cache.put(u, res);
            ok++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      }
      done++;
      onProgress?.(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: POOL }, () => worker()));
  return { total: urls.length, ok, failed };
}

export async function clearTileCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(CACHE);
}

export async function tileCacheCount(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(CACHE);
    return (await cache.keys()).length;
  } catch {
    return 0;
  }
}
