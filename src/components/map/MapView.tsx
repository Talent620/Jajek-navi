// Mapa: prawdziwy Mapbox GL JS gdy jest token, inaczej schematyczny fallback.
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Fix, RouteLeg, Stop, LngLat } from '../../types';
import { HAS_MAPBOX_TOKEN, MAPBOX_TOKEN, MAPBOX_STYLE } from '../../config';
import { combinedRouteCoords } from '../../lib/navigation/offroute';
import { SchematicMap } from './SchematicMap';

interface Props {
  legs: RouteLeg[];
  stops: Stop[];
  start?: LngLat;
  userFix?: Fix | null;
  follow?: boolean; // tryb nawigacji: kamera śledzi użytkownika
  activeStopIndex?: number;
}

export function MapView(props: Props) {
  if (!HAS_MAPBOX_TOKEN) {
    return <SchematicMap {...props} />;
  }
  return <MapboxMap {...props} />;
}

function MapboxMap({ legs, stops, start, userFix, follow, activeStopIndex }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const loadedRef = useRef(false);

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: start ? [start.lng, start.lat] : [20.4801, 53.7784],
      zoom: 12,
      attributionControl: false,
    });
    map.on('load', () => {
      loadedRef.current = true;
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.9 },
      });
      drawRoute();
      drawMarkers();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawRoute = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const coords = combinedRouteCoords(legs);
    const src = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    }
    if (coords.length > 1 && !follow) {
      const b = new mapboxgl.LngLatBounds();
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
      el.style.background = s.completed ? '#22c55e' : i === activeStopIndex ? '#f59e0b' : '#ef4444';
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${s.label} — ${s.address}`))
        .addTo(map);
      stopMarkersRef.current.push(m);
    });

    if (start) {
      if (!startMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'map-start-marker';
        el.textContent = 'S';
        startMarkerRef.current = new mapboxgl.Marker({ element: el }).addTo(map);
      }
      startMarkerRef.current.setLngLat([start.lng, start.lat]);
    }
  };

  // aktualizacja trasy / markerów
  useEffect(() => {
    drawRoute();
    drawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, stops, start, activeStopIndex]);

  // pozycja użytkownika + kamera follow
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !userFix) return;
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'map-user-marker';
      el.innerHTML = '<div class="arrow"></div>';
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).addTo(map);
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

  return <div ref={containerRef} className="map-container" />;
}
