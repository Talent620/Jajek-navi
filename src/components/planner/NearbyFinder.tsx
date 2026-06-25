// „W pobliżu" — znajdź najbliższe stacje paliw / parkingi / jedzenie (OSM)
// i dodaj jako przystanek trasy. Świetne dla kierowcy w trasie.
import { useState } from 'react';
import {
  findNearby,
  KIND_LABEL,
  type Poi,
  type PoiKind,
} from '../../services/poiService';
import { formatDistance } from '../../lib/format';
import type { LngLat } from '../../types';

interface Props {
  center?: LngLat;
  onAdd: (poi: Poi) => void;
}

const KINDS: PoiKind[] = ['fuel', 'parking', 'food', 'toilets', 'atm'];

export function NearbyFinder({ center, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PoiKind>('fuel');
  const [results, setResults] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (k: PoiKind) => {
    if (!center) return;
    setKind(k);
    setLoading(true);
    setResults([]);
    try {
      setResults(await findNearby(center, k));
    } finally {
      setLoading(false);
    }
  };

  if (!center) return null;

  return (
    <div className="nearby">
      <button className="btn-secondary nearby-toggle" onClick={() => setOpen((v) => !v)}>
        🔍 W pobliżu (paliwo, parking, jedzenie…)
      </button>
      {open && (
        <div className="nearby-body">
          <div className="nearby-kinds">
            {KINDS.map((k) => (
              <button
                key={k}
                className={`chip-btn ${kind === k ? 'active' : ''}`}
                onClick={() => search(k)}
              >
                {KIND_LABEL[k].icon} {KIND_LABEL[k].label}
              </button>
            ))}
          </div>
          {loading && <p className="empty">Szukam w OpenStreetMap…</p>}
          {!loading && results.length === 0 && (
            <p className="empty">Wybierz kategorię, aby wyszukać w pobliżu.</p>
          )}
          <div className="nearby-results">
            {results.map((p) => (
              <div key={p.id} className="nearby-row">
                <span className="nearby-name">
                  {KIND_LABEL[p.kind].icon} {p.name}
                </span>
                <span className="nearby-dist">{formatDistance(p.distanceMeters)}</span>
                <button className="btn-secondary" onClick={() => onAdd(p)}>
                  + Dodaj
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
