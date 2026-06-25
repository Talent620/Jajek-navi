// Ekran ustawień: głos, GPS/symulacja, dokładność, offline, aktualizacje.
import { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { APP_VERSION, HAS_MAPBOX_TOKEN, UPDATE_REPO } from '../config';
import {
  checkForUpdate,
  downloadAndInstall,
  type UpdateInfo,
} from '../services/updateService';

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
          label="Cache kafli mapy (offline)"
          hint="Szkielet — pełny offline w planach (TODO)"
          value={s.offlineTiles}
          onChange={s.setOfflineTiles}
        />
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
          <strong>{HAS_MAPBOX_TOKEN ? 'Mapbox (token OK)' : 'MOCK (brak tokena)'}</strong>
        </div>
      </section>
    </div>
  );
}
