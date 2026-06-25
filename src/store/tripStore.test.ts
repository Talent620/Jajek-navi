import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from './tripStore';

function resetStore() {
  useTripStore.setState({ trips: [], currentTripId: null, building: false, error: null });
}

describe('tripStore — POD / completion', () => {
  beforeEach(resetStore);

  it('„Dostarczono" (setOutcome delivered) oznacza przystanek jako completed', () => {
    const s = useTripStore.getState();
    s.createTrip('Test');
    s.addStop({ label: 'A', address: 'ul. A', lat: 53.78, lng: 20.48 });
    const stopId = useTripStore.getState().current()!.stops[0].id;

    expect(useTripStore.getState().current()!.stops[0].completed).toBe(false);
    useTripStore.getState().setOutcome(stopId, 'delivered');
    const stop = useTripStore.getState().current()!.stops[0];
    expect(stop.outcome).toBe('delivered');
    expect(stop.completed).toBe(true); // KLUCZOWE: regresja naprawiona
  });

  it('„Nieudane" oznacza przystanek jako pominięty (skipped)', () => {
    const s = useTripStore.getState();
    s.createTrip('Test2');
    s.addStop({ label: 'B', address: 'ul. B', lat: 53.79, lng: 20.49 });
    const stopId = useTripStore.getState().current()!.stops[0].id;
    useTripStore.getState().setOutcome(stopId, 'failed', 'Klient nieobecny');
    const stop = useTripStore.getState().current()!.stops[0];
    expect(stop.skipped).toBe(true);
    expect(stop.skipReason).toBe('Klient nieobecny');
  });

  it('odhaczenie wszystkich zadań ustawia completed', () => {
    const s = useTripStore.getState();
    s.createTrip('Test3');
    s.addStop({ label: 'C', address: 'ul. C', lat: 53.7, lng: 20.4 });
    const stopId = useTripStore.getState().current()!.stops[0].id;
    useTripStore.getState().addTask(stopId, 'Zadanie 1');
    const taskId = useTripStore.getState().current()!.stops[0].tasks[0].id;
    expect(useTripStore.getState().current()!.stops[0].completed).toBe(false);
    useTripStore.getState().toggleTask(stopId, taskId, true);
    expect(useTripStore.getState().current()!.stops[0].completed).toBe(true);
  });

  it('powiel trasę: nowe id, wyczyszczony postęp, status planned', () => {
    const s = useTripStore.getState();
    s.createTrip('Oryginał');
    s.addStop({ label: 'A', address: 'ul. A', lat: 53.78, lng: 20.48 });
    const orig = useTripStore.getState().current()!;
    const stopId = orig.stops[0].id;
    useTripStore.getState().addTask(stopId, 'Zadanie');
    const taskId = useTripStore.getState().current()!.stops[0].tasks[0].id;
    useTripStore.getState().toggleTask(stopId, taskId, true);
    useTripStore.getState().setOutcome(stopId, 'delivered');

    const newId = useTripStore.getState().duplicateTrip(orig.id);
    expect(newId).not.toBeNull();
    const copy = useTripStore.getState().trips.find((t) => t.id === newId)!;
    expect(copy.id).not.toBe(orig.id);
    expect(copy.stops[0].id).not.toBe(stopId);
    expect(copy.name).toContain('(kopia)');
    expect(copy.status).toBe('planned');
    expect(copy.stops[0].completed).toBe(false);
    expect(copy.stops[0].outcome).toBeUndefined();
    expect(copy.stops[0].tasks[0].done).toBe(false);
    expect(copy.stops[0].tasks[0].text).toBe('Zadanie'); // definicja zachowana
  });

  it('reset postępu trasy czyści wykonanie, zachowuje definicję', () => {
    const s = useTripStore.getState();
    s.createTrip('Trasa');
    s.addStop({ label: 'A', address: 'ul. A', lat: 53.78, lng: 20.48 });
    const trip = useTripStore.getState().current()!;
    const stopId = trip.stops[0].id;
    useTripStore.getState().addTask(stopId, 'Z');
    const taskId = useTripStore.getState().current()!.stops[0].tasks[0].id;
    useTripStore.getState().toggleTask(stopId, taskId, true);
    useTripStore.getState().completeTrip();

    useTripStore.getState().resetTripProgress(trip.id);
    const after = useTripStore.getState().trips.find((t) => t.id === trip.id)!;
    expect(after.status).toBe('planned');
    expect(after.stops[0].completed).toBe(false);
    expect(after.stops[0].tasks[0].done).toBe(false);
    expect(after.stops[0].tasks).toHaveLength(1); // definicja zadania została
  });

  it('unikalne identyfikatory przy szybkim dodawaniu', () => {
    const s = useTripStore.getState();
    s.createTrip('Test4');
    for (let i = 0; i < 50; i++) {
      useTripStore.getState().addStop({ label: `S${i}`, address: 'x', lat: 53, lng: 20 });
    }
    const ids = useTripStore.getState().current()!.stops.map((st) => st.id);
    expect(new Set(ids).size).toBe(ids.length); // brak kolizji
  });
});
