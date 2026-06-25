import { describe, it, expect } from 'vitest';
import { weatherCodeToPl } from './weatherService';
import { sortByDistance, type Poi } from './poiService';

describe('weatherCodeToPl', () => {
  it('mapuje znane kody WMO', () => {
    expect(weatherCodeToPl(0).desc).toBe('Bezchmurnie');
    expect(weatherCodeToPl(3).desc).toBe('Pochmurno');
    expect(weatherCodeToPl(63).desc).toBe('Deszcz');
    expect(weatherCodeToPl(75).desc).toBe('Śnieg');
    expect(weatherCodeToPl(95).desc).toBe('Burza');
  });
  it('zawsze zwraca ikonę i opis', () => {
    for (const c of [0, 1, 2, 3, 45, 51, 61, 71, 80, 85, 95, 999]) {
      const r = weatherCodeToPl(c);
      expect(r.icon.length).toBeGreaterThan(0);
      expect(r.desc.length).toBeGreaterThan(0);
    }
  });
});

describe('poiService.sortByDistance', () => {
  const mk = (id: string, d: number): Poi => ({
    id,
    name: id,
    kind: 'fuel',
    lat: 0,
    lng: 0,
    distanceMeters: d,
  });
  it('sortuje rosnąco i przycina do limitu', () => {
    const out = sortByDistance([mk('c', 300), mk('a', 100), mk('b', 200)], 2);
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('nie mutuje wejścia', () => {
    const input = [mk('c', 300), mk('a', 100)];
    const copy = [...input];
    sortByDistance(input);
    expect(input.map((p) => p.id)).toEqual(copy.map((p) => p.id));
  });
});
