// Historia / zarządzanie trasami: lista, statystyki, wybór, usuwanie.
import { useTripStore } from '../store/tripStore';
import { formatDistance, formatDuration, formatDateTimePl } from '../lib/format';
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
