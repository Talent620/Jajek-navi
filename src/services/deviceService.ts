// Natywne „bajery" urządzenia: wibracje, ekran zawsze włączony, status bar,
// status sieci, powiadomienia lokalne. Wszystko z bezpiecznym fallbackiem na web.

function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
}

/* ----------------------------- HAPTICS ----------------------------- */

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export async function haptic(kind: HapticKind = 'medium') {
  try {
    if (isNative()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'success' || kind === 'warning' || kind === 'error') {
        const type =
          kind === 'success'
            ? NotificationType.Success
            : kind === 'warning'
              ? NotificationType.Warning
              : NotificationType.Error;
        await Haptics.notification({ type });
      } else {
        const style =
          kind === 'light' ? ImpactStyle.Light : kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Medium;
        await Haptics.impact({ style });
      }
      return;
    }
  } catch {
    /* fallback */
  }
  // Web fallback — Vibration API
  try {
    const map: Record<HapticKind, number | number[]> = {
      light: 15,
      medium: 30,
      heavy: 60,
      success: [20, 40, 20],
      warning: [40, 30, 40],
      error: [60, 40, 60, 40, 60],
    };
    navigator.vibrate?.(map[kind]);
  } catch {
    /* brak wibracji */
  }
}

/* --------------------------- KEEP AWAKE ---------------------------- */

export async function keepScreenAwake(on: boolean) {
  if (!isNative()) return;
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch {
    /* plugin niedostępny */
  }
}

/* --------------------------- STATUS BAR ---------------------------- */

export async function initStatusBar() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#05080d' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    /* iOS/web — ignoruj */
  }
}

/* ----------------------------- NETWORK ----------------------------- */

export async function onNetworkChange(cb: (online: boolean) => void): Promise<() => void> {
  if (isNative()) {
    try {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      cb(status.connected);
      const handle = await Network.addListener('networkStatusChange', (s) => cb(s.connected));
      return () => handle.remove();
    } catch {
      /* fallback web */
    }
  }
  const online = () => cb(navigator.onLine);
  window.addEventListener('online', online);
  window.addEventListener('offline', online);
  online();
  return () => {
    window.removeEventListener('online', online);
    window.removeEventListener('offline', online);
  };
}

/* ------------------------- LOCAL NOTIFICATIONS --------------------- */

export async function notify(title: string, body: string, atSecondsFromNow?: number) {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1_000_000),
          title,
          body,
          schedule: atSecondsFromNow
            ? { at: new Date(Date.now() + atSecondsFromNow * 1000) }
            : undefined,
        },
      ],
    });
  } catch {
    /* ignoruj */
  }
}
