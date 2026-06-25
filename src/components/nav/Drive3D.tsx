// Drive3D — holograficzna wizualizacja jazdy „na żywo" w prawdziwym 3D (WebGL,
// three.js). Trasa jako świecąca energetyczna wstęga nad neonową siatką,
// kamera-pościg lecąca po trasie, pulsy energii płynące po drodze, pylony 3D
// przy przystankach i pole gwiazd. Sterowane realnym GPS / symulacją.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Fix, RouteLeg, Stop } from '../../types';
import { combinedRouteCoords } from '../../lib/navigation/offroute';
import { haversine, distanceToPolyline } from '../../lib/navigation/geo';

interface Props {
  legs: RouteLeg[];
  fix: Fix | null;
  stops: Stop[];
  activeStopIndex: number;
  onFail: () => void;
}

const R = 6371000;
const D2R = Math.PI / 180;
const NEON = 0x22d3ee;

function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#03121a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(7, 7, 1);
  return sp;
}

export function Drive3D({ legs, fix, stops, activeStopIndex, onFail }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef<Props>({ legs, fix, stops, activeStopIndex, onFail });
  dataRef.current = { legs, fix, stops, activeStopIndex, onFail };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onFail();
      return;
    }
    const W = mount.clientWidth;
    const H = mount.clientHeight;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05080d, 0.0016);

    const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 6000);
    camera.position.set(0, 6, 12);

    scene.add(new THREE.AmbientLight(0x335577, 1.4));
    const dir = new THREE.DirectionalLight(0x66ccff, 0.6);
    dir.position.set(0, 50, 20);
    scene.add(dir);

    // --- siatka neonowa (podłoga) ---
    const GRID = 60;
    const grid = new THREE.GridHelper(2400, 80, NEON, 0x123042);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshBasicMaterial({ color: 0x04070d, transparent: true, opacity: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);

    // --- gwiazdy ---
    const starGeo = new THREE.BufferGeometry();
    const starN = 600;
    const sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 800 + Math.random() * 2000;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.5;
      sp[i * 3] = Math.cos(th) * Math.sin(ph) * r;
      sp[i * 3 + 1] = Math.cos(ph) * r * 0.6 + 100;
      sp[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9fe8ff, size: 3, transparent: true, opacity: 0.7 }),
    );
    scene.add(stars);

    // --- grupy dynamiczne ---
    const routeGroup = new THREE.Group();
    scene.add(routeGroup);
    const pulseGroup = new THREE.Group();
    scene.add(pulseGroup);
    const pylonGroup = new THREE.Group();
    scene.add(pylonGroup);

    // pojazd (świecący myśliwiec)
    const vehicle = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 5, 4),
      new THREE.MeshBasicMaterial({ color: NEON }),
    );
    body.rotation.x = Math.PI / 2;
    vehicle.add(body);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ color: NEON, transparent: true, opacity: 0.5, depthTest: false }),
    );
    halo.scale.set(10, 10, 1);
    vehicle.add(halo);
    scene.add(vehicle);

    // --- stan trasy ---
    let curve: THREE.CatmullRomCurve3 | null = null;
    let totalLen = 0;
    let refLng = 0;
    let refLat = 0;
    let cosRef = 1;
    let coordsCache: number[][] = [];
    let routeKey = '';

    const enu = (lng: number, lat: number) =>
      new THREE.Vector3((lng - refLng) * cosRef * R * D2R, 0.6, -(lat - refLat) * R * D2R);

    const PULSES = 7;
    const pulses: THREE.Mesh[] = [];
    for (let i = 0; i < PULSES; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xe0fbff, transparent: true, opacity: 0.95 }),
      );
      pulseGroup.add(m);
      pulses.push(m);
    }

    // Zwalnia geometrie/materiały/tekstury z grupy przed jej wyczyszczeniem
    // (inaczej każdy re-routing zostawia wyciek w GPU).
    const disposeGroup = (g: THREE.Group) => {
      g.traverse((o) => {
        const any = o as any;
        any.geometry?.dispose?.();
        const m = any.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((mm: any) => {
          mm.map?.dispose?.();
          mm.dispose?.();
        });
      });
      g.clear();
    };

    const buildRoute = () => {
      const data = dataRef.current;
      const coords = combinedRouteCoords(data.legs);
      const first = coords[0]?.join(',') ?? '';
      const last = coords[coords.length - 1]?.join(',') ?? '';
      const mid = coords[Math.floor(coords.length / 2)]?.join(',') ?? '';
      const key = `${coords.length}:${first}|${mid}|${last}`;
      if (key === routeKey) return;
      routeKey = key;
      coordsCache = coords;

      // wyczyść poprzednie (z dispose)
      disposeGroup(routeGroup);
      disposeGroup(pylonGroup);
      curve = null;
      totalLen = 0;
      if (coords.length < 2) return;

      refLng = coords[0][0];
      refLat = coords[0][1];
      cosRef = Math.cos(refLat * D2R);
      const pts = coords.map((c) => enu(c[0], c[1]));
      curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
      totalLen = curve.getLength();

      const seg = Math.min(2000, Math.max(40, Math.floor(totalLen / 6)));
      // rdzeń wstęgi
      const core = new THREE.Mesh(
        new THREE.TubeGeometry(curve, seg, 1.3, 8, false),
        new THREE.MeshBasicMaterial({ color: NEON }),
      );
      routeGroup.add(core);
      // halo wstęgi (additive)
      const glow = new THREE.Mesh(
        new THREE.TubeGeometry(curve, seg, 3.2, 8, false),
        new THREE.MeshBasicMaterial({
          color: NEON,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      routeGroup.add(glow);

      // pylony przystanków
      const ordered = [...data.stops].sort((a, b) => a.order - b.order);
      ordered.forEach((s, i) => {
        const p = enu(s.lng, s.lat);
        const color = s.completed || s.skipped ? 0x34d399 : i === data.activeStopIndex ? 0xf59e0b : 0xef4444;
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 26, 10),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
        );
        pylon.position.set(p.x, 13, p.z);
        pylonGroup.add(pylon);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(4, 0.4, 8, 32),
          new THREE.MeshBasicMaterial({ color }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(p.x, 0.4, p.z);
        pylonGroup.add(ring);
        const label = makeLabelSprite(String(i + 1), `#${color.toString(16).padStart(6, '0')}`);
        label.position.set(p.x, 30, p.z);
        pylonGroup.add(label);
      });
    };

    // postęp pozycji po trasie (metry od startu)
    const progressMeters = (f: Fix): number => {
      if (coordsCache.length < 2) return 0;
      const { segmentIndex, t } = distanceToPolyline(f, coordsCache);
      let d = 0;
      for (let i = 0; i < segmentIndex; i++) {
        d += haversine(
          { lng: coordsCache[i][0], lat: coordsCache[i][1] },
          { lng: coordsCache[i + 1][0], lat: coordsCache[i + 1][1] },
        );
      }
      const a = coordsCache[segmentIndex];
      const b = coordsCache[segmentIndex + 1];
      d += t * haversine({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
      return d;
    };

    const tmpTarget = new THREE.Vector3();
    const tmpLook = new THREE.Vector3();
    const camLook = new THREE.Vector3(0, 0, -10);
    let phase = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const data = dataRef.current;
      buildRoute();

      const fix = data.fix;
      const speed = Math.max(0, fix?.speed ?? 0);
      phase += dt * (0.15 + speed * 0.02);

      // dynamiczny FOV — poczucie prędkości
      const targetFov = 60 + Math.min(26, speed * 1.1);
      camera.fov += (targetFov - camera.fov) * 0.05;
      camera.updateProjectionMatrix();

      if (curve && totalLen > 1 && fix) {
        const dist = progressMeters(fix);
        const u = Math.max(0, Math.min(1, dist / totalLen));
        const pos = curve.getPointAt(u);
        const tan = curve.getTangentAt(u).normalize();

        vehicle.position.copy(pos);
        vehicle.position.y = 0.8;
        const look = pos.clone().add(tan.clone().multiplyScalar(8));
        vehicle.lookAt(look.x, 0.8, look.z);

        // kamera-pościg
        tmpTarget.copy(pos).addScaledVector(tan, -11).add(new THREE.Vector3(0, 6.5, 0));
        camera.position.lerp(tmpTarget, 0.08);
        tmpLook.copy(pos).addScaledVector(tan, 22);
        tmpLook.y = 1.5;
        camLook.lerp(tmpLook, 0.1);
        camera.lookAt(camLook);

        // pulsy płynące do kierowcy
        const windowM = 220;
        for (let i = 0; i < PULSES; i++) {
          const frac = i / PULSES;
          let o = ((frac - phase * 0.5) % 1 + 1) % 1; // 0..1 maleje (do kierowcy)
          const pm = dist + o * windowM + 6;
          const pu = Math.min(1, pm / totalLen);
          const pp = curve.getPointAt(pu);
          pulses[i].position.set(pp.x, 0.9, pp.z);
          const a = 0.9 * (1 - o);
          (pulses[i].material as THREE.MeshBasicMaterial).opacity = a;
          const sc = 0.6 + (1 - o) * 1.4;
          pulses[i].scale.setScalar(sc);
        }
      } else {
        // idle — brak trasy/pozycji: spokojny lot nad siatką
        const t = clock.elapsedTime;
        camera.position.set(Math.sin(t * 0.1) * 8, 7, 14 + Math.cos(t * 0.1) * 4);
        camera.lookAt(0, 1, -30);
        vehicle.position.set(0, 0.8, 0);
        vehicle.rotation.set(0, 0, 0);
        pulseGroup.visible = false;
      }
      pulseGroup.visible = !!(curve && fix);

      // pulsowanie poświaty pojazdu
      const pj = 0.45 + Math.sin(clock.elapsedTime * 4) * 0.15;
      (halo.material as THREE.SpriteMaterial).opacity = pj;

      // siatka „nieskończona" — podążaj za kamerą skokowo
      grid.position.x = Math.round(camera.position.x / GRID) * GRID;
      grid.position.z = Math.round(camera.position.z / GRID) * GRID;
      stars.rotation.y += dt * 0.005;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      scene.traverse((o) => {
        const any = o as any;
        if (any.geometry) any.geometry.dispose?.();
        if (any.material) {
          const m = any.material;
          (Array.isArray(m) ? m : [m]).forEach((mm: any) => {
            mm.map?.dispose?.();
            mm.dispose?.();
          });
        }
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="drive3d" />;
}
