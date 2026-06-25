import { describe, it, expect } from 'vitest';
import { buildDayReport } from './report';
import { formatMoney, formatClock } from './format';
import type { Trip } from '../types';

function makeTrip(): Trip {
  const now = '2026-06-25T08:00:00.000Z';
  return {
    id: 't1',
    name: 'Trasa testowa',
    date: now,
    status: 'completed',
    stops: [
      {
        id: 's1',
        label: 'Klient A',
        address: 'ul. Testowa 1',
        lat: 53.78,
        lng: 20.48,
        order: 0,
        arrived: true,
        arrivedAt: now,
        completed: true,
        outcome: 'delivered',
        recipientName: 'Jan Kowalski',
        signatureDataUrl: 'data:image/png;base64,AAA',
        codAmount: 150,
        codCollected: true,
        parcels: [
          { id: 'p1', code: 'PL123', scanned: true },
          { id: 'p2', code: 'PL124', scanned: false },
        ],
        tasks: [{ id: 'k1', text: 'Podpis', done: true }],
      },
      {
        id: 's2',
        label: 'Klient B',
        address: 'ul. Testowa 2',
        lat: 53.79,
        lng: 20.49,
        order: 1,
        arrived: true,
        completed: false,
        skipped: true,
        outcome: 'failed',
        outcomeReason: 'Klient nieobecny',
        codAmount: 50,
        codCollected: false,
        tasks: [],
        parcels: [],
      },
    ],
    legs: [],
    totalDistanceMeters: 12000,
    totalDurationSeconds: 1800,
    createdAt: now,
  };
}

describe('formatMoney', () => {
  it('formatuje PLN', () => {
    const s = formatMoney(150, 'PLN');
    expect(s).toContain('150');
  });
  it('obsługuje nieprawidłową walutę bez wyjątku', () => {
    expect(typeof formatMoney(10, 'XXX')).toBe('string');
  });
});

describe('formatClock', () => {
  it('zlicza godziny:minuty', () => {
    expect(formatClock(3 * 3600 + 25 * 60)).toBe('3:25');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-100)).toBe('0:00');
  });
});

describe('buildDayReport', () => {
  const report = buildDayReport(makeTrip(), { driverName: 'Anna Nowak', currency: 'PLN' });

  it('zawiera kierowcę i podsumowanie pobrań', () => {
    expect(report).toContain('Kierowca: Anna Nowak');
    expect(report).toContain('Pobrania');
  });
  it('pokazuje wynik dostawy i odbiorcę', () => {
    expect(report).toContain('Dostarczono');
    expect(report).toContain('odebrał: Jan Kowalski');
    expect(report).toContain('Nieudane');
    expect(report).toContain('Klient nieobecny');
  });
  it('wypisuje paczki z oznaczeniem skanu', () => {
    expect(report).toContain('PL123');
    expect(report).toMatch(/PL124.*✗/);
  });
  it('liczy pobranie tylko z oznaczonych jako pobrane', () => {
    // 150 pobrane z 200 łącznie
    expect(report).toMatch(/150/);
    expect(report).toMatch(/200/);
  });
});
