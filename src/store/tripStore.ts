import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { capacitorStorage } from '../services/storageService';
import type { Stop, Task, Trip, LngLat, Parcel, DeliveryOutcome } from '../types';
import {
  getDirections,
  optimizeOrder,
  pointsFromStops,
} from '../services/mapboxService';

let _uidCounter = 0;
function uid(prefix = ''): string {
  // Preferuj crypto.randomUUID (dostępne w WebView/przeglądarce), z fallbackiem
  // na czas + licznik monotoniczny — bez ryzyka kolizji przy szybkim dodawaniu.
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}${(crypto as Crypto).randomUUID()}`;
    }
  } catch {
    /* fallback */
  }
  _uidCounter = (_uidCounter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${_uidCounter.toString(36)}`;
}

interface TripState {
  trips: Trip[];
  currentTripId: string | null;
  building: boolean;
  error: string | null;

  // --- selektory pomocnicze ---
  current: () => Trip | null;

  // --- zarządzanie trasą ---
  createTrip: (name?: string) => string;
  deleteTrip: (tripId: string) => void;
  setCurrent: (tripId: string | null) => void;
  renameTrip: (tripId: string, name: string) => void;
  setStart: (lat: number, lng: number) => void;

  // --- przystanki ---
  addStop: (s: Omit<Stop, 'id' | 'order' | 'arrived' | 'completed' | 'tasks'> & {
    tasks?: Task[];
  }) => void;
  removeStop: (stopId: string) => void;
  updateStopNotes: (stopId: string, notes: string) => void;
  reorderStops: (orderedIds: string[]) => void;
  markArrived: (stopId: string) => void;
  skipStop: (stopId: string, reason: string) => void;
  unskipStop: (stopId: string) => void;
  updateStop: (stopId: string, patch: Partial<Stop>) => void;

  // --- POD / kontakt / pobranie (busiarz) ---
  setStopContact: (stopId: string, contactName: string, phone: string) => void;
  setStopWindow: (stopId: string, start: string, end: string) => void;
  setStopCod: (stopId: string, amount: number | undefined) => void;
  collectCod: (stopId: string, collected: boolean) => void;
  addParcel: (stopId: string, code: string, label?: string) => void;
  removeParcel: (stopId: string, parcelId: string) => void;
  setParcelScanned: (stopId: string, parcelId: string, scanned: boolean) => void;
  scanParcelByCode: (code: string) => { stopId: string; label: string } | null;
  setRecipient: (stopId: string, recipientName: string) => void;
  setSignature: (stopId: string, dataUrl: string) => void;
  setOutcome: (stopId: string, outcome: DeliveryOutcome, reason?: string) => void;

  // --- zadania ---
  addTask: (stopId: string, text: string) => void;
  removeTask: (stopId: string, taskId: string) => void;
  toggleTask: (stopId: string, taskId: string, done?: boolean) => void;
  setTaskNote: (stopId: string, taskId: string, note: string) => void;
  setTaskPhoto: (stopId: string, taskId: string, photoUri: string) => void;

  // --- routing ---
  optimize: () => Promise<void>;
  buildRoute: () => Promise<void>;

  // --- cykl życia ---
  startTrip: () => void;
  completeTrip: () => void;
}

function recomputeCompletion(stop: Stop): Stop {
  // Dostawa oznaczona jako 'delivered' kończy przystanek niezależnie od zadań.
  if (stop.outcome === 'delivered') return { ...stop, completed: true };
  const completed =
    stop.tasks.length > 0 ? stop.tasks.every((t) => t.done) : stop.arrived;
  return { ...stop, completed };
}

function patchCurrent(state: TripState, fn: (t: Trip) => Trip): Partial<TripState> {
  const id = state.currentTripId;
  if (!id) return {};
  return {
    trips: state.trips.map((t) => (t.id === id ? fn(t) : t)),
  };
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trips: [],
      currentTripId: null,
      building: false,
      error: null,

      current: () => {
        const { trips, currentTripId } = get();
        return trips.find((t) => t.id === currentTripId) ?? null;
      },

      createTrip: (name) => {
        const id = uid('trip_');
        const now = new Date().toISOString();
        const trip: Trip = {
          id,
          name: name?.trim() || `Trasa ${new Date().toLocaleDateString('pl-PL')}`,
          date: now,
          status: 'planned',
          stops: [],
          legs: [],
          totalDistanceMeters: 0,
          totalDurationSeconds: 0,
          createdAt: now,
        };
        set((s) => ({ trips: [trip, ...s.trips], currentTripId: id }));
        return id;
      },

      deleteTrip: (tripId) =>
        set((s) => ({
          trips: s.trips.filter((t) => t.id !== tripId),
          currentTripId:
            s.currentTripId === tripId ? null : s.currentTripId,
        })),

      setCurrent: (tripId) => set({ currentTripId: tripId }),

      renameTrip: (tripId, name) =>
        set((s) => ({
          trips: s.trips.map((t) => (t.id === tripId ? { ...t, name } : t)),
        })),

      setStart: (lat, lng) =>
        set((s) => patchCurrent(s, (t) => ({ ...t, startLat: lat, startLng: lng }))),

      addStop: (input) =>
        set((s) =>
          patchCurrent(s, (t) => {
            const stop: Stop = {
              id: uid('stop_'),
              label: input.label,
              address: input.address,
              lat: input.lat,
              lng: input.lng,
              notes: input.notes,
              order: t.stops.length,
              arrived: false,
              completed: false,
              tasks: input.tasks ?? [],
            };
            return { ...t, stops: [...t.stops, stop] };
          }),
        ),

      removeStop: (stopId) =>
        set((s) =>
          patchCurrent(s, (t) => {
            const stops = t.stops
              .filter((st) => st.id !== stopId)
              .map((st, i) => ({ ...st, order: i }));
            return { ...t, stops };
          }),
        ),

      updateStopNotes: (stopId, notes) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) => (st.id === stopId ? { ...st, notes } : st)),
          })),
        ),

      reorderStops: (orderedIds) =>
        set((s) =>
          patchCurrent(s, (t) => {
            const map = new Map(t.stops.map((st) => [st.id, st]));
            const stops = orderedIds
              .map((id, i) => {
                const st = map.get(id);
                return st ? { ...st, order: i } : null;
              })
              .filter((x): x is Stop => x !== null);
            return { ...t, stops };
          }),
        ),

      markArrived: (stopId) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId && !st.arrived
                ? recomputeCompletion({
                    ...st,
                    arrived: true,
                    arrivedAt: new Date().toISOString(),
                  })
                : st,
            ),
          })),
        ),

      skipStop: (stopId, reason) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? { ...st, skipped: true, skipReason: reason.trim() || 'Pominięto' }
                : st,
            ),
          })),
        ),

      unskipStop: (stopId) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? { ...st, skipped: false, skipReason: undefined }
                : st,
            ),
          })),
        ),

      updateStop: (stopId, patch) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId ? recomputeCompletion({ ...st, ...patch }) : st,
            ),
          })),
        ),

      setStopContact: (stopId, contactName, phone) =>
        get().updateStop(stopId, { contactName, phone }),

      setStopWindow: (stopId, windowStart, windowEnd) =>
        get().updateStop(stopId, { windowStart, windowEnd }),

      setStopCod: (stopId, codAmount) =>
        get().updateStop(stopId, { codAmount }),

      collectCod: (stopId, codCollected) =>
        get().updateStop(stopId, { codCollected }),

      addParcel: (stopId, code, label) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? {
                    ...st,
                    parcels: [
                      ...(st.parcels ?? []),
                      {
                        id: uid('pcl_'),
                        code: code.trim(),
                        label: label?.trim() || undefined,
                        scanned: false,
                      } as Parcel,
                    ],
                  }
                : st,
            ),
          })),
        ),

      removeParcel: (stopId, parcelId) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? { ...st, parcels: (st.parcels ?? []).filter((p) => p.id !== parcelId) }
                : st,
            ),
          })),
        ),

      setParcelScanned: (stopId, parcelId, scanned) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? {
                    ...st,
                    parcels: (st.parcels ?? []).map((p) =>
                      p.id === parcelId
                        ? { ...p, scanned, scannedAt: scanned ? new Date().toISOString() : undefined }
                        : p,
                    ),
                  }
                : st,
            ),
          })),
        ),

      scanParcelByCode: (code) => {
        const trip = get().current();
        if (!trip) return null;
        const norm = code.trim();
        for (const st of trip.stops) {
          const pcl = (st.parcels ?? []).find((p) => p.code === norm);
          if (pcl) {
            get().setParcelScanned(st.id, pcl.id, true);
            return { stopId: st.id, label: st.label };
          }
        }
        return null;
      },

      setRecipient: (stopId, recipientName) =>
        get().updateStop(stopId, { recipientName }),

      setSignature: (stopId, signatureDataUrl) =>
        get().updateStop(stopId, { signatureDataUrl }),

      setOutcome: (stopId, outcome, outcomeReason) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? // recomputeCompletion ustawia completed=true dla 'delivered'
                  recomputeCompletion({
                    ...st,
                    outcome,
                    outcomeReason,
                    // wynik 'failed' traktuj jak pominięcie dla postępu trasy
                    skipped: outcome === 'failed' ? true : st.skipped,
                    skipReason:
                      outcome === 'failed'
                        ? outcomeReason || 'Doręczenie nieudane'
                        : st.skipReason,
                  })
                : st,
            ),
          })),
        ),

      addTask: (stopId, text) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? recomputeCompletion({
                    ...st,
                    tasks: [
                      ...st.tasks,
                      { id: uid('task_'), text: text.trim(), done: false },
                    ],
                  })
                : st,
            ),
          })),
        ),

      removeTask: (stopId, taskId) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? recomputeCompletion({
                    ...st,
                    tasks: st.tasks.filter((tk) => tk.id !== taskId),
                  })
                : st,
            ),
          })),
        ),

      toggleTask: (stopId, taskId, done) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) => {
              if (st.id !== stopId) return st;
              const tasks = st.tasks.map((tk) => {
                if (tk.id !== taskId) return tk;
                const nowDone = done ?? !tk.done;
                return {
                  ...tk,
                  done: nowDone,
                  doneAt: nowDone ? new Date().toISOString() : undefined,
                };
              });
              return recomputeCompletion({ ...st, tasks });
            }),
          })),
        ),

      setTaskNote: (stopId, taskId, note) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? {
                    ...st,
                    tasks: st.tasks.map((tk) =>
                      tk.id === taskId ? { ...tk, note } : tk,
                    ),
                  }
                : st,
            ),
          })),
        ),

      setTaskPhoto: (stopId, taskId, photoUri) =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            stops: t.stops.map((st) =>
              st.id === stopId
                ? {
                    ...st,
                    tasks: st.tasks.map((tk) =>
                      tk.id === taskId ? { ...tk, photoUri } : tk,
                    ),
                  }
                : st,
            ),
          })),
        ),

      optimize: async () => {
        const trip = get().current();
        if (!trip || trip.stops.length < 2) return;
        set({ building: true, error: null });
        try {
          const start: LngLat =
            trip.startLat != null && trip.startLng != null
              ? { lat: trip.startLat, lng: trip.startLng }
              : { lat: trip.stops[0].lat, lng: trip.stops[0].lng };
          const ordered = [...trip.stops].sort((a, b) => a.order - b.order);
          const { order } = await optimizeOrder(
            start,
            ordered.map((s) => ({ lat: s.lat, lng: s.lng })),
          );
          const reordered = order.map((idx, newOrder) => ({
            ...ordered[idx],
            order: newOrder,
          }));
          set((s) =>
            patchCurrent(s, (t) => ({ ...t, stops: reordered })),
          );
          // po zmianie kolejności od razu przelicz trasę
          await get().buildRoute();
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Błąd optymalizacji' });
        } finally {
          set({ building: false });
        }
      },

      buildRoute: async () => {
        const trip = get().current();
        if (!trip || trip.stops.length < 1) return;
        set({ building: true, error: null });
        try {
          const start: LngLat | undefined =
            trip.startLat != null && trip.startLng != null
              ? { lat: trip.startLat, lng: trip.startLng }
              : undefined;
          const { points, stopIds } = pointsFromStops(start, trip.stops);
          if (points.length < 2) {
            set({ building: false });
            return;
          }
          const legs = await getDirections(points, stopIds);
          const totalDistanceMeters = legs.reduce((a, l) => a + l.distanceMeters, 0);
          const totalDurationSeconds = legs.reduce((a, l) => a + l.durationSeconds, 0);
          set((s) =>
            patchCurrent(s, (t) => ({
              ...t,
              legs,
              totalDistanceMeters,
              totalDurationSeconds,
            })),
          );
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Błąd budowy trasy' });
        } finally {
          set({ building: false });
        }
      },

      startTrip: () =>
        set((s) => patchCurrent(s, (t) => ({ ...t, status: 'active' }))),

      completeTrip: () =>
        set((s) =>
          patchCurrent(s, (t) => ({
            ...t,
            status: 'completed',
            completedAt: new Date().toISOString(),
          })),
        ),
    }),
    {
      name: 'nav-trips',
      storage: createJSONStorage(() => capacitorStorage),
      partialize: (s) => ({ trips: s.trips, currentTripId: s.currentTripId }),
    },
  ),
);
