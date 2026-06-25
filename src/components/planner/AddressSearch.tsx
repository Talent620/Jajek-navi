// Wyszukiwarka adresu z autouzupełnianiem (geokodowanie Mapbox / mock).
import { useEffect, useRef, useState } from 'react';
import { geocode, type GeocodeResult } from '../../services/mapboxService';
import type { LngLat } from '../../types';

interface Props {
  proximity?: LngLat;
  placeholder?: string;
  onPick: (r: GeocodeResult) => void;
}

export function AddressSearch({ proximity, placeholder, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await geocode(query, proximity);
        setResults(r);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, proximity]);

  return (
    <div className="address-search">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder ?? 'Wpisz adres lub nazwę…'}
      />
      {loading && <span className="search-spinner">…</span>}
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lng},${i}`}
              onClick={() => {
                onPick(r);
                setQuery('');
                setResults([]);
                setOpen(false);
              }}
            >
              <strong>{r.label}</strong>
              <span>{r.address}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
