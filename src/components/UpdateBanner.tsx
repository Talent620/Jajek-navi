// Baner aktualizacji APK — pojawia się, gdy GitHub Releases ma nowszą wersję.
import { useEffect, useState } from 'react';
import {
  checkForUpdate,
  downloadAndInstall,
  type UpdateInfo,
} from '../services/updateService';
import { useSettingsStore } from '../store/settingsStore';

export function UpdateBanner() {
  const auto = useSettingsStore((s) => s.autoCheckUpdates);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!auto) return;
    let active = true;
    checkForUpdate().then((i) => {
      if (active && i.available) setInfo(i);
    });
    return () => {
      active = false;
    };
  }, [auto]);

  if (!info || !info.available || dismissed) return null;

  return (
    <div className="update-banner">
      <div className="update-text">
        <strong>Dostępna aktualizacja {info.latestVersion}</strong>
        <span>Masz {info.currentVersion}</span>
      </div>
      <div className="update-actions">
        {info.apkUrl ? (
          <button className="btn-primary" onClick={() => downloadAndInstall(info.apkUrl!)}>
            ⬇ Pobierz
          </button>
        ) : (
          info.htmlUrl && (
            <button className="btn-primary" onClick={() => downloadAndInstall(info.htmlUrl!)}>
              Otwórz
            </button>
          )
        )}
        <button className="btn-secondary" onClick={() => setDismissed(true)}>
          Później
        </button>
      </div>
    </div>
  );
}
