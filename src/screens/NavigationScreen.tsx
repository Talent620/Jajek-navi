// Pełnoekranowa nawigacja: mapa follow + baner manewru + statystyki + check-lista.
import { useEffect, useMemo } from 'react';
import { MapView } from '../components/map/MapView';
import { ManeuverBanner } from '../components/nav/ManeuverBanner';
import { NavStats } from '../components/nav/NavStats';
import { ChecklistSheet } from '../components/nav/ChecklistSheet';
import { useTripStore } from '../store/tripStore';
import { useNavStore } from '../store/navStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigationEngine } from '../lib/navigation/useNavigationEngine';
import { buildDayReport } from '../lib/report';
import { shareText } from '../services/shareService';

interface Props {
  onExit: () => void;
}

export function NavigationScreen({ onExit }: Props) {
  const trip = useTripStore((s) => s.trips.find((t) => t.id === s.currentTripId) ?? null);
  const toggleTask = useTripStore((s) => s.toggleTask);
  const addTask = useTripStore((s) => s.addTask);
  const setTaskPhoto = useTripStore((s) => s.setTaskPhoto);
  const skipStop = useTripStore((s) => s.skipStop);
  const completeTrip = useTripStore((s) => s.completeTrip);

  const fix = useNavStore((s) => s.fix);
  const currentStep = useNavStore((s) => s.currentStep);
  const distanceToManeuver = useNavStore((s) => s.distanceToManeuver);
  const rerouting = useNavStore((s) => s.rerouting);
  const remainingDistance = useNavStore((s) => s.remainingDistance);
  const remainingDuration = useNavStore((s) => s.remainingDuration);
  const activeStopIndex = useNavStore((s) => s.activeStopIndex);
  const sheetStopId = useNavStore((s) => s.sheetStopId);
  const openSheet = useNavStore((s) => s.openSheet);
  const closeSheet = useNavStore((s) => s.closeSheet);
  const setActive = useNavStore((s) => s.setActive);
  const reset = useNavStore((s) => s.reset);

  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const mockGps = useSettingsStore((s) => s.mockGps);
  const setMockGps = useSettingsStore((s) => s.setMockGps);

  // Aktywuj silnik nawigacji (efekt, nie podczas renderu).
  useEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, [setActive]);
  useNavigationEngine(trip?.id ?? null);

  const ordered = useMemo(
    () => (trip ? [...trip.stops].sort((a, b) => a.order - b.order) : []),
    [trip],
  );

  if (!trip) {
    return (
      <div className="nav-screen">
        <p>Brak aktywnej trasy.</p>
        <button onClick={onExit}>Wróć</button>
      </div>
    );
  }

  const start =
    trip.startLat != null && trip.startLng != null
      ? { lat: trip.startLat, lng: trip.startLng }
      : undefined;

  const stopsDone = ordered.filter((s) => s.completed || s.skipped).length;
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
  const currency = useSettingsStore.getState().currency;

  const sheetStop = ordered.find((s) => s.id === sheetStopId) ?? null;
  const nextStop =
    ordered.find((s) => !s.completed && !s.skipped && s.id !== sheetStopId) ?? null;

  const exit = () => {
    setActive(false);
    reset();
    onExit();
  };

  const allDone = ordered.length > 0 && ordered.every((s) => s.completed || s.skipped);

  return (
    <div className="nav-screen">
      <div className="nav-map">
        <MapView
          legs={trip.legs}
          stops={trip.stops}
          start={start}
          userFix={fix}
          follow
          activeStopIndex={activeStopIndex}
        />
      </div>

      <ManeuverBanner
        step={currentStep}
        distanceToManeuver={distanceToManeuver}
        rerouting={rerouting}
      />

      <div className="nav-top-actions">
        <button className="pill" onClick={exit}>
          ✕ Zakończ
        </button>
        <button
          className={`pill ${voiceEnabled ? 'on' : ''}`}
          onClick={() => setVoiceEnabled(!voiceEnabled)}
        >
          {voiceEnabled ? '🔊 Głos' : '🔇 Głos'}
        </button>
        <button
          className={`pill ${mockGps ? 'on' : ''}`}
          onClick={() => setMockGps(!mockGps)}
        >
          {mockGps ? '🧪 Symulacja' : '📡 GPS'}
        </button>
      </div>

      <NavStats
        remainingDistance={remainingDistance}
        remainingDuration={remainingDuration}
        fix={fix}
        stopsDone={stopsDone}
        stopsTotal={ordered.length}
        tasksDone={tasksDone}
        tasksTotal={tasksTotal}
        parcelsScanned={parcelsScanned}
        parcelsTotal={parcelsTotal}
        codCollected={codCollected}
        codTotal={codTotal}
        currency={currency}
      />

      {allDone && !sheetStop && (
        <div className="trip-complete-banner">
          <span>✅ Wszystkie przystanki rozliczone!</span>
          <div className="complete-actions">
            <button
              className="btn-secondary"
              onClick={() =>
                shareText(
                  `Raport — ${trip.name}`,
                  buildDayReport(trip, {
                    driverName: useSettingsStore.getState().driverName,
                    currency,
                  }),
                )
              }
            >
              📤 Raport
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                completeTrip();
                exit();
              }}
            >
              Zakończ dzień
            </button>
          </div>
        </div>
      )}

      <ChecklistSheet
        stop={sheetStop}
        onToggleTask={(taskId, done) => sheetStop && toggleTask(sheetStop.id, taskId, done)}
        onAddTask={(text) => sheetStop && addTask(sheetStop.id, text)}
        onTaskPhoto={(taskId, uri) => sheetStop && setTaskPhoto(sheetStop.id, taskId, uri)}
        onSkip={(reason) => sheetStop && skipStop(sheetStop.id, reason)}
        onClose={closeSheet}
        onNext={() => {
          closeSheet();
          if (nextStop) openSheet(nextStop.id);
        }}
        hasNext={!!nextStop}
      />

      {/* Przycisk ręcznego otwarcia check-listy aktywnego przystanku */}
      {!sheetStop && ordered[activeStopIndex] && (
        <button
          className="fab-checklist"
          onClick={() => openSheet(ordered[activeStopIndex].id)}
        >
          📋 Zadania: {ordered[activeStopIndex].label}
        </button>
      )}
    </div>
  );
}
