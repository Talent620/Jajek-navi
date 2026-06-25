import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.vai.nawigacja',
  appName: 'Nawigacja TomTom++',
  webDir: 'dist',
  android: {
    // Pozwala na czysty webview bez mieszanego trybu (mapbox-gl wymaga WebGL)
    allowMixedContent: false,
  },
  plugins: {
    Geolocation: {
      // domyślne; uprawnienia obsługiwane runtime
    },
    BackgroundGeolocation: {
      // Konfiguracja foreground service – patrz README / locationService
    },
  },
};

export default config;
