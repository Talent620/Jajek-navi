// Formatowanie czasu i dystansu w języku polskim.

export function formatDistance(meters: number): string {
  if (!isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${total} s`;
}

/** ETA jako godzina przybycia (HH:MM) od teraz + sekundy. */
export function formatEta(seconds: number, from: Date = new Date()): string {
  if (!isFinite(seconds) || seconds < 0) return '—';
  const eta = new Date(from.getTime() + seconds * 1000);
  const hh = String(eta.getHours()).padStart(2, '0');
  const mm = String(eta.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Prędkość m/s -> km/h. */
export function formatSpeed(metersPerSecond: number | null | undefined): string {
  if (metersPerSecond == null || !isFinite(metersPerSecond) || metersPerSecond < 0)
    return '0 km/h';
  return `${Math.round(metersPerSecond * 3.6)} km/h`;
}

export function formatMoney(amount: number, currency = 'PLN'): string {
  if (!isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatClock(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatDateTimePl(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
