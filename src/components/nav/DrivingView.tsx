// Wizualizacja jazdy na żywo — nowoczesny widok „z perspektywy kierowcy".
// Bierze realną geometrię trasy przed pojazdem, rzutuje ją na płaszczyznę drogi
// w perspektywie 3D i animuje przepływ pasa/chevronów reagujący na prędkość.
import { useEffect, useRef } from 'react';
import type { Fix, RouteLeg } from '../../types';
import { combinedRouteCoords } from '../../lib/navigation/offroute';
import { distanceToPolyline, haversine } from '../../lib/navigation/geo';

interface Props {
  legs: RouteLeg[];
  fix: Fix | null;
}

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

interface LocalPt {
  x: number; // bok (m): + w prawo
  y: number; // przód (m): + przed pojazd
}

/** Punkty trasy przed pojazdem w lokalnym układzie (przód = +Y), w metrach. */
function forwardPath(coords: number[][], fix: Fix, maxDist = 420, stepM = 7): LocalPt[] {
  if (coords.length < 2) return [];
  const { segmentIndex, t } = distanceToPolyline(fix, coords);
  const heading = toRad(fix.heading ?? 0);
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  const cosLat = Math.cos(toRad(fix.lat));

  const toLocal = (lng: number, lat: number): LocalPt => {
    const e = (lng - fix.lng) * cosLat * R * (Math.PI / 180);
    const n = (lat - fix.lat) * R * (Math.PI / 180);
    return { x: e * cos - n * sin, y: e * sin + n * cos };
  };

  // punkt startowy = rzut pozycji na bieżący segment
  const a = coords[segmentIndex];
  const b = coords[segmentIndex + 1];
  let curLng = a[0] + (b[0] - a[0]) * t;
  let curLat = a[1] + (b[1] - a[1]) * t;
  const out: LocalPt[] = [toLocal(curLng, curLat)];

  let acc = 0;
  let i = segmentIndex + 1;
  let nextSample = stepM;
  while (i < coords.length && acc < maxDist) {
    const from = { lat: curLat, lng: curLng };
    const to = { lat: coords[i][1], lng: coords[i][0] };
    const segLen = haversine(from, to);
    if (segLen < 1e-3) {
      i++;
      curLng = coords[i - 1]?.[0] ?? curLng;
      curLat = coords[i - 1]?.[1] ?? curLat;
      continue;
    }
    while (nextSample <= acc + segLen && nextSample < maxDist) {
      const f = (nextSample - acc) / segLen;
      const lng = from.lng + (to.lng - from.lng) * f;
      const lat = from.lat + (to.lat - from.lat) * f;
      out.push(toLocal(lng, lat));
      nextSample += stepM;
    }
    acc += segLen;
    curLng = to.lng;
    curLat = to.lat;
    i++;
  }
  return out;
}

export function DrivingView({ legs, fix }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef<Props>({ legs, fix });
  propsRef.current = { legs, fix };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const ratio = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    const draw = (now: number) => {
      const { legs, fix } = propsRef.current;
      const W = canvas.width;
      const H = canvas.height;
      const t = (now - start) / 1000;
      const speed = Math.max(0, fix?.speed ?? 0); // m/s
      const cx = W / 2;
      const horizon = H * 0.4;
      const f = H * 0.82; // ogniskowa (px urządzenia)
      const camH = 1.7; // wysokość kamery nad drogą (m)
      const camBack = 3; // kamera nieco za pojazdem (m)

      // perspektywiczne rzutowanie punktu drogi (X bok, Y przód, w metrach)
      const project = (xm: number, ym: number) => {
        const Y = Math.max(0.6, ym + camBack);
        const scale = f / Y; // px na metr na tej głębokości
        return { sx: cx + xm * scale, sy: horizon + camH * scale, scale };
      };

      // --- tło: niebo + ziemia (gradient „z przyszłości") ---
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#0a1830');
      sky.addColorStop(1, '#10283f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, horizon);
      const ground = ctx.createLinearGradient(0, horizon, 0, H);
      ground.addColorStop(0, '#070d16');
      ground.addColorStop(1, '#04070d');
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, W, H - horizon);

      // poświata horyzontu
      const glow = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, W * 0.5);
      glow.addColorStop(0, 'rgba(34,211,238,0.20)');
      glow.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // siatka „neon" na ziemi (linie uciekające do horyzontu)
      ctx.strokeStyle = 'rgba(56,189,248,0.10)';
      ctx.lineWidth = 1 * ratio;
      for (let gx = -10; gx <= 10; gx += 2) {
        const a = project(gx, 0);
        const b = project(gx, 300);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }

      const path = legs.length && fix ? forwardPath(combinedRouteCoords(legs), fix) : [];

      if (path.length >= 2) {
        const halfW = 3.4; // szerokość pół-drogi (m)
        // krawędzie wstęgi drogi
        const left: { sx: number; sy: number }[] = [];
        const right: { sx: number; sy: number }[] = [];
        for (let i = 0; i < path.length; i++) {
          const p = path[i];
          const q = path[Math.min(i + 1, path.length - 1)];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len; // normalna
          const ny = dx / len;
          left.push(project(p.x + nx * halfW, p.y + ny * halfW));
          right.push(project(p.x - nx * halfW, p.y - ny * halfW));
        }

        // wypełnienie asfaltu
        ctx.beginPath();
        ctx.moveTo(left[0].sx, left[0].sy);
        for (const l of left) ctx.lineTo(l.sx, l.sy);
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].sx, right[i].sy);
        ctx.closePath();
        const road = ctx.createLinearGradient(0, horizon, 0, H);
        road.addColorStop(0, '#11202e');
        road.addColorStop(1, '#1b2f40');
        ctx.fillStyle = road;
        ctx.fill();

        // świecące krawędzie
        ctx.lineWidth = 3 * ratio;
        ctx.strokeStyle = 'rgba(34,211,238,0.9)';
        ctx.shadowColor = 'rgba(34,211,238,0.8)';
        ctx.shadowBlur = 14 * ratio;
        for (const edge of [left, right]) {
          ctx.beginPath();
          edge.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // animowane chevrony pasa (przepływ do kierowcy)
        const flow = (t * Math.max(6, speed * 1.2)) % 16;
        for (let d = 0; d < path.length - 1; d++) {
          const distM = d * 7;
          const phase = (distM + flow) % 16;
          if (phase > 8) continue;
          const p = path[d];
          const pr = project(p.x, p.y);
          const size = Math.min(H * 0.16, pr.scale * 1.4);
          if (size < 2) continue;
          const alpha = Math.max(0, 1 - p.y / 300);
          ctx.fillStyle = `rgba(125,240,255,${0.7 * alpha})`;
          ctx.beginPath();
          ctx.moveTo(pr.sx, pr.sy - size);
          ctx.lineTo(pr.sx + size * 0.9, pr.sy + size * 0.4);
          ctx.lineTo(pr.sx, pr.sy + size * 0.1);
          ctx.lineTo(pr.sx - size * 0.9, pr.sy + size * 0.4);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // brak trasy — prosty pas wprost (jedź prosto)
        ctx.strokeStyle = 'rgba(34,211,238,0.7)';
        ctx.lineWidth = 3 * ratio;
        for (const off of [-3.4, 3.4]) {
          const a = project(off, 0);
          const b = project(off, 300);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }

      // --- pojazd (świecący znacznik na dole) ---
      const vy = H - 36 * ratio;
      ctx.save();
      ctx.shadowColor = 'rgba(34,211,238,0.9)';
      ctx.shadowBlur = 22 * ratio;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(cx, vy - 20 * ratio);
      ctx.lineTo(cx + 16 * ratio, vy + 14 * ratio);
      ctx.lineTo(cx, vy + 6 * ratio);
      ctx.lineTo(cx - 16 * ratio, vy + 14 * ratio);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="driving-view" />;
}
