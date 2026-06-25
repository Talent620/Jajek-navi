/**
 * Centralny odczyt konfiguracji ze zmiennych środowiskowych Vite.
 * NIE hardkoduj tu kluczy — wczytujemy je z import.meta.env (plik .env).
 */

export const MAPBOX_TOKEN: string = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

export const MAPBOX_STYLE: string =
  import.meta.env.VITE_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/navigation-night-v1';

/** Czy mamy realny token Mapbox? Jeśli nie — aplikacja działa w trybie mock. */
export const HAS_MAPBOX_TOKEN: boolean =
  MAPBOX_TOKEN.startsWith('pk.') && MAPBOX_TOKEN.length > 20;

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

if (!HAS_MAPBOX_TOKEN && import.meta.env.DEV) {
  // Tylko w devie — nie logujemy w produkcji (sekcja 11).
  console.warn(
    '[config] Brak VITE_MAPBOX_TOKEN — aplikacja działa w trybie MOCK (dane przykładowe).',
  );
}
