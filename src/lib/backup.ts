// Backup / przywracanie tras — serializacja do/z JSON.
import type { Trip } from '../types';

const APP_TAG = 'jajek-navi';

export function serializeTrips(trips: Trip[]): string {
  return JSON.stringify(
    { app: APP_TAG, version: 1, exportedAt: new Date().toISOString(), trips },
    null,
    2,
  );
}

/** Parsuje backup. Akceptuje {trips:[...]} lub goły array tras. Zwraca null gdy nieprawidłowy. */
export function parseTrips(json: string): Trip[] | null {
  try {
    const data = JSON.parse(json);
    const trips = Array.isArray(data) ? data : data?.trips;
    if (!Array.isArray(trips)) return null;
    return trips.filter((t) => t && typeof t.id === 'string' && Array.isArray(t.stops));
  } catch {
    return null;
  }
}
