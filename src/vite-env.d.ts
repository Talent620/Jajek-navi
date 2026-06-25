/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_MAP_STYLE?: string; // styl MapLibre (domyślnie OpenFreeMap)
  readonly VITE_OSRM_URL?: string; // serwer OSRM
  readonly VITE_NOMINATIM_URL?: string; // serwer Nominatim
  readonly VITE_UPDATE_REPO?: string; // np. "talent620/jajek-navi"
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
