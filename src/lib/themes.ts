// Motywy kolorystyczne (akcent neonowy) — stosowane do zmiennych CSS i do 3D.
export type Accent = 'cyan' | 'magenta' | 'emerald' | 'amber' | 'plasma';

export interface Theme {
  label: string;
  neon: string; // główny akcent
  neon2: string; // drugorzędny
  neon3: string; // trzeci (gradienty)
  three: number; // kolor dla three.js (hex int)
}

export const THEMES: Record<Accent, Theme> = {
  cyan: { label: 'Cyjan', neon: '#22d3ee', neon2: '#38bdf8', neon3: '#a855f7', three: 0x22d3ee },
  magenta: { label: 'Magenta', neon: '#f472b6', neon2: '#d946ef', neon3: '#a855f7', three: 0xf472b6 },
  emerald: { label: 'Szmaragd', neon: '#34d399', neon2: '#10b981', neon3: '#22d3ee', three: 0x34d399 },
  amber: { label: 'Bursztyn', neon: '#f59e0b', neon2: '#fbbf24', neon3: '#fb7185', three: 0xf59e0b },
  plasma: { label: 'Plazma', neon: '#a855f7', neon2: '#6366f1', neon3: '#22d3ee', three: 0xa855f7 },
};

/** Stosuje motyw do zmiennych CSS na :root. */
export function applyAccent(accent: Accent) {
  const t = THEMES[accent] ?? THEMES.cyan;
  const root = document.documentElement.style;
  root.setProperty('--neon', t.neon);
  root.setProperty('--neon-2', t.neon2);
  root.setProperty('--neon-3', t.neon3);
  root.setProperty('--primary', t.neon2);
  root.setProperty('--primary-2', t.neon);
  root.setProperty('--hud-border', `${t.neon}47`);
}

export function accentThreeColor(accent: Accent): number {
  return (THEMES[accent] ?? THEMES.cyan).three;
}
