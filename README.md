# Nawigacja terenowa „TomTom++” z check-listą zadań (Android)

Mobilna nawigacja terenowa dla handlowca / serwisanta / kuriera:
trasa wielopunktowa z **automatyczną optymalizacją kolejności**, mapa,
**nawigacja turn-by-turn** (GPS, baner manewru, ETA, prowadzenie głosowe TTS,
re-routing) oraz **check-lista zadań przypięta do każdego przystanku** —
kierowca po dojechaniu widzi „co miał tu zrobić” i odhacza zadania przyciskiem
**„Zrobione”**. Dane trzymane offline + historia tras. Build do APK przez
Capacitor.

> **Działa od razu, w pełni — bez żadnych kluczy API.** Realna mapa OSM
> (MapLibre + OpenStreetMap/CARTO), prawdziwe geokodowanie (Nominatim),
> prawdziwe trasy i optymalizacja kolejności (OSRM). Nic nie trzeba
> konfigurować — instalujesz APK i jeździsz.

---

## 🚚 Funkcje „busiarza" (last-mile / field service)

Na bazie researchu realnych potrzeb kuriera/serwisanta dołożono pełny zestaw
narzędzi pracy w terenie:

- **Proof of Delivery (POD)** na przystanku: **podpis odbiorcy** (rysik/palec na
  ekranie), **zdjęcie-dowód**, **imię odbiorcy**, **wynik dostawy**
  (Dostarczono / Częściowo / Nieudane z powodem).
- **Skaner kodów kreskowych/QR** przesyłek (natywny `BarcodeDetector` + kamera,
  fallback ręczny): **skan załadunku** (sprawdź, czy wszystkie paczki na
  pokładzie) oraz skan przy doręczeniu.
- **Paczki per przystanek** (numer/kod, opis, status skanu).
- **Pobranie (COD)** — kwota do pobrania, oznaczenie „pobrane", **suma pobrań**
  na żywo i w raporcie; konfigurowalna waluta (PLN/EUR/GBP/CZK/USD).
- **Okna czasowe** doręczenia (od–do) na przystanku.
- **Szybki kontakt** z klientem: **zadzwoń** / **SMS** jednym dotykiem.
- **Czas pracy kierowcy** (zmiana / jazda / przerwy) z **przypomnieniem o
  przerwie** po 4,5 h ciągłej jazdy.
- **Pominięcie/przełożenie** przystanku z powodem.
- **Raport dnia** rozszerzony o POD, pobrania, paczki, wyniki i podpis kierowcy.
- **Tryb pracy**: kurier/dostawy lub przewóz osób.

## Stack

- **React 18 + TypeScript + Vite**
- **Capacitor 6** (`@capacitor/android`) — webview → APK
- **MapLibre GL JS** + **OpenStreetMap/CARTO** — mapa (darmowa, bez klucza)
- **OSRM** — trasy (`/route`) i optymalizacja kolejności (`/trip`)
- **Nominatim (OSM)** — geokodowanie adresów
- **Zustand** (+ `persist`) — stan i trwałość danych
- `@capacitor/geolocation` — GPS, `@capacitor-community/text-to-speech` — TTS,
  `@capacitor-community/background-geolocation` — tło, `@capacitor/preferences` —
  zapis

## Szybki start (web / dev)

```bash
npm install
npm run dev               # http://localhost:5173 — działa bez żadnych kluczy
```

Żadnej konfiguracji nie trzeba — mapa, geokodowanie i trasy działają od razu
(darmowe serwery OSM). Do testów nawigacji bez wychodzenia na drogę jest
**symulacja GPS** (przycisk „🧪 Symulacja” w trybie nawigacji), która przejeżdża
pojazdem po geometrii trasy — pozwala przetestować baner manewru, głos,
auto-arrival,
check-listę i re-routing bez wychodzenia na drogę.

## Konfiguracja (opcjonalna — domyślnie nic nie trzeba)

Aplikacja używa **darmowych, publicznych serwerów OSM** i działa bez kluczy.
Do produkcji / większego ruchu warto wskazać własne instancje przez `.env`
(`src/config.ts`), bo publiczne serwery mają limity:

```
# wszystkie opcjonalne
VITE_OSRM_URL=https://twoj-osrm.example.com
VITE_NOMINATIM_URL=https://twoj-nominatim.example.com
VITE_MAP_STYLE=https://twoj-styl-maplibre.json   # własny styl wektorowy
VITE_UPDATE_REPO=talent620/jajek-navi
```

> **Limity publicznych serwerów:** Nominatim ~1 zapytanie/s (stąd dłuższy
> debounce w wyszukiwarce), a `router.project-osrm.org` to serwer demo OSRM —
> do intensywnej pracy postaw własny OSRM/Nominatim (Docker) i wskaż go w env.
> Nie ma żadnych sekretów do ukrycia — to otwarte API OSM.

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

## 📥 Gotowy APK do pobrania (GitHub Releases) + auto-aktualizacja

APK budowany jest **automatycznie w GitHub Actions** (runner ma Android SDK i
pełny dostęp do sieci) i publikowany jako **Release**:

- **Pobierz najnowszy:** zakładka **Releases** repozytorium →
  `jajek-navi-<wersja>.apk` (np. `v1.0.0`).
- W Androidzie włącz „Instaluj z nieznanych źródeł" dla przeglądarki/menedżera
  plików i zainstaluj plik.

**Auto-aktualizacja (sideload):** aplikacja sama odpytuje GitHub Releases
(`Ustawienia → Sprawdź aktualizacje`, a także automatycznie przy starcie) i —
gdy jest nowsza wersja — pokazuje baner **„Dostępna aktualizacja"** z
przyciskiem pobrania nowego APK. Działa jak Obtainium / F-Droid: kolejne wydania
są podpisane **tym samym kluczem**, więc instalują się „w miejscu" (nadpisują).

> Workflow: `.github/workflows/android.yml`. Uruchamia się przy pushu na branch
> oraz ręcznie (Actions → *Build Android APK* → *Run workflow*). Build nie
> wymaga żadnych sekretów — mapa i trasy działają na darmowych serwerach OSM.

### 🔑 Podpis (klucz DEMO — ważna uwaga bezpieczeństwa)

Repo zawiera **demonstracyjny** keystore `android/keystore/demo.keystore`
(hasło `jajekdemo`, alias `jajek-demo`) wyłącznie po to, by sideloadowane wydania
miały **stały podpis** i dało się aktualizować w miejscu.

**To NIE jest klucz produkcyjny** — hasła są jawne. Do publikacji w Google Play
wygeneruj własny keystore i podaj go przez sekrety repo
(`ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`) — build.gradle automatycznie ich użyje.

### Dlaczego APK nie powstaje w tej sesji (sandbox)

W zdalnym środowisku tej sesji APK **nie buduje się** przez **politykę egress**:
`dl.google.com` / `maven.google.com` (jedyne źródło Android Gradle Plugin i SDK)
zwracają **403**, a nie ma ich na dozwolonym Maven Central. Dlatego build APK
przeniesiono do **GitHub Actions**, gdzie sieć i SDK są dostępne. Zweryfikowane
lokalnie w sesji: ✅ `npm run build`, ✅ 16 testów (`vitest`),
✅ `cap add/sync android` (9 pluginów). Budowę APK wykonuje CI.

### Build lokalny (na maszynie z SDK)

```bash
cd android && ./gradlew assembleRelease   # podpisany kluczem demo
# APK: android/app/build/outputs/apk/release/app-release.apk
```

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
      (OSRM `/trip`, fallback nearest-neighbour gdy brak sieci).
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
- [x] **APK** budowany w GitHub Actions i publikowany w Releases (download).
- [x] **Auto-aktualizacja** APK z GitHub Releases (baner + ekran Ustawień).

### Udoskonalenia ponad TomTom (sekcja 4.6) — status

- [x] ✅ Check-lista zadań per przystanek
- [x] ✅ Notatka „co tu zrobić" wysuwana po dojechaniu
- [x] ✅ Licznik postępu dnia (przystanki + zadania)
- [x] ✅ Komenda głosowa „Zrobione"
- [x] ✅ **Zdjęcie jako dowód wykonania** (`@capacitor/camera`, `Task.photoUri`,
      miniatura w check-liście)
- [x] ✅ **Podsumowanie końca dnia** — raport tekstowy (`lib/report.ts`) +
      udostępnianie (`@capacitor/share`, fallback Web Share/schowek/plik) —
      przycisk „📤 Raport" na ekranie nawigacji i w Historii
- [x] ✅ **Pominięcie / przełożenie przystanku** z powodem (w check-liście)
- [x] ⬜→🟡 **Tryb offline mapy** — szkielet (`lib/offline/tileCache.ts`:
      planowanie kafli wzdłuż trasy) + przełącznik w Ustawieniach; pełny prefetch
      i serwowanie kafli offline = `// TODO`

## Znane ograniczenia i TODO

- **APK w sandboxie**: nie buduje się przez politykę egress (Google Maven 403) —
  build przeniesiony do GitHub Actions (patrz wyżej).
- **Klucz podpisu**: dołączony jest **demo** keystore (jawne hasła) — do
  produkcji podmień na własny przez sekrety repo.
- **Background geolocation / foreground service**: uprawnienia w manifeście
  ustawione, `locationService` ma punkt wejścia; pełna konfiguracja
  foreground-service przy wygaszonym ekranie wg dokumentacji pluginu —
  `// TODO` w `locationService.ts`.
- **Offline mapy**: prefetch i lokalny cache kafli — `// TODO`
  (`lib/offline/tileCache.ts` ma już planowanie kafli).
- **Publiczne serwery OSM mają limity** (Nominatim ~1/s, OSRM demo) — do
  intensywnej pracy postaw własny OSRM/Nominatim i wskaż w `.env`.
- **Brak sieci**: mapa pokazuje markery/trasę na ciemnym tle, a geokodowanie/
  trasy mają awaryjny fallback, by aplikacja się nie wywaliła.
- **Drag&drop kolejności**: przyciski ↑/↓ (niezawodne na dotyku); pełny drag — TODO.

## Uprawnienia Android (AndroidManifest.xml)

`INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`. Runtime permission flow w
`locationService.requestLocationPermission()`.
