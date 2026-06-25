import { describe, it, expect } from 'vitest';
import { serializeTrips, parseTrips } from './backup';
import type { Trip } from '../types';

const trip: Trip = {
  id: 't1',
  name: 'Trasa',
  date: '2026-06-25T08:00:00.000Z',
  status: 'completed',
  stops: [
    {
      id: 's1',
      label: 'A',
      address: 'ul. A',
      lat: 53.78,
      lng: 20.48,
      order: 0,
      arrived: true,
      completed: true,
      tasks: [{ id: 'k', text: 'x', done: true }],
    },
  ],
  legs: [],
  totalDistanceMeters: 1000,
  totalDurationSeconds: 120,
  createdAt: '2026-06-25T08:00:00.000Z',
};

describe('backup', () => {
  it('round-trip serialize → parse zachowuje trasy', () => {
    const json = serializeTrips([trip]);
    const back = parseTrips(json);
    expect(back).not.toBeNull();
    expect(back!).toHaveLength(1);
    expect(back![0].id).toBe('t1');
    expect(back![0].stops[0].tasks[0].done).toBe(true);
  });
  it('akceptuje goły array', () => {
    expect(parseTrips(JSON.stringify([trip]))!).toHaveLength(1);
  });
  it('odrzuca śmieci', () => {
    expect(parseTrips('nie-json')).toBeNull();
    expect(parseTrips('{"foo":1}')).toBeNull();
  });
  it('odfiltrowuje nieprawidłowe wpisy', () => {
    const mixed = JSON.stringify({ trips: [trip, { bad: true }, { id: 'x' }] });
    expect(parseTrips(mixed)!).toHaveLength(1);
  });
});
