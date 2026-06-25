// Podsumowanie końca dnia — raport tekstowy z trasy (POD/COD/paczki/wyniki).
import type { Trip } from '../types';
import {
  formatDistance,
  formatDuration,
  formatDateTimePl,
  formatMoney,
} from './format';

const OUTCOME_LABEL: Record<string, string> = {
  delivered: 'Dostarczono',
  failed: 'Nieudane',
  partial: 'Częściowo',
};

export function buildDayReport(
  trip: Trip,
  opts: { driverName?: string; currency?: string } = {},
): string {
  const currency = opts.currency ?? 'PLN';
  const ordered = [...trip.stops].sort((a, b) => a.order - b.order);
  const stopsDone = ordered.filter((s) => s.completed).length;
  const stopsSkipped = ordered.filter((s) => s.skipped).length;
  const tasksTotal = ordered.reduce((a, s) => a + s.tasks.length, 0);
  const tasksDone = ordered.reduce((a, s) => a + s.tasks.filter((t) => t.done).length, 0);
  const parcelsTotal = ordered.reduce((a, s) => a + (s.parcels?.length ?? 0), 0);
  const parcelsScanned = ordered.reduce(
    (a, s) => a + (s.parcels?.filter((p) => p.scanned).length ?? 0),
    0,
  );
  const codTotal = ordered.reduce((a, s) => a + (s.codAmount ?? 0), 0);
  const codCollected = ordered.reduce(
    (a, s) => a + (s.codCollected ? s.codAmount ?? 0 : 0),
    0,
  );

  const lines: string[] = [];
  lines.push(`📋 RAPORT DNIA — ${trip.name}`);
  lines.push(`Data: ${formatDateTimePl(trip.date)}`);
  if (opts.driverName) lines.push(`Kierowca: ${opts.driverName}`);
  lines.push('');
  lines.push(
    `Trasa: ${formatDistance(trip.totalDistanceMeters)} • ${formatDuration(
      trip.totalDurationSeconds,
    )}`,
  );
  lines.push(
    `Przystanki: ${stopsDone}/${ordered.length} zrobione` +
      (stopsSkipped ? `, ${stopsSkipped} pominięte` : ''),
  );
  lines.push(
    `Zadania: ${tasksDone}/${tasksTotal}` +
      (tasksTotal ? ` (${Math.round((tasksDone / tasksTotal) * 100)}%)` : ''),
  );
  if (parcelsTotal > 0) lines.push(`Paczki: ${parcelsScanned}/${parcelsTotal} zeskanowane`);
  if (codTotal > 0)
    lines.push(
      `Pobrania: ${formatMoney(codCollected, currency)} / ${formatMoney(codTotal, currency)}`,
    );
  lines.push('');

  ordered.forEach((s, i) => {
    const mark = s.completed ? '✅' : s.skipped ? '⏭' : s.arrived ? '🟡' : '⬜';
    lines.push(`${mark} ${i + 1}. ${s.label} — ${s.address}`);
    if (s.outcome) lines.push(`     ↳ wynik: ${OUTCOME_LABEL[s.outcome]}${s.outcomeReason ? ` (${s.outcomeReason})` : ''}`);
    if (s.skipped && s.skipReason && s.outcome !== 'failed')
      lines.push(`     ↳ pominięto: ${s.skipReason}`);
    if (s.recipientName) lines.push(`     ↳ odebrał: ${s.recipientName}${s.signatureDataUrl ? ' (podpis ✍)' : ''}`);
    if (s.codAmount)
      lines.push(
        `     ↳ pobranie: ${formatMoney(s.codAmount, currency)} ${s.codCollected ? '✓ pobrane' : '✗ NIE pobrane'}`,
      );
    if (s.arrivedAt) lines.push(`     ↳ przyjazd: ${formatDateTimePl(s.arrivedAt)}`);
    (s.parcels ?? []).forEach((p) =>
      lines.push(`     📦 ${p.code}${p.label ? ` — ${p.label}` : ''} ${p.scanned ? '✓' : '✗'}`),
    );
    if (s.notes) lines.push(`     ↳ ${s.notes}`);
    s.tasks.forEach((t) =>
      lines.push(`     ${t.done ? '[x]' : '[ ]'} ${t.text}` + (t.photoUri ? ' 📷' : '')),
    );
  });

  const undone = ordered.flatMap((s) =>
    s.tasks.filter((t) => !t.done).map((t) => `• ${s.label}: ${t.text}`),
  );
  if (undone.length) {
    lines.push('');
    lines.push('⚠️ Niewykonane zadania:');
    lines.push(...undone);
  }

  return lines.join('\n');
}
