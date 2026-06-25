// Ekran planowania trasy: start + przystanki + zadania + optymalizacja.
import { useEffect, useRef, useState } from 'react';
import { MapView } from '../components/map/MapView';
import { AddressSearch } from '../components/planner/AddressSearch';
import { StopList } from '../components/planner/StopList';
import { useTripStore } from '../store/tripStore';
import { requestLocationPermission, startTracking } from '../services/locationService';
import { formatDistance, formatDuration } from '../lib/format';
import { ShiftBar } from '../components/ShiftBar';
import { BarcodeScanner } from '../components/nav/BarcodeScanner';
import { Collapsible } from '../components/Collapsible';
import { NearbyFinder } from '../components/planner/NearbyFinder';
import { WeatherChip } from '../components/WeatherChip';
import { formatMoney } from '../lib/format';
import { useSettingsStore } from '../store/settingsStore';
import { geocode } from '../services/mapboxService';

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

  const autoStartTried = useRef(false);

  // Utwórz trasę jeśli żadnej nie ma.
  useEffect(() => {
    if (!trip) createTrip();
  }, [trip, createTrip]);

  // Automatycznie ustaw punkt startu z GPS (raz), by „wpisz cel → Jedź"
  // działało od razu, bez ręcznego ustawiania startu.
  useEffect(() => {
    if (!trip || trip.startLat != null || autoStartTried.current) return;
    autoStartTried.current = true;
    (async () => {
      try {
        await requestLocationPermission();
        const tracker = await startTracking(
          (fix) => {
            setStart(fix.lat, fix.lng);
            tracker.stop();
          },
          () => {},
        );
      } catch {
        /* brak GPS — użytkownik może ustawić start ręcznie */
      }
    })();
  }, [trip, setStart]);

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

  const parcelsTotal = trip.stops.reduce((a, s) => a + (s.parcels?.length ?? 0), 0);
  const parcelsScanned = trip.stops.reduce(
    (a, s) => a + (s.parcels?.filter((p) => p.scanned).length ?? 0),
    0,
  );
  const codTotal = trip.stops.reduce((a, s) => a + (s.codAmount ?? 0), 0);

  // Jednorazowy odczyt pozycji GPS (Promise).
  const getOneFix = () =>
    new Promise<void>(async (resolve) => {
      try {
        await requestLocationPermission();
        const tracker = await startTracking(
          (fix) => {
            setStart(fix.lat, fix.lng);
            tracker.stop();
            resolve();
          },
          () => resolve(),
        );
        setTimeout(resolve, 6000); // nie blokuj w nieskończoność
      } catch {
        resolve();
      }
    });

  // „Jedź" = zapewnij start (GPS) i trasę, potem startuj nawigację.
  const goNavigate = async () => {
    // Dla pojedynczego celu potrzebny jest punkt startu — dobierz z GPS.
    const cur = useTripStore.getState().current();
    if (cur && cur.startLat == null && cur.stops.length < 2) {
      setGpsBusy(true);
      await getOneFix();
      setGpsBusy(false);
    }
    await buildRoute();
    const t = useTripStore.getState().current();
    if (t && t.legs.length > 0) {
      startTrip();
      onStartNavigation();
    } else {
      alert(
        'Nie udało się wyznaczyć trasy. Ustaw punkt startu (📍 sekcja „Punkt startu") lub dodaj kolejny przystanek.',
      );
    }
  };

  // ETA do każdego przystanku (kaskadowo z czasów legów).
  const etaByStopId: Record<string, number> = {};
  {
    const ordered = [...trip.stops].sort((a, b) => a.order - b.order);
    let acc = 0;
    ordered.forEach((s, i) => {
      acc += trip.legs[i]?.durationSeconds ?? 0;
      etaByStopId[s.id] = acc;
    });
  }

  // Dodaj przystanek głosowo (rozpoznawanie mowy → geokodowanie).
  const voiceAddStop = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Rozpoznawanie mowy niedostępne na tym urządzeniu.');
      return;
    }
    const rec = new SR();
    rec.lang = 'pl-PL';
    rec.interimResults = false;
    rec.onresult = async (e: any) => {
      const text = String(e.results[0][0].transcript);
      const res = await geocode(text, start);
      if (res[0]) addStop({ label: res[0].label, address: res[0].address, lat: res[0].lat, lng: res[0].lng });
    };
    try {
      rec.start();
    } catch {
      /* ignoruj */
    }
  };

  return (
    <div className="planner-screen">
      <div className="planner-map">
        <MapView legs={trip.legs} stops={trip.stops} start={start} />
      </div>

      <div className="planner-panel">
        {/* HERO — najważniejsza akcja: dodaj przystanek */}
        <div className="hero-add">
          <div className="hero-add-row">
            <AddressSearch
              proximity={start}
              placeholder="➕ Dodaj przystanek — adres lub nazwa klienta"
              onPick={(r) =>
                addStop({ label: r.label, address: r.address, lat: r.lat, lng: r.lng })
              }
            />
            <button className="btn-mic" onClick={voiceAddStop} aria-label="Dodaj głosowo">
              🎙
            </button>
          </div>
          {start && (
            <div className="hero-meta">
              <WeatherChip at={start} label="start" />
            </div>
          )}
        </div>

        <NearbyFinder
          center={start}
          onAdd={(poi) =>
            addStop({ label: poi.name, address: `${poi.name} (OSM)`, lat: poi.lat, lng: poi.lng })
          }
        />

        {/* Lista przystanków — rdzeń pracy */}
        {trip.stops.length > 0 ? (
          <StopList
            stops={trip.stops}
            etaByStopId={etaByStopId}
            onMove={reorderStops}
            onRemove={removeStop}
            onNotes={updateStopNotes}
            onAddTask={addTask}
            onRemoveTask={removeTask}
            onToggleTask={(stopId, taskId) => toggleTask(stopId, taskId)}
          />
        ) : (
          <p className="hero-hint">
            Dodaj przystanki, aby zaplanować trasę. Potem dotknij <b>Jedź</b>.
          </p>
        )}

        {trip.legs.length > 0 && (
          <div className="route-summary">
            <span>🛣 {formatDistance(trip.totalDistanceMeters)}</span>
            <span>⏱ {formatDuration(trip.totalDurationSeconds)}</span>
          </div>
        )}

        {(parcelsTotal > 0 || codTotal > 0) && (
          <div className="load-summary">
            {parcelsTotal > 0 && (
              <span>📦 {parcelsScanned}/{parcelsTotal}</span>
            )}
            {codTotal > 0 && <span>💰 {formatMoney(codTotal, currency)}</span>}
            {parcelsTotal > 0 && (
              <button className="btn-scan" onClick={() => setLoadScan(true)}>
                Skanuj załadunek
              </button>
            )}
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        {/* DODATKI — schowane w rozwijanych sekcjach */}
        <Collapsible
          title="Punkt startu"
          icon="📍"
          subtitle={start ? 'ustawiony' : 'bieżąca lokalizacja'}
        >
          <div className="start-row">
            <button className="btn-gps" onClick={useCurrentLocation} disabled={gpsBusy}>
              {gpsBusy ? 'Pobieram GPS…' : '📍 Moja lokalizacja'}
            </button>
            <span className="start-coords">
              {start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : 'auto (GPS)'}
            </span>
          </div>
          <AddressSearch
            proximity={start}
            placeholder="…lub wpisz adres startu"
            onPick={(r) => setStart(r.lat, r.lng)}
          />
        </Collapsible>

        <Collapsible title="Nazwa trasy" icon="✏️" subtitle={trip.name}>
          <input
            className="trip-name"
            value={trip.name}
            onChange={(e) => renameTrip(trip.id, e.target.value)}
          />
        </Collapsible>

        <Collapsible title="Czas pracy" icon="⏱">
          <ShiftBar />
        </Collapsible>
      </div>

      {/* Pasek akcji — zawsze widoczny na dole */}
      <div className="planner-actionbar">
        <button
          className="btn-secondary"
          disabled={trip.stops.length < 2 || building}
          onClick={() => optimize()}
        >
          {building ? '…' : '⚡ Optymalizuj'}
        </button>
        <button
          className="btn-primary big"
          disabled={trip.stops.length < 1 || building}
          onClick={goNavigate}
        >
          {building ? '…' : '▶ Jedź'}
        </button>
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
