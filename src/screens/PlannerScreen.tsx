// Ekran planowania trasy: start + przystanki + zadania + optymalizacja.
import { useEffect, useState } from 'react';
import { MapView } from '../components/map/MapView';
import { AddressSearch } from '../components/planner/AddressSearch';
import { StopList } from '../components/planner/StopList';
import { useTripStore } from '../store/tripStore';
import { requestLocationPermission, startTracking } from '../services/locationService';
import { formatDistance, formatDuration } from '../lib/format';
import { HAS_MAPBOX_TOKEN } from '../config';
import { ShiftBar } from '../components/ShiftBar';
import { BarcodeScanner } from '../components/nav/BarcodeScanner';
import { formatMoney } from '../lib/format';
import { useSettingsStore } from '../store/settingsStore';

interface Props {
  onStartNavigation: () => void;
}

export function PlannerScreen({ onStartNavigation }: Props) {
  const trip = useTripStore((s) => s.trips.find((t) => t.id === s.currentTripId) ?? null);
  const building = useTripStore((s) => s.building);
  const error = useTripStore((s) => s.error);

  const createTrip = useTripStore((s) => s.createTrip);
  const renameTrip = useTripStore((s) => s.renameTrip);
  const setStart = useTripStore((s) => s.setStart);
  const addStop = useTripStore((s) => s.addStop);
  const removeStop = useTripStore((s) => s.removeStop);
  const reorderStops = useTripStore((s) => s.reorderStops);
  const updateStopNotes = useTripStore((s) => s.updateStopNotes);
  const addTask = useTripStore((s) => s.addTask);
  const removeTask = useTripStore((s) => s.removeTask);
  const toggleTask = useTripStore((s) => s.toggleTask);
  const optimize = useTripStore((s) => s.optimize);
  const buildRoute = useTripStore((s) => s.buildRoute);
  const startTrip = useTripStore((s) => s.startTrip);

  const [gpsBusy, setGpsBusy] = useState(false);
  const [loadScan, setLoadScan] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scanParcelByCode = useTripStore((s) => s.scanParcelByCode);
  const currency = useSettingsStore((s) => s.currency);

  // Utwórz trasę jeśli żadnej nie ma.
  useEffect(() => {
    if (!trip) createTrip();
  }, [trip, createTrip]);

  if (!trip) return null;

  const start =
    trip.startLat != null && trip.startLng != null
      ? { lat: trip.startLat, lng: trip.startLng }
      : undefined;

  const useCurrentLocation = async () => {
    setGpsBusy(true);
    try {
      await requestLocationPermission();
      const tracker = await startTracking(
        (fix) => {
          setStart(fix.lat, fix.lng);
          tracker.stop();
          setGpsBusy(false);
        },
        () => setGpsBusy(false),
      );
    } catch {
      setGpsBusy(false);
    }
  };

  const canNavigate = trip.stops.length >= 1 && trip.legs.length >= 1;

  return (
    <div className="planner-screen">
      <div className="planner-map">
        <MapView legs={trip.legs} stops={trip.stops} start={start} />
        {!HAS_MAPBOX_TOKEN && (
          <div className="mock-badge">TRYB MOCK — brak tokena Mapbox (patrz README)</div>
        )}
      </div>

      <div className="planner-panel">
        <ShiftBar />
        <input
          className="trip-name"
          value={trip.name}
          onChange={(e) => renameTrip(trip.id, e.target.value)}
        />

        <section className="planner-section">
          <h3>Start trasy</h3>
          <div className="start-row">
            <button className="btn-gps" onClick={useCurrentLocation} disabled={gpsBusy}>
              {gpsBusy ? 'Pobieram GPS…' : '📍 Moja lokalizacja'}
            </button>
            <span className="start-coords">
              {start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : 'nie ustawiono'}
            </span>
          </div>
          <AddressSearch
            proximity={start}
            placeholder="…lub wpisz adres startu"
            onPick={(r) => setStart(r.lat, r.lng)}
          />
        </section>

        <section className="planner-section">
          <h3>Dodaj przystanek</h3>
          <AddressSearch
            proximity={start}
            placeholder="Adres / nazwa klienta…"
            onPick={(r) =>
              addStop({ label: r.label, address: r.address, lat: r.lat, lng: r.lng })
            }
          />
        </section>

        <section className="planner-section">
          <div className="section-head-row">
            <h3>Przystanki ({trip.stops.length})</h3>
            {trip.stops.some((s) => (s.parcels?.length ?? 0) > 0) && (
              <button className="btn-scan" onClick={() => setLoadScan(true)}>
                📷 Skanuj załadunek
              </button>
            )}
          </div>
          {(() => {
            const parcels = trip.stops.reduce((a, s) => a + (s.parcels?.length ?? 0), 0);
            const scanned = trip.stops.reduce(
              (a, s) => a + (s.parcels?.filter((p) => p.scanned).length ?? 0),
              0,
            );
            const cod = trip.stops.reduce((a, s) => a + (s.codAmount ?? 0), 0);
            if (parcels === 0 && cod === 0) return null;
            return (
              <div className="load-summary">
                {parcels > 0 && <span>📦 {scanned}/{parcels} zeskanowane</span>}
                {cod > 0 && <span>💰 {formatMoney(cod, currency)} do pobrania</span>}
              </div>
            );
          })()}
          <StopList
            stops={trip.stops}
            onMove={reorderStops}
            onRemove={removeStop}
            onNotes={updateStopNotes}
            onAddTask={addTask}
            onRemoveTask={removeTask}
            onToggleTask={(stopId, taskId) => toggleTask(stopId, taskId)}
          />
        </section>

        {trip.legs.length > 0 && (
          <div className="route-summary">
            <span>🛣 {formatDistance(trip.totalDistanceMeters)}</span>
            <span>⏱ {formatDuration(trip.totalDurationSeconds)}</span>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        <div className="planner-actions">
          <button
            className="btn-secondary"
            disabled={trip.stops.length < 2 || building}
            onClick={() => optimize()}
          >
            {building ? '…' : '⚡ Optymalizuj kolejność'}
          </button>
          <button
            className="btn-secondary"
            disabled={trip.stops.length < 1 || building}
            onClick={() => buildRoute()}
          >
            {building ? '…' : '🧭 Przelicz trasę'}
          </button>
          <button
            className="btn-primary"
            disabled={!canNavigate}
            onClick={() => {
              startTrip();
              onStartNavigation();
            }}
          >
            ▶ Rozpocznij nawigację
          </button>
        </div>
      </div>

      {loadScan && (
        <BarcodeScanner
          onClose={() => {
            setLoadScan(false);
            setLastScan(null);
          }}
          onDetected={(code) => {
            const res = scanParcelByCode(code);
            setLastScan(res ? `✓ ${code} → ${res.label}` : `✗ ${code} — nieznany kod`);
          }}
        />
      )}
      {loadScan && lastScan && <div className="scan-toast">{lastScan}</div>}
    </div>
  );
}
