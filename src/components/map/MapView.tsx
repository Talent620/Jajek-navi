// Mapa: MapLibre GL + darmowe kafle OpenFreeMap (OSM) — bez kluczy API.
// Fallback na mapę schematyczną tylko, gdy WebGL/MapLibre się nie zainicjuje.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Fix, RouteLeg, Stop, LngLat } from '../../types';
import { MAP_STYLE_URL } from '../../config';
import { useSettingsStore } from '../../store/settingsStore';
import { combinedRouteCoords } from '../../lib/navigation/offroute';
import { SchematicMap } from './SchematicMap';

// Wbudowane style rastrowe (bez kluczy API): ciemny/jasny (CARTO) i satelita (Esri).
type MapStyleKey = 'dark' | 'light' | 'satellite';

function rasterStyle(tiles: string[], attribution: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: { base: { type: 'raster', tiles, tileSize: 256, attribution } },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

// Pojedynczy subdomena (a.) — by URL-e były identyczne z prefetchem offline.
const STYLES: Record<MapStyleKey, maplibregl.StyleSpecification> = {
  dark: rasterStyle(
    ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
    '© OpenStreetMap, © CARTO',
  ),
  light: rasterStyle(
    ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
    '© OpenStreetMap, © CARTO',
  ),
  satellite: rasterStyle(
    ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    'Imagery © Esri',
  ),
};

interface Props {
  legs: RouteLeg[];
  stops: Stop[];
  start?: LngLat;
  userFix?: Fix | null;
  follow?: boolean;
  activeStopIndex?: number;
}

export function MapView(props: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <SchematicMap {...props} />;
  return <LibreMap {...props} onFail={() => setFailed(true)} />;
}

function LibreMap({
  legs,
  stops,
  start,
  userFix,
  follow,
  activeStopIndex,
  onFail,
}: Props & { onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const flowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapStyle = useSettingsStore((s) => s.mapStyle);

  // Dodaje źródło + warstwy trasy (po starcie i po zmianie stylu mapy).
  const addRouteLayers = (map: maplibregl.Map) => {
    if (!map.getSource('route')) {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
    }
    if (!map.getLayer('route-glow'))
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#22d3ee', 'line-width': 18, 'line-blur': 12, 'line-opacity': 0.45 },
      });
    if (!map.getLayer('route-line'))
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#38bdf8', 'line-width': 6, 'line-opacity': 0.95 },
      });
    if (!map.getLayer('route-flow'))
      map.addLayer({
        id: 'route-flow',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e0fbff', 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] },
      });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL || STYLES[mapStyle],
        center: start ? [start.lng, start.lat] : [20.4801, 53.7784],
        zoom: 12,
        attributionControl: { compact: true },
      });
    } catch {
      onFail();
      return;
    }
    map.on('error', (e) => {
      if (!loadedRef.current && e?.error) onFail();
    });
    map.on('load', () => {
      loadedRef.current = true;
      addRouteLayers(map);
      startFlowAnimation();
      drawRoute();
      drawMarkers();
    });
    // po zmianie stylu (setStyle) warstwy trasy są usuwane — dodaj je ponownie
    map.on('styledata', () => {
      if (loadedRef.current) {
        addRouteLayers(map);
        drawRoute();
      }
    });
    mapRef.current = map;
    return () => {
      if (flowTimerRef.current) clearInterval(flowTimerRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zmiana stylu mapy (ciemny/jasny/satelita) bez podanego własnego URL.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || MAP_STYLE_URL) return;
    map.setStyle(STYLES[mapStyle]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // Animacja „przepływu" po trasie — cyklicznie zmienia wzór kreski.
  const startFlowAnimation = () => {
    const dashSeq = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let step = 0;
    if (flowTimerRef.current) clearInterval(flowTimerRef.current);
    flowTimerRef.current = setInterval(() => {
      const map = mapRef.current;
      if (!map || !loadedRef.current || !map.getLayer('route-flow')) return;
      step = (step + 1) % dashSeq.length;
      try {
        map.setPaintProperty('route-flow', 'line-dasharray', dashSeq[step]);
      } catch {
        /* warstwa chwilowo niedostępna */
      }
    }, 90);
  };

  const drawRoute = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const coords = combinedRouteCoords(legs);
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    }
    if (coords.length > 1 && !follow) {
      const b = new maplibregl.LngLatBounds();
      coords.forEach((c) => b.extend(c as [number, number]));
      map.fitBounds(b, { padding: 60, duration: 600, maxZoom: 15 });
    }
  };

  const drawMarkers = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    const ordered = [...stops].sort((a, b) => a.order - b.order);
    ordered.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'map-stop-marker';
      el.textContent = String(i + 1);
      el.style.background =
        s.completed || s.skipped ? '#22c55e' : i === activeStopIndex ? '#f59e0b' : '#ef4444';
      const m = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${s.label} — ${s.address}`))
        .addTo(map);
      stopMarkersRef.current.push(m);
    });

    if (start) {
      if (!startMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'map-start-marker';
        el.textContent = 'S';
        startMarkerRef.current = new maplibregl.Marker({ element: el }).addTo(map);
      }
      startMarkerRef.current.setLngLat([start.lng, start.lat]);
    }
  };

  useEffect(() => {
    drawRoute();
    drawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, stops, start, activeStopIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !userFix) return;
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'map-user-marker';
      el.innerHTML = '<div class="arrow"></div>';
      userMarkerRef.current = new maplibregl.Marker({ element: el }).addTo(map);
    }
    userMarkerRef.current.setLngLat([userFix.lng, userFix.lat]);
    const arrow = userMarkerRef.current.getElement().querySelector('.arrow') as HTMLElement | null;
    if (arrow) arrow.style.transform = `rotate(${userFix.heading ?? 0}deg)`;

    if (follow) {
      map.easeTo({
        center: [userFix.lng, userFix.lat],
        bearing: userFix.heading ?? map.getBearing(),
        pitch: 55,
        zoom: 16,
        duration: 800,
      });
    }
  }, [userFix, follow]);

  const cycleStyle = () => {
    const order: MapStyleKey[] = ['dark', 'light', 'satellite'];
    const next = order[(order.indexOf(mapStyle) + 1) % order.length];
    useSettingsStore.getState().setMapStyle(next);
  };
  const styleIcon = mapStyle === 'dark' ? '🌙' : mapStyle === 'light' ? '☀️' : '🛰️';

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />
      {!MAP_STYLE_URL && (
        <button className="map-style-btn" onClick={cycleStyle} aria-label="Zmień styl mapy">
          {styleIcon}
        </button>
      )}
    </div>
  );
}
