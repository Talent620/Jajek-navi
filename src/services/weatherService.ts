// Pogoda w punkcie — Open-Meteo (darmowe, bez klucza, bez limitów dla MVP).
import type { LngLat } from '../types';
import { fetchT } from '../lib/http';

export interface Weather {
  tempC: number;
  windKmh: number;
  code: number;
  icon: string;
  desc: string;
}

/** Mapowanie kodu pogody WMO → ikona + opis PL (czysta funkcja, testowalna). */
export function weatherCodeToPl(code: number): { icon: string; desc: string } {
  if (code === 0) return { icon: '☀️', desc: 'Bezchmurnie' };
  if (code === 1 || code === 2) return { icon: '🌤️', desc: 'Częściowe zachmurzenie' };
  if (code === 3) return { icon: '☁️', desc: 'Pochmurno' };
  if (code === 45 || code === 48) return { icon: '🌫️', desc: 'Mgła' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', desc: 'Mżawka' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', desc: 'Deszcz' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', desc: 'Śnieg' };
  if (code >= 80 && code <= 82) return { icon: '🌧️', desc: 'Przelotny deszcz' };
  if (code >= 85 && code <= 86) return { icon: '🌨️', desc: 'Przelotny śnieg' };
  if (code >= 95) return { icon: '⛈️', desc: 'Burza' };
  return { icon: '🌡️', desc: 'Pogoda' };
}

export async function getWeather(at: LngLat): Promise<Weather | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(at.lat),
      longitude: String(at.lng),
      current: 'temperature_2m,weather_code,wind_speed_10m',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    });
    const res = await fetchT(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data.current;
    if (!cur || cur.temperature_2m == null) return null;
    const code = cur.weather_code ?? 0;
    const { icon, desc } = weatherCodeToPl(code);
    return {
      tempC: Math.round(cur.temperature_2m),
      windKmh: Math.round(cur.wind_speed_10m ?? 0),
      code,
      icon,
      desc,
    };
  } catch {
    return null;
  }
}
