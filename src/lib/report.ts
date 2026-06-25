// Podsumowanie końca dnia — raport tekstowy z trasy (sekcja 4.6).
import type { Trip } from '../types';
import { formatDistance, formatDuration, formatDateTimePl } from './format';

export function buildDayReport(trip: Trip): string {
  const ordered = [...trip.stops].sort((a, b) => a.order - b.order);
  const stopsDone = ordered.filter((s) => s.completed).length;
  const stopsSkipped = ordered.filter((s) => s.skipped).length;
  const tasksTotal = ordered.reduce((a, s) => a + s.tasks.length, 0);
  const tasksDone = ordered.reduce((a, s) => a + s.tasks.filter((t) => t.done).length, 0);

  const lines: string[] = [];
  lines.push(`📋 RAPORT DNIA — ${trip.name}`);
  lines.push(`Data: ${formatDateTimePl(trip.date)}`);
  lines.push('');
  lines.push(`Trasa: ${formatDistance(trip.totalDistanceMeters)} • ${formatDuration(
    trip.totalDurationSeconds,
  )}`);
  lines.push(`Przystanki: ${stopsDone}/${ordered.length} zrobione` +
    (stopsSkipped ? `, ${stopsSkipped} pominięte` : ''));
  lines.push(
    `Zadania: ${tasksDone}/${tasksTotal}` +
      (tasksTotal ? ` (${Math.round((tasksDone / tasksTotal) * 100)}%)` : ''),
  );
  lines.push('');

  ordered.forEach((s, i) => {
    const mark = s.completed ? '✅' : s.skipped ? '⏭' : s.arrived ? '🟡' : '⬜';
    lines.push(`${mark} ${i + 1}. ${s.label} — ${s.address}`);
    if (s.skipped && s.skipReason) lines.push(`     ↳ pominięto: ${s.skipReason}`);
    if (s.notes) lines.push(`     ↳ ${s.notes}`);
    s.tasks.forEach((t) => {
      lines.push(`     ${t.done ? '[x]' : '[ ]'} ${t.text}` + (t.photoUri ? ' 📷' : ''));
    });
  });

  // Niewykonane zadania — zbiorczo
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
