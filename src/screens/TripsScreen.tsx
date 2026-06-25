// Historia / zarządzanie trasami: lista, statystyki, wybór, usuwanie.
import { useTripStore } from '../store/tripStore';
import { formatDistance, formatDuration, formatDateTimePl, formatMoney } from '../lib/format';
import { buildDayReport } from '../lib/report';
import { shareText } from '../services/shareService';
import { useSettingsStore } from '../store/settingsStore';
import type { Trip } from '../types';

interface Props {
  onOpenPlanner: () => void;
}

function tripStats(trip: Trip) {
  const stopsTotal = trip.stops.length;
  const stopsDone = trip.stops.filter((s) => s.completed).length;
  const tasksTotal = trip.stops.reduce((a, s) => a + s.tasks.length, 0);
  const tasksDone = trip.stops.reduce((a, s) => a + s.tasks.filter((t) => t.done).length, 0);
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  return { stopsTotal, stopsDone, tasksTotal, tasksDone, pct };
}

const STATUS_LABEL: Record<Trip['status'], string> = {
  planned: 'Zaplanowana',
  active: 'W trakcie',
  completed: 'Zakończona',
};

export function TripsScreen({ onOpenPlanner }: Props) {
  const trips = useTripStore((s) => s.trips);
  const setCurrent = useTripStore((s) => s.setCurrent);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const createTrip = useTripStore((s) => s.createTrip);
  const currency = useSettingsStore((s) => s.currency);

  return (
    <div className="trips-screen">
      <div className="trips-header">
        <h2>Historia tras</h2>
        <button
          className="btn-primary"
          onClick={() => {
            createTrip();
            onOpenPlanner();
          }}
        >
          + Nowa trasa
        </button>
      </div>

      {trips.length === 0 && <p className="empty">Brak tras. Utwórz pierwszą.</p>}

      {trips.length > 0 &&
        (() => {
          const totalKm = trips.reduce((a, t) => a + t.totalDistanceMeters, 0);
          const allStats = trips.map(tripStats);
          const tasksDone = allStats.reduce((a, s) => a + s.tasksDone, 0);
          const tasksTotal = allStats.reduce((a, s) => a + s.tasksTotal, 0);
          const stopsDone = allStats.reduce((a, s) => a + s.stopsDone, 0);
          const cod = trips.reduce(
            (a, t) => a + t.stops.reduce((b, s) => b + (s.codCollected ? s.codAmount ?? 0 : 0), 0),
            0,
          );
          const maxKm = Math.max(1, ...trips.map((t) => t.totalDistanceMeters));
          return (
            <div className="stats-dash">
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="sc-val">{trips.length}</span>
                  <span className="sc-lbl">Tras</span>
                </div>
                <div className="stat-card">
                  <span className="sc-val">{formatDistance(totalKm)}</span>
                  <span className="sc-lbl">Łącznie</span>
                </div>
                <div className="stat-card">
                  <span className="sc-val">{stopsDone}</span>
                  <span className="sc-lbl">Przystanki</span>
                </div>
                <div className="stat-card">
                  <span className="sc-val">{tasksDone}/{tasksTotal}</span>
                  <span className="sc-lbl">Zadania</span>
                </div>
                {cod > 0 && (
                  <div className="stat-card wide">
                    <span className="sc-val">{formatMoney(cod, currency)}</span>
                    <span className="sc-lbl">Pobrania (suma)</span>
                  </div>
                )}
              </div>
              <div className="stats-bars">
                {trips.slice(0, 12).map((t) => (
                  <div
                    key={t.id}
                    className="stats-bar"
                    style={{ height: `${Math.max(6, (t.totalDistanceMeters / maxKm) * 100)}%` }}
                    title={`${t.name}: ${formatDistance(t.totalDistanceMeters)}`}
                  />
                ))}
              </div>
            </div>
          );
        })()}

      <div className="trips-list">
        {trips.map((trip) => {
          const st = tripStats(trip);
          return (
            <div key={trip.id} className="trip-card">
              <div className="trip-card-head">
                <div>
                  <strong>{trip.name}</strong>
                  <span className={`trip-status ${trip.status}`}>
                    {STATUS_LABEL[trip.status]}
                  </span>
                </div>
                <span className="trip-date">{formatDateTimePl(trip.date)}</span>
              </div>
              <div className="trip-card-stats">
                <span>🛣 {formatDistance(trip.totalDistanceMeters)}</span>
                <span>⏱ {formatDuration(trip.totalDurationSeconds)}</span>
                <span>
                  📍 {st.stopsDone}/{st.stopsTotal}
                </span>
                <span>
                  ✓ {st.tasksDone}/{st.tasksTotal} ({st.pct}%)
                </span>
              </div>
              <div className="trip-card-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCurrent(trip.id);
                    onOpenPlanner();
                  }}
                >
                  Otwórz
                </button>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    shareText(
                      `Raport — ${trip.name}`,
                      buildDayReport(trip, {
                        driverName: useSettingsStore.getState().driverName,
                        currency: useSettingsStore.getState().currency,
                      }),
                    )
                  }
                >
                  📤 Raport
                </button>
                <button
                  className="btn-secondary danger"
                  onClick={() => {
                    if (confirm(`Usunąć trasę „${trip.name}"?`)) deleteTrip(trip.id);
                  }}
                >
                  Usuń
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
