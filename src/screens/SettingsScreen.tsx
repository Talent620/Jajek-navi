// Ekran ustawień: głos, GPS/symulacja, dokładność, offline, aktualizacje.
import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { APP_VERSION, UPDATE_REPO } from '../config';
import {
  checkForUpdate,
  downloadAndInstall,
  type UpdateInfo,
} from '../services/updateService';
import { clearTileCache, tileCacheCount } from '../lib/offline/tileCache';
import { THEMES, type Accent } from '../lib/themes';
import { useTripStore } from '../store/tripStore';
import { serializeTrips, parseTrips } from '../lib/backup';
import { shareText } from '../services/shareService';

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="setting-row" onClick={() => onChange(!value)}>
      <div className="setting-label">
        <strong>{label}</strong>
        {hint && <span>{hint}</span>}
      </div>
      <div className={`switch ${value ? 'on' : ''}`}>
        <div className="knob" />
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const s = useSettingsStore();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateInfo | null>(null);
  const [tileCount, setTileCount] = useState(0);

  useEffect(() => {
    tileCacheCount().then(setTileCount);
  }, []);

  const clearOffline = async () => {
    await clearTileCache();
    setTileCount(0);
  };

  const exportData = () => {
    const trips = useTripStore.getState().trips;
    if (trips.length === 0) {
      alert('Brak tras do wyeksportowania.');
      return;
    }
    void shareText('Jajek Navi — backup tras', serializeTrips(trips));
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseTrips(String(reader.result ?? ''));
        if (!parsed || parsed.length === 0) {
          alert('Nieprawidłowy plik backupu.');
          return;
        }
        const n = useTripStore.getState().importTrips(parsed, 'merge');
        alert(`Zaimportowano ${n} tras(y).`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      setResult(await checkForUpdate());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="settings-screen">
      <h2>Ustawienia</h2>

      <section className="settings-group">
        <h3>Profil kierowcy</h3>
        <label className="field-label">Imię i nazwisko (na raporty)</label>
        <input
          value={s.driverName}
          onChange={(e) => s.setDriverName(e.target.value)}
          placeholder="np. Jan Kowalski"
        />
        <label className="field-label">Waluta pobrań (COD)</label>
        <select value={s.currency} onChange={(e) => s.setCurrency(e.target.value)}>
          <option value="PLN">PLN (zł)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
          <option value="CZK">CZK</option>
          <option value="USD">USD ($)</option>
        </select>
        <label className="field-label">Tryb pracy</label>
        <div className="mode-toggle">
          <button
            className={s.mode === 'courier' ? 'active' : ''}
            onClick={() => s.setMode('courier')}
          >
            📦 Kurier / dostawy
          </button>
          <button
            className={s.mode === 'passenger' ? 'active' : ''}
            onClick={() => s.setMode('passenger')}
          >
            🧍 Przewóz osób
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h3>Wygląd i dźwięk</h3>
        <label className="field-label">Motyw (akcent)</label>
        <div className="accent-row">
          {(Object.keys(THEMES) as Accent[]).map((a) => (
            <button
              key={a}
              className={`accent-swatch ${s.accent === a ? 'active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${THEMES[a].neon}, ${THEMES[a].neon2})` }}
              onClick={() => s.setAccent(a)}
              aria-label={THEMES[a].label}
              title={THEMES[a].label}
            />
          ))}
        </div>
        <Toggle
          label="Dźwięki"
          hint="Gong dojazdu, potwierdzenia, kliknięcia"
          value={s.sounds}
          onChange={s.setSounds}
        />
        <label className="field-label">Jakość grafiki 3D</label>
        <div className="mode-toggle">
          {(['auto', 'high', 'eco'] as const).map((q) => (
            <button key={q} className={s.quality === q ? 'active' : ''} onClick={() => s.setQuality(q)}>
              {q === 'auto' ? 'Auto' : q === 'high' ? 'Wysoka' : 'Oszczędna'}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => s.setCoachDone(false)}>
          ❔ Pokaż samouczek ponownie
        </button>
      </section>

      <section className="settings-group">
        <h3>Nawigacja</h3>
        <Toggle
          label="Prowadzenie głosowe"
          hint="Komunikaty TTS po polsku"
          value={s.voiceEnabled}
          onChange={s.setVoiceEnabled}
        />
        <Toggle
          label="Symulacja jazdy (mock GPS)"
          hint="Przejazd po trasie bez realnego GPS — do testów"
          value={s.mockGps}
          onChange={s.setMockGps}
        />
        <Toggle
          label="Wysoka dokładność GPS"
          hint="Lepsza pozycja, większy pobór baterii"
          value={s.highAccuracy}
          onChange={s.setHighAccuracy}
        />
        <Toggle
          label="Wibracje (haptyka)"
          hint="Potwierdzenie dojazdu, dostawy, zjazdu z trasy"
          value={s.haptics}
          onChange={s.setHaptics}
        />
        <Toggle
          label="Ekran zawsze włączony w nawigacji"
          hint="Nie wygaszaj ekranu podczas jazdy"
          value={s.keepAwake}
          onChange={s.setKeepAwake}
        />
        <Toggle
          label="Pogoda w celu"
          hint="Pokazuj pogodę następnego przystanku (Open-Meteo)"
          value={s.weather}
          onChange={s.setWeather}
        />
        <label className="field-label">Styl mapy</label>
        <div className="mode-toggle wrap">
          {(['dark', 'light', 'satellite', 'auto'] as const).map((m) => (
            <button
              key={m}
              className={s.mapStyle === m ? 'active' : ''}
              onClick={() => s.setMapStyle(m)}
            >
              {m === 'dark'
                ? '🌙 Ciemna'
                : m === 'light'
                  ? '☀️ Jasna'
                  : m === 'satellite'
                    ? '🛰️ Satelita'
                    : '🌗 Auto'}
            </button>
          ))}
        </div>
        <div className="about-row">
          <span>Kafle offline w pamięci</span>
          <strong>{tileCount}</strong>
        </div>
        <button className="btn-secondary" onClick={clearOffline} disabled={tileCount === 0}>
          🗑 Wyczyść mapę offline
        </button>
        <p className="setting-hint">
          Mapę offline pobierzesz na ekranie planowania („⬇ Pobierz mapę offline dla trasy").
        </p>
      </section>

      <section className="settings-group">
        <h3>Dane (backup)</h3>
        <button className="btn-secondary" onClick={exportData}>
          📤 Eksportuj trasy (backup)
        </button>
        <button className="btn-secondary" onClick={importData}>
          📥 Importuj z pliku
        </button>
        <p className="setting-hint">
          Eksport zapisuje wszystkie trasy (z zadaniami i POD) jako plik JSON.
          Import scala je z bieżącymi.
        </p>
      </section>

      <section className="settings-group">
        <h3>Aktualizacje</h3>
        <Toggle
          label="Sprawdzaj automatycznie"
          hint={`Źródło: GitHub Releases (${UPDATE_REPO})`}
          value={s.autoCheckUpdates}
          onChange={s.setAutoCheckUpdates}
        />
        <button className="btn-secondary" onClick={check} disabled={checking}>
          {checking ? 'Sprawdzam…' : '🔄 Sprawdź aktualizacje teraz'}
        </button>
        {result && (
          <div className="update-result">
            {result.available ? (
              <>
                <p>
                  Nowa wersja <strong>{result.latestVersion}</strong> (masz{' '}
                  {result.currentVersion}).
                </p>
                {result.apkUrl ? (
                  <button className="btn-primary" onClick={() => downloadAndInstall(result.apkUrl!)}>
                    ⬇ Pobierz i zainstaluj
                  </button>
                ) : result.htmlUrl ? (
                  <button className="btn-primary" onClick={() => downloadAndInstall(result.htmlUrl!)}>
                    Otwórz stronę wydania
                  </button>
                ) : null}
              </>
            ) : (
              <p>Masz najnowszą wersję ({result.currentVersion}).</p>
            )}
          </div>
        )}
      </section>

      <section className="settings-group">
        <h3>O aplikacji</h3>
        <div className="about-row">
          <span>Wersja</span>
          <strong>{APP_VERSION}</strong>
        </div>
        <div className="about-row">
          <span>Mapa</span>
          <strong>OpenStreetMap · OpenFreeMap</strong>
        </div>
        <div className="about-row">
          <span>Trasy</span>
          <strong>OSRM · Nominatim</strong>
        </div>
      </section>
    </div>
  );
}
