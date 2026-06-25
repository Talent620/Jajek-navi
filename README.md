# Nawigacja terenowa „TomTom++” z check-listą zadań (Android)

Mobilna nawigacja terenowa dla handlowca / serwisanta / kuriera:
trasa wielopunktowa z **automatyczną optymalizacją kolejności**, mapa,
**nawigacja turn-by-turn** (GPS, baner manewru, ETA, prowadzenie głosowe TTS,
re-routing) oraz **check-lista zadań przypięta do każdego przystanku** —
kierowca po dojechaniu widzi „co miał tu zrobić” i odhacza zadania przyciskiem
**„Zrobione”**. Dane trzymane offline + historia tras. Build do APK przez
Capacitor.

> Aplikacja działa **od razu bez tokena Mapbox** — w trybie **MOCK** (mapa
> schematyczna SVG + przykładowe trasy + symulacja jazdy), żeby dało się
> przeklikać i przetestować całą logikę nawigacji. Po dodaniu tokena włącza
> się prawdziwa mapa Mapbox, geokodowanie, optymalizacja i trasy.

---

## Stack

- **React 18 + TypeScript + Vite**
- **Capacitor 6** (`@capacitor/android`) — webview → APK
- **Mapbox GL JS** — mapa; **Directions / Optimization / Geocoding API**
- **Zustand** (+ `persist`) — stan i trwałość danych
- `@capacitor/geolocation` — GPS, `@capacitor-community/text-to-speech` — TTS,
  `@capacitor-community/background-geolocation` — tło, `@capacitor/preferences` —
  zapis

## Szybki start (web / dev)

```bash
npm install
cp .env.example .env      # opcjonalnie: wpisz token Mapbox
npm run dev               # http://localhost:5173
```

Bez tokena aplikacja wstaje w trybie MOCK. Domyślnie włączona jest **symulacja
GPS** (przycisk „🧪 Symulacja” w trybie nawigacji), która przejeżdża pojazdem po
geometrii trasy — pozwala przetestować baner manewru, głos, auto-arrival,
check-listę i re-routing bez wychodzenia na drogę.

## Konfiguracja klucza Mapbox (sekcja 11 — bezpieczeństwo)

1. Załóż konto i wygeneruj **publiczny** token (`pk.…`) na
   <https://account.mapbox.com/access-tokens/>.
2. `cp .env.example .env` i ustaw:
   ```
   VITE_MAPBOX_TOKEN=pk.twoj_token
   VITE_MAPBOX_STYLE=mapbox://styles/mapbox/navigation-night-v1
   ```
3. **Nigdy nie commituj `.env`** — jest w `.gitignore`. W panelu Mapbox ustaw
   **URL/token restrictions** dla tokena publicznego.

Token czytany jest wyłącznie z `import.meta.env.VITE_MAPBOX_TOKEN`
(`src/config.ts`) — nigdzie nie jest hardkodowany. Współrzędne i tokeny nie są
logowane w buildzie produkcyjnym.

## Build APK (Android)

```bash
npm run build            # bundla web → dist/
npx cap sync android     # kopiuje dist + pluginy do android/
# wariant A (Android Studio):
npx cap open android     # Build > Build APK(s)
# wariant B (CLI):
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Platforma `android/` jest już wygenerowana i skonfigurowana (uprawnienia,
pluginy). `appId = pl.vai.nawigacja`.

### ⚠️ Status APK w tym środowisku (ważne)

Debug APK **nie został zbudowany w tym zdalnym środowisku** z powodu **polityki
egress**: pobranie Android Gradle Plugin z `dl.google.com` (Google Maven)
zwraca **HTTP 403** (host zablokowany przez politykę sieciową sesji), a w
środowisku **nie ma zainstalowanego Android SDK** (`ANDROID_HOME` puste).

To ograniczenie **infrastruktury**, nie kodu. Na normalnej maszynie
deweloperskiej z dostępem do `dl.google.com` + Android SDK build przechodzi
standardowo (`./gradlew assembleDebug`). Co jest zweryfikowane tutaj:

- ✅ `npm run build` (web) przechodzi.
- ✅ `npx vitest run` — 16 testów logiki nawigacji zielonych.
- ✅ `npx cap add android` + `npx cap sync` — platforma i pluginy poprawne.
- ⛔ `./gradlew assembleDebug` — blokada na `dl.google.com` (403) + brak SDK.

Aby dokończyć APK lokalnie:
1. Zainstaluj Android SDK (Android Studio lub `cmdline-tools` + `sdkmanager`),
   ustaw `ANDROID_HOME` / `local.properties`.
2. Zapewnij dostęp do `dl.google.com` i `repo1.maven.org`.
3. `cd android && ./gradlew assembleDebug`.

## Skrypty

| polecenie               | opis                                  |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | dev server                            |
| `npm run build`         | typecheck + build produkcyjny (dist)  |
| `npm run typecheck`     | sam typecheck                         |
| `npx vitest run`        | testy logiki nawigacji                |
| `npm run cap:sync`      | `cap sync android`                    |
| `npm run apk:debug`     | `./gradlew assembleDebug`             |

## Architektura

```
src/
  screens/      PlannerScreen, NavigationScreen, TripsScreen
  components/   map/ (MapView, SchematicMap) nav/ (ManeuverBanner, NavStats,
                ChecklistSheet, TaskItem) planner/ (AddressSearch, StopList)
  store/        tripStore, navStore, settingsStore (Zustand + persist)
  services/     mapboxService, locationService, voiceService, storageService
  lib/navigation/  geo.ts, progress.ts, offroute.ts, useNavigationEngine.ts
  lib/format.ts, config.ts, types.ts
```

Logika nawigacji jest **czysta i testowalna**, wydzielona od React
(`src/lib/navigation`): postęp po krokach (`progress.ts`), detekcja zjazdu z
trasy po segmentach polilinii (`offroute.ts`), geometria — haversine, bearing,
point-to-segment, interpolacja wzdłuż trasy (`geo.ts`).

## Co działa (Definition of Done)

- [x] Kompilacja web + struktura projektu; platforma Android wygenerowana.
- [x] Planowanie trasy ≥5 przystanków + **optymalizacja kolejności**
      (Mapbox Optimization, fallback nearest-neighbour > 12 punktów / bez tokena).
- [x] Nawigacja turn-by-turn: baner manewru, ETA/dystans/prędkość, **TTS PL**,
      **re-routing** po zjeździe z trasy (próg + 2 pomiary z rzędu).
- [x] **Check-lista per przystanek**: auto-arrival ~50 m → bottom-sheet z notatką
      „co tu zrobić” + zadania + **„Zrobione”** + „Następny przystanek”.
- [x] Licznik postępu dnia (przystanki + zadania).
- [x] Komenda głosowa **„Zrobione”** (Web Speech Recognition; gdy niedostępna —
      duży przycisk).
- [x] Trwałość (Zustand persist → `@capacitor/preferences` / localStorage) —
      dane przeżywają restart; ekran **Historia**.
- [x] Tryb **mock GPS** (symulacja jazdy po trasie) do testów.
- [ ] **Debug APK** — zablokowany w tym środowisku (patrz wyżej).

## Znane ograniczenia i TODO

- **APK**: wymaga Android SDK + dostępu do `dl.google.com` (tu zablokowane).
- **Background geolocation / foreground service**: uprawnienia w manifeście są
  ustawione, `locationService` ma punkt wejścia; pełna konfiguracja
  foreground-service przy wygaszonym ekranie wg dokumentacji pluginu —
  `// TODO` w `locationService.ts`.
- **Optymalizacja**: Mapbox Optimization v1 ma limit ~12 współrzędnych; powyżej
  oraz bez tokena używamy heurystyki nearest-neighbour (sekcja 7).
- **Drag&drop kolejności**: zaimplementowano przyciski ↑/↓ (niezawodne na
  dotyku); pełny drag — TODO.
- **Udoskonalenia ⬜ (sekcja 4.6)**: zdjęcie-dowód (`@capacitor/camera`),
  raport końca dnia + `@capacitor/share`, pominięcie/przełożenie przystanku,
  offline cache kafli — punkty zaczepienia w modelu danych (`Task.photoUri`),
  do dobudowania.
- **Mock geokodowanie** zwraca deterministyczne punkty wokół Olsztyna — tylko
  dla trybu bez tokena.

## Uprawnienia Android (AndroidManifest.xml)

`INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`. Runtime permission flow w
`locationService.requestLocationPermission()`.
