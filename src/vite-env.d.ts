/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_MAPBOX_STYLE?: string;
  readonly VITE_UPDATE_REPO?: string; // np. "talent620/jajek-navi"
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
