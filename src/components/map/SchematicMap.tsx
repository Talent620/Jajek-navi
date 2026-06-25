// Zapasowa „mapa" schematyczna (SVG) — używana, gdy brak tokena Mapbox.
// Pozwala testować planowanie i nawigację (mock GPS) bez klucza API.
import { useMemo } from 'react';
import type { Fix, RouteLeg, Stop, LngLat } from '../../types';
import { combinedRouteCoords } from '../../lib/navigation/offroute';

interface Props {
  legs: RouteLeg[];
  stops: Stop[];
  start?: LngLat;
  userFix?: Fix | null;
  activeStopIndex?: number;
}

export function SchematicMap({ legs, stops, start, userFix, activeStopIndex }: Props) {
  const W = 1000;
  const H = 1000;
  const pad = 60;

  const { project, hasGeo } = useMemo(() => {
    const pts: number[][] = [...combinedRouteCoords(legs)];
    for (const s of stops) pts.push([s.lng, s.lat]);
    if (start) pts.push([start.lng, start.lat]);
    if (userFix) pts.push([userFix.lng, userFix.lat]);
    if (pts.length === 0) {
      return { project: (_: LngLat) => ({ x: W / 2, y: H / 2 }), hasGeo: false };
    }
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    const spanLng = Math.max(1e-6, maxLng - minLng);
    const spanLat = Math.max(1e-6, maxLat - minLat);
    const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
    const project = (p: LngLat) => ({
      x: pad + (p.lng - minLng) * scale,
      // y odwrócone (lat rośnie w górę)
      y: H - (pad + (p.lat - minLat) * scale),
    });
    return { project, hasGeo: true };
  }, [legs, stops, start, userFix]);

  const routePath = useMemo(() => {
    const coords = combinedRouteCoords(legs);
    if (coords.length < 2) return '';
    return coords
      .map((c, i) => {
        const { x, y } = project({ lng: c[0], lat: c[1] });
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [legs, project]);

  const ordered = [...stops].sort((a, b) => a.order - b.order);

  return (
    <svg
      className="schematic-map"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Schematyczna mapa trasy (tryb bez tokena Mapbox)"
    >
      <rect x={0} y={0} width={W} height={H} fill="#0b0f14" />
      {/* siatka */}
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={(i * W) / 10}
          y1={0}
          x2={(i * W) / 10}
          y2={H}
          stroke="#16202b"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={(i * H) / 10}
          x2={W}
          y2={(i * H) / 10}
          stroke="#16202b"
          strokeWidth={1}
        />
      ))}

      {routePath && (
        <path
          d={routePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={8}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
      )}

      {start && (
        <g>
          {(() => {
            const { x, y } = project(start);
            return (
              <>
                <circle cx={x} cy={y} r={16} fill="#22c55e" stroke="#0b0f14" strokeWidth={3} />
                <text x={x} y={y + 5} textAnchor="middle" fontSize={16} fill="#0b0f14" fontWeight="bold">
                  S
                </text>
              </>
            );
          })()}
        </g>
      )}

      {ordered.map((s, i) => {
        const { x, y } = project({ lng: s.lng, lat: s.lat });
        const active = i === activeStopIndex;
        const fill = s.completed ? '#22c55e' : active ? '#f59e0b' : '#ef4444';
        return (
          <g key={s.id}>
            <circle cx={x} cy={y} r={active ? 22 : 18} fill={fill} stroke="#0b0f14" strokeWidth={3} />
            <text x={x} y={y + 6} textAnchor="middle" fontSize={18} fill="#0b0f14" fontWeight="bold">
              {i + 1}
            </text>
          </g>
        );
      })}

      {userFix && (
        <g>
          {(() => {
            const { x, y } = project(userFix);
            const rot = userFix.heading ?? 0;
            return (
              <g transform={`translate(${x},${y}) rotate(${rot})`}>
                <circle r={26} fill="#2563eb" opacity={0.25} />
                <path d="M0,-20 L13,16 L0,8 L-13,16 Z" fill="#60a5fa" stroke="#0b0f14" strokeWidth={2} />
              </g>
            );
          })()}
        </g>
      )}

      {!hasGeo && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={28} fill="#64748b">
          Dodaj przystanki, aby zobaczyć trasę
        </text>
      )}
    </svg>
  );
}
