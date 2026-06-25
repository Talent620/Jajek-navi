// Pogoda w punkcie (np. następny przystanek) — Open-Meteo.
import { useEffect, useState } from 'react';
import { getWeather, type Weather } from '../services/weatherService';
import { useSettingsStore } from '../store/settingsStore';
import type { LngLat } from '../types';

interface Props {
  at?: LngLat;
  label?: string;
}

export function WeatherChip({ at, label }: Props) {
  const enabled = useSettingsStore((s) => s.weather);
  const [w, setW] = useState<Weather | null>(null);

  useEffect(() => {
    if (!enabled || !at) {
      setW(null);
      return;
    }
    let active = true;
    getWeather(at).then((res) => {
      if (active) setW(res);
    });
    return () => {
      active = false;
    };
    // odśwież gdy zmieni się cel (zaokrąglone, by nie spamować)
  }, [enabled, at?.lat?.toFixed(2), at?.lng?.toFixed(2)]);

  if (!enabled || !w) return null;
  return (
    <div className="weather-chip" title={w.desc}>
      <span className="weather-icon">{w.icon}</span>
      <span className="weather-temp">{w.tempC}°</span>
      {label && <span className="weather-label">{label}</span>}
    </div>
  );
}
