// Sprawdzanie aktualizacji APK przez GitHub Releases (jak Obtainium / F-Droid).
// Aplikacja odpytuje publiczne API Release'ów, porównuje wersję i — jeśli jest
// nowsza — pozwala pobrać i zainstalować nowy APK (sideload self-update).
import { APP_VERSION, UPDATE_REPO } from '../config';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  apkUrl?: string;
  notes?: string;
  htmlUrl?: string;
}

/** Porównuje wersje semver. Zwraca >0 gdy a>b, <0 gdy a<b, 0 gdy równe. */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const base: UpdateInfo = {
    available: false,
    currentVersion: APP_VERSION,
    latestVersion: APP_VERSION,
  };
  try {
    const res = await fetch(
      `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) return base;
    const data = await res.json();
    const latestVersion: string = (data.tag_name ?? data.name ?? '').toString();
    const apk = (data.assets ?? []).find((a: any) =>
      String(a.name).toLowerCase().endsWith('.apk'),
    );
    const available =
      !!latestVersion && compareSemver(latestVersion, APP_VERSION) > 0;
    return {
      available,
      currentVersion: APP_VERSION,
      latestVersion: latestVersion || APP_VERSION,
      apkUrl: apk?.browser_download_url,
      notes: data.body,
      htmlUrl: data.html_url,
    };
  } catch {
    return base;
  }
}

/** Otwiera URL APK, aby system pobrał i zaproponował instalację. */
export async function downloadAndInstall(url: string): Promise<void> {
  const isNative =
    typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      /* fallback */
    }
  }
  window.open(url, '_blank', 'noopener');
}
