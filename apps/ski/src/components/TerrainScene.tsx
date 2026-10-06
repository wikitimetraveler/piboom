import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { DemGrid, DestinationBrief, LatLng, SkiLift, SkiRun, TrailsPayload } from '../lib/types';
import { fmtDeg, fmtFt, liftTitle, runTitle, TIER_META, tierOf } from '../lib/trails';

interface Props {
  dem: DemGrid | null;
  trails: TrailsPayload | null;
  destinations: DestinationBrief[];
  resortId: string | undefined;
  selectedRunId: string | null;
  previewRunId: string | null;
  matchIds: Set<string> | null;
  onSelectRun: (id: string | null) => void;
}

interface StyleState {
  resortId: string | undefined;
  selectedRunId: string | null;
  previewRunId: string | null;
  matchIds: Set<string> | null;
}

interface SceneApi {
  applyStyles: (s: StyleState) => void;
  frameResort: (resortId: string | undefined) => void;
  frameRun: (runId: string) => void;
}

const WIDTH = 3;
const EXAG = 1.5;
const FT_PER_M = 3.28084;

const terrainVertex = /* glsl */ `
  attribute float elev;
  varying float vElev;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vElev = elev;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const terrainFragment = /* glsl */ `
  uniform vec3 uLight;
  uniform float uSnowFt;
  uniform float uInterval;
  varying float vElev;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 chaparral = vec3(0.30, 0.31, 0.24);
    vec3 forest = vec3(0.17, 0.25, 0.21);
    vec3 snow = vec3(0.72, 0.78, 0.84);
    vec3 rock = vec3(0.47, 0.45, 0.44);
    float snowy = smoothstep(uSnowFt - 250.0, uSnowFt + 450.0, vElev);
    vec3 base = mix(chaparral, forest, smoothstep(uSnowFt - 1400.0, uSnowFt - 500.0, vElev));
    base = mix(base, snow, snowy);
    float steep = 1.0 - n.y;
    float rocky = smoothstep(0.42, 0.7, steep) * 0.55;
    base = mix(base, rock, rocky);
    vec3 l = normalize(uLight);
    float diffuse = clamp(dot(n, l), 0.0, 1.0);
    float sky = 0.5 + 0.5 * n.y;
    vec3 col = base * (0.30 + 0.78 * diffuse) + vec3(0.04, 0.07, 0.10) * sky;
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 h = normalize(l + v);
    float nh = max(dot(n, h), 0.0);
    float glint = pow(nh, 90.0) * 1.4 + pow(nh, 14.0) * 0.18;
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0) * 0.12;
    col += vec3(1.0, 0.97, 0.9) * (glint * diffuse + fresnel) * snowy * (1.0 - rocky);
    float e = vElev / uInterval;
    float w = fwidth(e);
    float line = 1.0 - smoothstep(0.0, w * 1.25, abs(fract(e - 0.5) - 0.5));
    float major = step(abs(mod(floor(e + 0.5), 5.0)), 0.5);
    col = mix(col, col * 0.5, line * (0.28 + 0.32 * major));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeFrame(dem: DemGrid) {
  const { south, north, west, east, rows, cols, heights } = dem;
  const latMid = (south + north) / 2;
  const eastM = (east - west) * 111_320 * Math.cos((latMid * Math.PI) / 180);
  const northM = (north - south) * 111_320;
  const depth = (WIDTH * northM) / eastM;
  let minFt = Infinity;
  let maxFt = -Infinity;
  for (const h of heights) {
    if (h < minFt) minFt = h;
    if (h > maxFt) maxFt = h;
  }
  const vScale = (0.3048 / eastM) * WIDTH * EXAG;
  const at = (vc: number, vr: number) => heights[(rows - 1 - vr) * cols + vc];

  /** Height on the actual mesh triangulation (PlaneGeometry splits quads a-b-d / b-c-d). */
  const meshFt = (lat: number, lng: number) => {
    const fx = Math.min(1, Math.max(0, (lng - west) / (east - west))) * (cols - 1);
    const fy = Math.min(1, Math.max(0, (north - lat) / (north - south))) * (rows - 1);
    const ix = Math.min(cols - 2, Math.floor(fx));
    const iy = Math.min(rows - 2, Math.floor(fy));
    const u = fx - ix;
    const v = fy - iy;
    const ha = at(ix, iy);
    const hb = at(ix, iy + 1);
    const hc = at(ix + 1, iy + 1);
    const hd = at(ix + 1, iy);
    return u + v <= 1 ? ha + u * (hd - ha) + v * (hb - ha) : hc + (1 - u) * (hb - hc) + (1 - v) * (hd - hc);
  };

  const toWorld = (lat: number, lng: number, liftM = 0) =>
    new THREE.Vector3(
      ((lng - west) / (east - west) - 0.5) * WIDTH,
      (meshFt(lat, lng) - minFt + liftM * FT_PER_M) * vScale,
      ((north - lat) / (north - south) - 0.5) * depth
    );

  const cellM = Math.min(eastM / (cols - 1), northM / (rows - 1));
  return { depth, minFt, maxFt, vScale, meshFt, toWorld, cellM, at };
}

type Frame = ReturnType<typeof makeFrame>;

function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function drape(frame: Frame, coords: LatLng[], liftM: number): THREE.Vector3[] {
  const step = Math.max(6, frame.cellM / 2.5);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const n = Math.max(1, Math.ceil(haversineM(a, b) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      out.push(frame.toWorld(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, liftM));
    }
  }
  const last = coords[coords.length - 1];
  out.push(frame.toWorld(last[0], last[1], liftM));
  return out;
}

function cableLine(frame: Frame, coords: LatLng[], towerM: number): THREE.Vector3[] {
  return coords.map(([lat, lng]) => frame.toWorld(lat, lng, towerM));
}

function makeLine(points: THREE.Vector3[], material: LineMaterial): Line2 {
  const geo = new LineGeometry();
  geo.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const line = new Line2(geo, material);
  line.computeLineDistances();
  return line;
}

interface RunHandle {
  run: SkiRun;
  cores: Line2[];
  casings: Line2[];
  core: LineMaterial;
  casing: LineMaterial;
  box: THREE.Box3;
}

interface LiftHandle {
  lift: SkiLift;
  mat: LineMaterial;
  line: Line2;
  box: THREE.Box3;
}

export default function TerrainScene(props: Props) {
  const { dem, trails, destinations, resortId, selectedRunId, previewRunId, matchIds, onSelectRun } = props;
  const host = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const styleRef = useRef<StyleState>({ resortId, selectedRunId, previewRunId, matchIds });
  styleRef.current = { resortId, selectedRunId, previewRunId, matchIds };
  const selectRef = useRef(onSelectRun);
  selectRef.current = onSelectRun;

  useEffect(() => {
    const el = host.current;
    if (!el || !dem) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = makeFrame(dem);
    const activeTrails = trails && trails.id === dem.id ? trails : null;

    const width = Math.max(el.clientWidth, 280);
    const height = Math.max(el.clientHeight, 280);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0x081019, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.className = 'ski-3d-canvas';
    el.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(width, height);
    labels.domElement.className = 'ski-3d-labels';
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081019);
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 30);
    camera.position.set(0.4, 1.6, -2.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.35;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.target.set(0, 0.15, 0);
    controls.update();

    const geo = new THREE.PlaneGeometry(WIDTH, frame.depth, dem.cols - 1, dem.rows - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const elev = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const ft = frame.at(i % dem.cols, Math.floor(i / dem.cols));
      elev[i] = ft;
      pos.setY(i, (ft - frame.minFt) * frame.vScale);
    }
    pos.needsUpdate = true;
    geo.setAttribute('elev', new THREE.BufferAttribute(elev, 1));
    geo.computeVertexNormals();
    const terrainMat = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        uLight: { value: new THREE.Vector3(-0.55, 0.75, -0.45) },
        uSnowFt: { value: 6900 },
        uInterval: { value: 100 },
      },
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    scene.add(terrain);

    const resolution = new THREE.Vector2(width, height);
    const lineMats: LineMaterial[] = [];
    const lineMat = (color: number, linewidth: number) => {
      const m = new LineMaterial({ color, linewidth, worldUnits: false, depthTest: true, depthWrite: false });
      m.resolution.copy(resolution);
      lineMats.push(m);
      return m;
    };

    const runs: RunHandle[] = [];
    const lifts: LiftHandle[] = [];
    const pickables: Line2[] = [];
    for (const run of activeTrails?.runs || []) {
      const meta = TIER_META[tierOf(run.difficulty)];
      const core = lineMat(meta.line, 2.6);
      const casing = lineMat(meta.casing, 5);
      const handle: RunHandle = { run, cores: [], casings: [], core, casing, box: new THREE.Box3() };
      for (const path of run.paths) {
        if (path.length < 2) continue;
        const pts = drape(frame, path, 3);
        for (const p of pts) handle.box.expandByPoint(p);
        const cas = makeLine(pts, casing);
        cas.renderOrder = 1;
        const line = makeLine(pts, core);
        line.renderOrder = 2;
        line.userData = { kind: 'run', id: run.id };
        handle.casings.push(cas);
        handle.cores.push(line);
        pickables.push(line);
        scene.add(cas, line);
      }
      if (handle.cores.length) runs.push(handle);
    }

    const stationGeo = new THREE.BoxGeometry(0.011, 0.008, 0.011);
    const stationMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    for (const lift of activeTrails?.lifts || []) {
      if (lift.coords.length < 2) continue;
      const tower = lift.type === 'magic_carpet' || lift.type === 'rope_tow' ? 2 : 14;
      const pts = cableLine(frame, lift.coords, tower);
      const mat = lineMat(0xffd166, 1.6);
      mat.dashed = lift.type !== 'chair_lift' && lift.type !== 'gondola';
      mat.dashSize = 0.012;
      mat.gapSize = 0.008;
      const line = makeLine(pts, mat);
      line.renderOrder = 3;
      line.userData = { kind: 'lift', id: lift.id };
      pickables.push(line);
      scene.add(line);
      const box = new THREE.Box3().setFromPoints(pts);
      for (const end of [lift.coords[0], lift.coords[lift.coords.length - 1]]) {
        const s = new THREE.Mesh(stationGeo, stationMat);
        s.position.copy(frame.toWorld(end[0], end[1], 4));
        scene.add(s);
      }
      lifts.push({ lift, mat, line, box });
    }

    for (const d of destinations.filter((x) => x.dem === dem.id)) {
      const tag = document.createElement('div');
      tag.className = 'ski-3d-pin';
      tag.textContent = d.name;
      const obj = new CSS2DObject(tag);
      const p = frame.toWorld(d.lat, d.lng, 0);
      obj.position.set(p.x, p.y + 0.09, p.z);
      scene.add(obj);
    }

    const tipEl = document.createElement('div');
    tipEl.className = 'ski-3d-tip';
    const tip = new CSS2DObject(tipEl);
    tip.visible = false;
    scene.add(tip);

    let hoverId: string | null = null;
    const runById = new Map(runs.map((h) => [h.run.id, h]));
    const liftById = new Map(lifts.map((h) => [h.lift.id, h]));

    const showTip = (id: string | null, point?: THREE.Vector3) => {
      const r = id ? runById.get(id) : undefined;
      const l = id ? liftById.get(id) : undefined;
      if (!r && !l) {
        tip.visible = false;
        return;
      }
      if (r) {
        const tier = TIER_META[tierOf(r.run.difficulty)];
        tipEl.innerHTML = '';
        const b = document.createElement('strong');
        b.textContent = runTitle(r.run);
        const s = document.createElement('span');
        s.textContent = `${tier.label} · ${fmtFt(r.run.verticalFt)} vert · avg ${fmtDeg(r.run.avgPitchDeg)} · faces ${r.run.aspect ?? '—'}`;
        tipEl.append(b, s);
        tip.position.copy(point ?? r.box.getCenter(new THREE.Vector3()));
      } else if (l) {
        tipEl.innerHTML = '';
        const b = document.createElement('strong');
        b.textContent = liftTitle(l.lift);
        const s = document.createElement('span');
        s.textContent = `${fmtFt(l.lift.riseFt)} rise · ${fmtFt(l.lift.lengthFt)} long`;
        tipEl.append(b, s);
        tip.position.copy(point ?? l.box.getCenter(new THREE.Vector3()));
      }
      tip.position.y += 0.03;
      tip.visible = true;
    };

    // Fade by blending toward snow-gray at full opacity: translucent Line2 segments double up at joints.
    const fade = new THREE.Color(0xc4ced8);
    const applyStyles = (s: StyleState) => {
      const anySel = Boolean(s.selectedRunId);
      for (const h of runs) {
        const id = h.run.id;
        const isSel = id === s.selectedRunId;
        const isHot = id === s.previewRunId || id === hoverId;
        const inResort = !s.resortId || h.run.resort === s.resortId;
        const matches = !s.matchIds || s.matchIds.has(id);
        let dim = inResort ? (matches ? 0 : 0.85) : 0.75;
        if (anySel && !isSel && !isHot) dim = Math.max(dim, 0.5);
        if (isSel || isHot) dim = 0;
        const meta = TIER_META[tierOf(h.run.difficulty)];
        h.core.linewidth = isSel ? 5.5 : isHot ? 4.5 : dim > 0.6 ? 1.8 : 2.6;
        h.casing.linewidth = h.core.linewidth + (isSel ? 5 : 2.6);
        h.core.color.setHex(meta.line).lerp(fade, dim);
        h.casing.color.setHex(isSel ? 0x7ec8e3 : isHot ? 0xffffff : meta.casing).lerp(fade, dim);
        for (const c of h.cores) {
          c.renderOrder = isSel || isHot ? 6 : 2;
          c.userData.dim = dim;
        }
        for (const c of h.casings) {
          c.renderOrder = isSel || isHot ? 5 : 1;
          c.visible = dim < 0.6;
        }
      }
      for (const l of lifts) {
        const inResort = !s.resortId || l.lift.resort === s.resortId;
        const dim = l.lift.id === hoverId ? 0 : inResort ? (anySel ? 0.45 : 0) : 0.75;
        l.mat.color.setHex(0xffd166).lerp(fade, dim);
        l.mat.linewidth = l.lift.id === hoverId ? 3 : 1.6;
        l.line.userData.dim = dim;
      }
      if (!hoverId) showTip(s.previewRunId || s.selectedRunId);
    };

    const goal = { target: new THREE.Vector3(), position: new THREE.Vector3(), active: false };
    const flyTo = (box: THREE.Box3, minSize: number) => {
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const size = Math.max(box.getSize(new THREE.Vector3()).length(), minSize);
      const dir = new THREE.Vector3(0.18, 0.62, -1).normalize();
      goal.target.copy(center);
      goal.position.copy(center).addScaledVector(dir, size * 1.25 + 0.25);
      if (reduced) {
        controls.target.copy(goal.target);
        camera.position.copy(goal.position);
        goal.active = false;
      } else {
        goal.active = true;
      }
    };
    const frameResort = (id: string | undefined) => {
      const box = new THREE.Box3();
      for (const h of runs) if (!id || h.run.resort === id) box.union(h.box);
      for (const l of lifts) if (!id || l.lift.resort === id) box.union(l.box);
      if (box.isEmpty()) box.setFromObject(terrain);
      flyTo(box, 0.8);
    };
    const frameRun = (id: string) => {
      const h = runById.get(id);
      if (h) flyTo(h.box, 0.45);
    };
    controls.addEventListener('start', () => {
      goal.active = false;
    });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line2 = { threshold: 7 };
    const ndc = new THREE.Vector2();
    let needsPick = false;
    let downAt: { x: number; y: number } | null = null;
    const pick = (): { id: string; point: THREE.Vector3 } | null => {
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster
        .intersectObjects(pickables, false)
        .find((h) => (h.object.userData.dim ?? 0) < 0.7);
      if (!hit) return null;
      return { id: String(hit.object.userData.id), point: hit.point.clone() };
    };
    const setNdc = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    };
    const onMove = (ev: PointerEvent) => {
      setNdc(ev);
      needsPick = true;
    };
    const onLeave = () => {
      hoverId = null;
      renderer.domElement.style.cursor = '';
      applyStyles(styleRef.current);
    };
    const onDown = (ev: PointerEvent) => {
      downAt = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = (ev: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
      downAt = null;
      if (moved > 5) return;
      setNdc(ev);
      const hit = pick();
      if (!hit) selectRef.current(null);
      else if (runById.has(hit.id)) selectRef.current(hit.id);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    let raf = 0;
    const tick = () => {
      if (goal.active) {
        controls.target.lerp(goal.target, 0.085);
        camera.position.lerp(goal.position, 0.085);
        if (camera.position.distanceTo(goal.position) < 0.004) goal.active = false;
      }
      controls.update();
      if (needsPick) {
        needsPick = false;
        const hit = pick();
        const next = hit ? hit.id : null;
        if (next !== hoverId) {
          hoverId = next;
          canvas.style.cursor = next ? 'pointer' : '';
          applyStyles(styleRef.current);
        }
        if (hit) showTip(hit.id, hit.point);
      }
      if (compass.current) {
        compass.current.style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
      }
      renderer.render(scene, camera);
      labels.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const w = Math.max(el.clientWidth, 1);
      const h = Math.max(el.clientHeight, 1);
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      resolution.set(w, h);
      for (const m of lineMats) m.resolution.copy(resolution);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', vis);

    api.current = { applyStyles, frameResort, frameRun };
    applyStyles(styleRef.current);
    frameResort(styleRef.current.resortId);
    if (!reduced) {
      camera.position.copy(goal.position).add(new THREE.Vector3(0.6, 0.5, -0.6));
      controls.target.copy(goal.target);
      goal.active = true;
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', vis);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      api.current = null;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose?.();
      });
      for (const m of lineMats) m.dispose();
      terrainMat.dispose();
      stationGeo.dispose();
      stationMat.dispose();
      renderer.dispose();
      canvas.remove();
      labels.domElement.remove();
    };
  }, [dem, trails, destinations]);

  useEffect(() => {
    api.current?.applyStyles({ resortId, selectedRunId, previewRunId, matchIds });
  }, [resortId, selectedRunId, previewRunId, matchIds]);

  useEffect(() => {
    api.current?.frameResort(resortId);
  }, [resortId]);

  useEffect(() => {
    if (selectedRunId) api.current?.frameRun(selectedRunId);
  }, [selectedRunId]);

  if (!dem) {
    return (
      <div className="ski-trail-map ski-trail-map--empty" aria-label="Ski area trail map">
        Loading terrain…
      </div>
    );
  }

  const runCount = trails && trails.id === dem.id ? trails.runs.length : 0;
  const liftCount = trails && trails.id === dem.id ? trails.lifts.length : 0;
  return (
    <div className="ski-trail-map" ref={host} role="application" aria-label={`${dem.name} 3D trail map`}>
      <div className="ski-3d-legend" aria-hidden="true">
        <span><i className="ski-key ski-key--green" />Easier</span>
        <span><i className="ski-key ski-key--blue" />More difficult</span>
        <span><i className="ski-key ski-key--black" />Most difficult</span>
        <span><i className="ski-key ski-key--double" />Experts only</span>
        <span><i className="ski-key ski-key--lift" />Lift</span>
      </div>
      <div className="ski-3d-compass" aria-hidden="true">
        <div ref={compass} className="ski-3d-compass__needle">
          <span>N</span>
        </div>
      </div>
      <div className="ski-3d-foot">
        <p>
          Drag to orbit · scroll to zoom · right-drag to pan · click a run
          {runCount
            ? ` · ${runCount} runs, ${liftCount} lifts`
            : trails && trails.id === dem.id
              ? ' · runs not mapped yet'
              : ' · trails loading'}
        </p>
        <p>
          Runs © OpenStreetMap contributors · Elevation{' '}
          {dem.source === 'terrarium-3dep' ? 'USGS 3DEP (AWS Terrain Tiles)' : dem.source || 'DEM'} · {EXAG}× vertical
        </p>
      </div>
    </div>
  );
}
