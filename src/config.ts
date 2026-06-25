/**
 * Centralny odczyt konfiguracji ze zmiennych środowiskowych Vite.
 * NIE hardkoduj tu kluczy — wczytujemy je z import.meta.env (plik .env).
 */

/** Wersja aplikacji (z package.json, wstrzykiwana przez Vite). */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/** Repo GitHub do sprawdzania aktualizacji APK (owner/repo). */
export const UPDATE_REPO: string =
  import.meta.env.VITE_UPDATE_REPO ?? 'talent620/jajek-navi';

// --- Darmowy, otwarty stos (bez kluczy API) ---
// Mapa: MapLibre GL + OpenFreeMap (darmowe kafle OSM, bez tokena).
// Routing/optymalizacja: OSRM. Geokodowanie: Nominatim (OSM).
// Można nadpisać własnymi serwerami przez zmienne env.

/** Opcjonalny URL stylu MapLibre (vector). Puste = wbudowany ciemny raster OSM. */
export const MAP_STYLE_URL: string = import.meta.env.VITE_MAP_STYLE ?? '';

/** Serwer OSRM (trasy + optymalizacja). */
export const OSRM_URL: string =
  import.meta.env.VITE_OSRM_URL ?? 'https://router.project-osrm.org';

/** Serwer Nominatim (geokodowanie OSM). */
export const NOMINATIM_URL: string =
  import.meta.env.VITE_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';

/** Progi nawigacji (metry / sekundy) — zebrane w jednym miejscu. */
export const NAV = {
  /** Dystans do punktu manewru, poniżej którego przechodzimy do kolejnego kroku. */
  stepAdvanceMeters: 30,
  /** Dystans, z jakim zapowiadamy manewr głosowo z wyprzedzeniem. */
  announceAheadMeters: 200,
  /** Promień „dojechałem" do przystanku. */
  arrivalRadiusMeters: 50,
  /** Odległość od linii trasy uznawana za zjazd z trasy. */
  offRouteMeters: 50,
  /** Liczba kolejnych pomiarów poza trasą, by wyzwolić re-routing. */
  offRouteConsecutive: 2,
  /** Odrzucaj pomiary GPS o gorszej dokładności niż (metry). */
  maxAcceptableAccuracy: 50,
} as const;
