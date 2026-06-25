// Pasek „brak internetu" — informuje, że mapa/trasy mogą być niedostępne.
import { useEffect, useState } from 'react';
import { onNetworkChange } from '../services/deviceService';

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let cleanup = () => {};
    onNetworkChange(setOnline).then((fn) => (cleanup = fn));
    return () => cleanup();
  }, []);
  if (online) return null;
  return <div className="offline-banner">📡 Brak internetu — mapa i trasy mogą być ograniczone</div>;
}
