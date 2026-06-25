// fetch z twardym timeoutem (AbortController). Bez tego wolne/niedostępne
// publiczne serwery (OSRM/Nominatim/Overpass/Open-Meteo/GitHub) zawieszają
// zapytanie w nieskończoność, a fallbacki nigdy się nie uruchamiają.
export async function fetchT(
  url: string,
  opts: RequestInit = {},
  ms = 9000,
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
