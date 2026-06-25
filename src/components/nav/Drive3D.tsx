// Drive3D — PIONIERSKI interfejs jazdy 3D (WebGL/three.js).
// Holograficzny HUD AR: świecąca energetyczna wstęga trasy (shader przepływu),
// nieskończona neonowa siatka (shader), konformalna strzałka manewru, beamy
// przystanków, cząsteczki prędkości i prawdziwy bloom (EffectComposer).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
const CYAN = new THREE.Color(0x22d3ee);

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(4,12,20,0.0)';
  ctx.fillRect(0, 0, 256, 128);
  // pigułka
  ctx.fillStyle = color;
  const r = 24;
  ctx.beginPath();
  ctx.moveTo(8 + r, 36);
  ctx.arcTo(248, 36, 248, 92, r);
  ctx.arcTo(248, 92, 8, 92, r);
  ctx.arcTo(8, 92, 8, 36, r);
  ctx.arcTo(8, 36, 248, 36, r);
  ctx.fill();
  ctx.fillStyle = '#03121a';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sp.scale.set(14, 7, 1);
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
    let composer: EffectComposer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onFail();
      return;
    }
    const W = mount.clientWidth;
    const H = mount.clientHeight;
    const DPR = Math.min(2, window.devicePixelRatio || 1); // cap dla wydajności
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04070d, 0.0018);

    const camera = new THREE.PerspectiveCamera(64, W / H, 0.1, 8000);
    camera.position.set(0, 7, 13);

    // światła (delikatne — większość świeci emisyjnie)
    scene.add(new THREE.AmbientLight(0x335577, 1.2));
    const key = new THREE.DirectionalLight(0x66ccff, 0.5);
    key.position.set(20, 60, 10);
    scene.add(key);

    // --- BLOOM ---
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.95, 0.6, 0.1);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch {
      onFail();
      return;
    }

    // --- SHADER: nieskończona neonowa siatka (podłoga) ---
    const gridUniforms = { uTime: { value: 0 }, uColor: { value: CYAN.clone() } };
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: gridUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vW;
          void main(){
            vec4 wp = modelMatrix * vec4(position,1.0);
            vW = wp.xz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: `
          precision mediump float;
          uniform float uTime; uniform vec3 uColor; varying vec2 vW;
          void main(){
            vec2 coord = vW * 0.04;
            coord.y += uTime * 0.5;            // przepływ do kierowcy
            // linie siatki bez pochodnych (fwidth) — stała grubość w coord-space
            vec2 f = abs(fract(coord - 0.5) - 0.5);
            float line = 1.0 - smoothstep(0.0, 0.06, min(f.x, f.y));
            float fade = 1.0 - smoothstep(120.0, 900.0, length(vW));
            float a = line * fade;
            gl_FragColor = vec4(uColor * (0.5 + line), a * 0.55);
          }`,
      }),
    );
    grid.rotation.x = -Math.PI / 2;
    scene.add(grid);

    // tafla pod siatką (odbicie/głębia)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8000, 8000),
      new THREE.MeshBasicMaterial({ color: 0x03060c }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    scene.add(floor);

    // --- gwiazdy ---
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const r = 900 + Math.random() * 2500;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.5;
      sp[i * 3] = Math.cos(th) * Math.sin(ph) * r;
      sp[i * 3 + 1] = Math.cos(ph) * r * 0.6 + 120;
      sp[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9fe8ff, size: 3.2, transparent: true, opacity: 0.7 }),
    );
    scene.add(stars);

    // --- cząsteczki prędkości (smugi przelatujące obok) ---
    const SPN = 120;
    const speedGeo = new THREE.BufferGeometry();
    const spos = new Float32Array(SPN * 3);
    for (let i = 0; i < SPN; i++) {
      spos[i * 3] = (Math.random() - 0.5) * 60;
      spos[i * 3 + 1] = Math.random() * 30;
      spos[i * 3 + 2] = -Math.random() * 300;
    }
    speedGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    const speedParticles = new THREE.Points(
      speedGeo,
      new THREE.PointsMaterial({ color: 0x7df0ff, size: 1.6, transparent: true, opacity: 0.0 }),
    );
    scene.add(speedParticles);

    // --- grupy dynamiczne ---
    const routeGroup = new THREE.Group();
    scene.add(routeGroup);
    const pylonGroup = new THREE.Group();
    scene.add(pylonGroup);

    // pojazd + holograficzny pierścień
    const vehicle = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 5, 5),
      new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: CYAN, emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.3 }),
    );
    body.rotation.x = Math.PI / 2;
    vehicle.add(body);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.18, 8, 40),
      new THREE.MeshBasicMaterial({ color: CYAN }),
    );
    ring.rotation.x = Math.PI / 2;
    vehicle.add(ring);
    scene.add(vehicle);

    // konformalna strzałka manewru (unosi się nad drogą)
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xe0fbff, transparent: true, opacity: 0.95 }),
    );
    arrow.visible = false;
    scene.add(arrow);

    // --- shader przepływu energii po trasie ---
    const flowUniforms = { uTime: { value: 0 }, uColor: { value: CYAN.clone() } };
    const flowMaterial = () =>
      new THREE.ShaderMaterial({
        uniforms: flowUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          precision mediump float;
          uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            float base = 0.35;
            float f = fract(vUv.x * 5.0 - uTime * 0.9);
            float pulse = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.12, 0.5, f));
            vec3 col = uColor * (base + 1.6 * pulse);
            gl_FragColor = vec4(col, 0.92);
          }`,
      });

    // --- stan trasy ---
    let curve: THREE.CatmullRomCurve3 | null = null;
    let totalLen = 0;
    let refLng = 0;
    let refLat = 0;
    let cosRef = 1;
    let coordsCache: number[][] = [];
    let routeKey = '';

    const enu = (lng: number, lat: number) =>
      new THREE.Vector3((lng - refLng) * cosRef * R * D2R, 0.7, -(lat - refLat) * R * D2R);

    const disposeGroup = (g: THREE.Group) => {
      g.traverse((o) => {
        const any = o as any;
        any.geometry?.dispose?.();
        const m = any.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((mm: any) => { mm.map?.dispose?.(); mm.dispose?.(); });
      });
      g.clear();
    };

    const buildRoute = () => {
      const data = dataRef.current;
      const coords = combinedRouteCoords(data.legs);
      const key = `${coords.length}:${coords[0]?.join(',') ?? ''}|${coords[(coords.length / 2) | 0]?.join(',') ?? ''}|${coords[coords.length - 1]?.join(',') ?? ''}`;
      if (key === routeKey) return;
      routeKey = key;
      coordsCache = coords;

      disposeGroup(routeGroup);
      disposeGroup(pylonGroup);
      curve = null;
      totalLen = 0;
      if (coords.length < 2) return;

      refLng = coords[0][0];
      refLat = coords[0][1];
      cosRef = Math.cos(refLat * D2R);
      const pts = coords.map((c) => enu(c[0], c[1]));
      curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
      totalLen = curve.getLength();
      const seg = Math.min(2400, Math.max(48, Math.floor(totalLen / 5)));

      // poświata (szeroka, additive) — karmi bloom
      routeGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, seg, 3.4, 8, false),
          new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
        ),
      );
      // rdzeń z animowanym przepływem
      routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, seg, 1.5, 10, false), flowMaterial()));

      // pylony przystanków
      const ordered = [...data.stops].sort((a, b) => a.order - b.order);
      ordered.forEach((s, i) => {
        const p = enu(s.lng, s.lat);
        const done = s.completed || s.skipped;
        const colHex = done ? 0x34d399 : i === data.activeStopIndex ? 0xf59e0b : 0xef4444;
        const col = new THREE.Color(colHex);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.2, 34, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
        );
        beam.position.set(p.x, 17, p.z);
        beam.userData.spin = true;
        pylonGroup.add(beam);
        const tor = new THREE.Mesh(new THREE.TorusGeometry(5, 0.5, 8, 36), new THREE.MeshBasicMaterial({ color: col }));
        tor.rotation.x = Math.PI / 2;
        tor.position.set(p.x, 0.5, p.z);
        tor.userData.ring = true;
        pylonGroup.add(tor);
        const lab = labelSprite(String(i + 1), `#${colHex.toString(16).padStart(6, '0')}`);
        lab.position.set(p.x, 36, p.z);
        pylonGroup.add(lab);
      });
    };

    const progressMeters = (f: Fix): number => {
      if (coordsCache.length < 2) return 0;
      const { segmentIndex, t } = distanceToPolyline(f, coordsCache);
      let d = 0;
      for (let i = 0; i < segmentIndex; i++)
        d += haversine({ lng: coordsCache[i][0], lat: coordsCache[i][1] }, { lng: coordsCache[i + 1][0], lat: coordsCache[i + 1][1] });
      const a = coordsCache[segmentIndex];
      const b = coordsCache[segmentIndex + 1];
      d += t * haversine({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
      return d;
    };

    const camTarget = new THREE.Vector3(0, 7, 13);
    const camLook = new THREE.Vector3(0, 1, -20);
    const tmpV = new THREE.Vector3();
    let raf = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const tNow = clock.elapsedTime;
      const data = dataRef.current;
      buildRoute();

      const fix = data.fix;
      const speed = Math.max(0, fix?.speed ?? 0);

      gridUniforms.uTime.value = tNow;
      flowUniforms.uTime.value = tNow;

      // FOV reaguje na prędkość
      const targetFov = 60 + Math.min(28, speed * 1.1);
      camera.fov += (targetFov - camera.fov) * 0.05;
      camera.updateProjectionMatrix();

      if (curve && totalLen > 1 && fix) {
        const dist = progressMeters(fix);
        const u = Math.max(0, Math.min(1, dist / totalLen));
        const pos = curve.getPointAt(u);
        const tan = curve.getTangentAt(u).normalize();

        vehicle.position.copy(pos);
        vehicle.position.y = 0.9;
        tmpV.copy(pos).add(tan.clone().multiplyScalar(8));
        vehicle.lookAt(tmpV.x, 0.9, tmpV.z);
        ring.rotation.z += dt * 2;

        // kamera-pościg (płynna)
        tmpV.copy(pos).addScaledVector(tan, -12).add(new THREE.Vector3(0, 7, 0));
        camTarget.lerp(tmpV, 0.07);
        camera.position.copy(camTarget);
        tmpV.copy(pos).addScaledVector(tan, 26);
        tmpV.y = 1.5;
        camLook.lerp(tmpV, 0.1);
        camera.lookAt(camLook);

        // konformalna strzałka ~55 m przed pojazdem
        const au = Math.min(1, (dist + 55) / totalLen);
        const ap = curve.getPointAt(au);
        const at = curve.getTangentAt(au).normalize();
        arrow.visible = au < 1;
        arrow.position.set(ap.x, 4 + Math.sin(tNow * 3) * 0.6, ap.z);
        tmpV.copy(ap).add(at.multiplyScalar(6));
        arrow.lookAt(tmpV.x, arrow.position.y, tmpV.z);
        arrow.rotateX(Math.PI / 2);
      } else {
        const t = clock.elapsedTime;
        camera.position.set(Math.sin(t * 0.12) * 9, 8, 15 + Math.cos(t * 0.12) * 4);
        camera.lookAt(0, 1, -30);
        vehicle.position.set(0, 0.9, 0);
        arrow.visible = false;
      }

      // cząsteczki prędkości
      const smat = speedParticles.material as THREE.PointsMaterial;
      smat.opacity = Math.min(0.6, speed * 0.03);
      const arr = speedGeo.attributes.position.array as Float32Array;
      const sv = 0.5 + speed * 0.12;
      for (let i = 0; i < SPN; i++) {
        arr[i * 3 + 2] += sv * dt * 60;
        if (arr[i * 3 + 2] > 10) {
          arr[i * 3] = (Math.random() - 0.5) * 60;
          arr[i * 3 + 1] = Math.random() * 30;
          arr[i * 3 + 2] = -300;
        }
      }
      speedGeo.attributes.position.needsUpdate = true;
      speedParticles.position.copy(camera.position);

      // animacja pylonów
      pylonGroup.children.forEach((o) => {
        if (o.userData.ring) o.rotation.z += dt * 1.2;
        if (o.userData.spin) o.rotation.y += dt * 0.6;
      });

      grid.position.x = camera.position.x;
      grid.position.z = camera.position.z;
      stars.rotation.y += dt * 0.004;

      composer.render();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      composer.dispose?.();
      renderer.dispose();
      scene.traverse((o) => {
        const any = o as any;
        any.geometry?.dispose?.();
        if (any.material) (Array.isArray(any.material) ? any.material : [any.material]).forEach((m: any) => { m.map?.dispose?.(); m.dispose?.(); });
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="drive3d" />;
}
