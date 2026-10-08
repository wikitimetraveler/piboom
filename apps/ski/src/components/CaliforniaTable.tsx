import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CALIFORNIA_OUTLINE, FT_TO_KM, tableXZ } from '../lib/california';
import type { BriefPayload, DemGrid, DestinationBrief } from '../lib/types';

interface Props {
  destinations: DestinationBrief[];
  home: BriefPayload['home'];
  /** Resort the camera is pulling back from (California control on the trail map). */
  returnFrom: string | null;
  /** Resort chip clicked while the table is up. */
  flyRequest: string | null;
  onFlyStart: (resortId: string) => void;
  onArrive: (resortId: string) => void;
}

interface Waypoint {
  lat: number;
  lng: number;
}

type Slot = readonly [number, number];

interface AreaTag {
  obj: CSS2DObject;
  el: HTMLElement;
  lead: SVGLineElement;
  x: number;
  pref: Slot;
  slot: Slot;
  w: number;
  h: number;
}

interface Rect {
  l: number;
  r: number;
  t: number;
  b: number;
}

/** CSS2D `center` slots around an area anchor: above, below, right, left, then two and three rows out. */
const TAG_SLOTS: Slot[] = [
  [0.5, 1.15],
  [0.5, -0.35],
  [-0.06, 0.5],
  [1.06, 0.5],
  [0.5, 2.35],
  [0.5, -1.55],
  [0.5, 3.55],
  [0.5, -2.75],
];

interface Pose {
  target: THREE.Vector3;
  radius: number;
  phi: number;
  theta: number;
}

const MODEL_SCALE = 2.2;
const VEXAG = 2;
const DATUM_FT = 3500;
const FLY_S = 2.6;
/** Same bearing the trail map opens on: from the north, looking up the north faces. */
const ARRIVE_THETA = Math.atan2(0.18, -1);
const ARRIVE_PHI = 1.02;

// Camera flights must land on time even when frames are slow; skip frames instead of stretching the tween.
gsap.ticker.lagSmoothing(0);

const modelY = (ft: number) => Math.max(0.05, (ft - DATUM_FT) * FT_TO_KM * VEXAG * MODEL_SCALE);

function elevColor(ft: number, out: THREE.Color) {
  const chaparral = new THREE.Color(0.3, 0.31, 0.24);
  const forest = new THREE.Color(0.17, 0.25, 0.21);
  const snow = new THREE.Color(0.93, 0.96, 1);
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  out.copy(chaparral).lerp(forest, smooth(5500, 6400, ft)).lerp(snow, smooth(6650, 7350, ft));
}

function nearestFt(dem: DemGrid, lat: number, lng: number): number {
  const r = Math.round(((lat - dem.south) / (dem.north - dem.south)) * (dem.rows - 1));
  const c = Math.round(((lng - dem.west) / (dem.east - dem.west)) * (dem.cols - 1));
  const rr = Math.min(dem.rows - 1, Math.max(0, r));
  const cc = Math.min(dem.cols - 1, Math.max(0, c));
  return dem.heights[rr * dem.cols + cc];
}

/** One terrain block cut from the DEM, with skirts down to the table, centred on its own footprint. */
function buildModel(dem: DemGrid) {
  const step = Math.max(1, Math.ceil(dem.cols / 64));
  const cols = Math.floor((dem.cols - 1) / step) + 1;
  const rows = Math.floor((dem.rows - 1) / step) + 1;
  const center = tableXZ((dem.south + dem.north) / 2, (dem.west + dem.east) / 2);
  const local = (lat: number, lng: number) => {
    const p = tableXZ(lat, lng);
    return { x: (p.x - center.x) * MODEL_SCALE, z: (p.z - center.z) * MODEL_SCALE };
  };

  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const top: THREE.Vector3[] = [];
  for (let r = 0; r < rows; r++) {
    const sr = Math.min(r * step, dem.rows - 1);
    const lat = dem.south + (sr / (dem.rows - 1)) * (dem.north - dem.south);
    for (let c = 0; c < cols; c++) {
      const sc = Math.min(c * step, dem.cols - 1);
      const lng = dem.west + (sc / (dem.cols - 1)) * (dem.east - dem.west);
      const ft = dem.heights[sr * dem.cols + sc];
      const p = local(lat, lng);
      const v = new THREE.Vector3(p.x, modelY(ft), p.z);
      top.push(v);
      positions.push(v.x, v.y, v.z);
      elevColor(ft, color);
      colors.push(color.r, color.g, color.b);
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surface.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  surface.setIndex(index);
  surface.computeVertexNormals();

  const ring: number[] = [];
  for (let c = 0; c < cols; c++) ring.push(c);
  for (let r = 1; r < rows; r++) ring.push(r * cols + cols - 1);
  for (let c = cols - 2; c >= 0; c--) ring.push((rows - 1) * cols + c);
  for (let r = rows - 2; r > 0; r--) ring.push(r * cols);
  const wall: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = top[ring[i]];
    const q = top[ring[(i + 1) % ring.length]];
    wall.push(p.x, p.y, p.z, q.x, 0, q.z, q.x, q.y, q.z, p.x, p.y, p.z, p.x, 0, p.z, q.x, 0, q.z);
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(wall, 3));
  skirt.computeVertexNormals();

  return { surface, skirt, center, local };
}

function poseOf(camera: THREE.Camera, target: THREE.Vector3): Pose {
  const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  return { target: target.clone(), radius: s.radius, phi: s.phi, theta: s.theta };
}

function applyPose(camera: THREE.PerspectiveCamera, controls: OrbitControls, pose: Pose) {
  controls.target.copy(pose.target);
  camera.position
    .setFromSpherical(new THREE.Spherical(pose.radius, pose.phi, pose.theta))
    .add(pose.target);
  camera.lookAt(pose.target);
}

function blendPose(a: Pose, b: Pose, t: number): Pose {
  let dTheta = b.theta - a.theta;
  while (dTheta > Math.PI) dTheta -= Math.PI * 2;
  while (dTheta < -Math.PI) dTheta += Math.PI * 2;
  return {
    target: a.target.clone().lerp(b.target, t),
    radius: a.radius * (b.radius / a.radius) ** t,
    phi: a.phi + (b.phi - a.phi) * t,
    theta: a.theta + dTheta * t,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

interface TableData {
  dems: DemGrid[];
  routes: Waypoint[][];
}

const tableData = new Map<string, Promise<TableData>>();

function loadTable(demIds: string): Promise<TableData> {
  if (!tableData.has(demIds)) {
    const dems = Promise.all(
      demIds.split(',').map((id) => fetchJson<DemGrid>(`/data/ski/${id}-dem.json`).catch(() => null))
    );
    const routes = fetchJson<Record<string, { waypoints: Waypoint[] }>>('/data/ski/routes.json')
      .then((r) => Object.values(r).map((x) => x.waypoints || []))
      .catch(() => [] as Waypoint[][]);
    tableData.set(
      demIds,
      Promise.all([dems, routes]).then(([list, wps]) => ({
        dems: list.filter((d): d is DemGrid => Boolean(d)),
        routes: wps,
      }))
    );
  }
  return tableData.get(demIds)!;
}

export default function CaliforniaTable({ destinations, home, returnFrom, flyRequest, onFlyStart, onArrive }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TableData | null>(null);
  const flyRef = useRef<((id: string) => void) | null>(null);
  const cb = useRef({ onFlyStart, onArrive });
  cb.current = { onFlyStart, onArrive };
  const latest = useRef({ destinations, home, returnFrom });
  latest.current = { destinations, home, returnFrom };
  const demIds = [...new Set(destinations.map((d) => d.dem))].sort().join(',');
  const layoutKey = JSON.stringify([
    home.lat,
    home.lng,
    destinations.map((d) => [d.id, d.dem, d.lat, d.lng]),
  ]);

  useEffect(() => {
    if (!demIds) return;
    let live = true;
    loadTable(demIds).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [demIds]);

  useEffect(() => {
    const el = host.current;
    if (!el || !data) return;
    const { dems, routes } = data;
    const { destinations, home, returnFrom } = latest.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = Math.max(el.clientWidth, 280);
    const height = Math.max(el.clientHeight, 280);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.className = 'ski-3d-canvas';
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.setSize(width, height);
    labels.domElement.className = 'ski-3d-labels';
    el.appendChild(labels.domElement);
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const leads = document.createElementNS(SVG_NS, 'svg');
    leads.setAttribute('class', 'ski-table-leads');
    labels.domElement.appendChild(leads);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c13);
    scene.fog = new THREE.Fog(0x060c13, 260, 1900);
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 2400;
    controls.maxPolarAngle = Math.PI * 0.44;

    scene.add(new THREE.HemisphereLight(0xbcd7ee, 0x1a140f, 0.75));
    const key = new THREE.DirectionalLight(0xdbeaff, 1.15);
    key.position.set(-60, 120, 40);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffc98a, 0.35);
    fill.position.set(80, 40, -60);
    scene.add(fill);

    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => {
      disposables.push(x);
      return x;
    };

    const floor = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(6000, 6000)),
      keep(new THREE.MeshLambertMaterial({ color: 0x0a121b }))
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.62;
    scene.add(floor);

    const shape = new THREE.Shape(CALIFORNIA_OUTLINE.map(([lng, lat]) => {
      const p = tableXZ(lat, lng);
      return new THREE.Vector2(p.x, p.z);
    }));
    const stateGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false }));
    stateGeo.rotateX(Math.PI / 2);
    const state = new THREE.Mesh(stateGeo, keep(new THREE.MeshLambertMaterial({ color: 0x17232f })));
    scene.add(state);
    const coast = new THREE.LineLoop(
      keep(new THREE.BufferGeometry().setFromPoints(
        CALIFORNIA_OUTLINE.map(([lng, lat]) => {
          const p = tableXZ(lat, lng);
          return new THREE.Vector3(p.x, 0.03, p.z);
        })
      )),
      keep(new THREE.LineBasicMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.55 }))
    );
    scene.add(coast);

    const routeMat = keep(new THREE.LineDashedMaterial({
      color: 0x7ec8e3,
      dashSize: 1.6,
      gapSize: 1.1,
      transparent: true,
      opacity: 0.7,
    }));
    for (const wps of routes) {
      if (wps.length < 2) continue;
      const line = new THREE.Line(
        keep(new THREE.BufferGeometry().setFromPoints(
          wps.map((w) => {
            const p = tableXZ(w.lat, w.lng);
            return new THREE.Vector3(p.x, 0.06, p.z);
          })
        )),
        routeMat
      );
      line.computeLineDistances();
      scene.add(line);
    }

    const homeXZ = tableXZ(home.lat, home.lng);
    const homeMark = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 24)),
      keep(new THREE.MeshBasicMaterial({ color: 0xe0b15a }))
    );
    homeMark.position.set(homeXZ.x, 0.13, homeXZ.z);
    scene.add(homeMark);
    const homeTag = document.createElement('div');
    homeTag.className = 'ski-table-home';
    homeTag.textContent = `${home.name} · home`;
    const homeObj = new CSS2DObject(homeTag);
    homeObj.position.set(homeXZ.x, 1.6, homeXZ.z);
    homeObj.center.set(-0.08, 0.5);
    scene.add(homeObj);

    const surfaceMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const skirtMat = keep(new THREE.MeshLambertMaterial({ color: 0x3a2f27, side: THREE.DoubleSide }));
    const anchors = new Map<string, THREE.Vector3>();
    const pickables: THREE.Mesh[] = [];
    const bounds = new THREE.Box3().expandByPoint(new THREE.Vector3(homeXZ.x, 0, homeXZ.z));
    const areaTags: AreaTag[] = [];

    const fly = (id: string) => {
      const anchor = anchors.get(id);
      if (!anchor) return;
      cb.current.onFlyStart(id);
      const to: Pose = {
        target: new THREE.Vector3(anchor.x, anchor.y * 0.65, anchor.z),
        radius: 14,
        phi: ARRIVE_PHI,
        theta: ARRIVE_THETA,
      };
      if (reduced) {
        cb.current.onArrive(id);
        return;
      }
      tween(poseOf(camera, controls.target), to, FLY_S, () => cb.current.onArrive(id));
    };

    for (const dem of dems) {
      const model = buildModel(dem);
      const group = new THREE.Group();
      group.position.set(model.center.x, 0, model.center.z);
      const surface = new THREE.Mesh(keep(model.surface), surfaceMat);
      surface.userData.dem = dem.id;
      group.add(surface, new THREE.Mesh(keep(model.skirt), skirtMat));
      scene.add(group);
      pickables.push(surface);

      const here = destinations.filter((d) => d.dem === dem.id);
      let topY = 0;
      for (const d of here) {
        const p = model.local(d.lat, d.lng);
        const a = new THREE.Vector3(model.center.x + p.x, modelY(nearestFt(dem, d.lat, d.lng)), model.center.z + p.z);
        anchors.set(d.id, a);
        topY = Math.max(topY, a.y);
        bounds.expandByPoint(a);
      }
      if (!here.length) continue;

      const tag = document.createElement('div');
      tag.className = 'ski-table-label';
      const area = document.createElement('span');
      area.className = 'ski-table-label__area';
      area.textContent = here[0].area;
      tag.appendChild(area);
      const row = document.createElement('div');
      row.className = 'ski-table-label__resorts';
      for (const d of here) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = d.name;
        btn.addEventListener('click', () => fly(d.id));
        row.appendChild(btn);
      }
      tag.appendChild(row);
      const obj = new CSS2DObject(tag);
      obj.position.set(model.center.x, topY + 2.2, model.center.z);
      scene.add(obj);
      const lead = document.createElementNS(SVG_NS, 'line');
      lead.style.display = 'none';
      leads.appendChild(lead);
      areaTags.push({ obj, el: tag, lead, x: model.center.x, pref: TAG_SLOTS[0], slot: TAG_SLOTS[0], w: 0, h: 0 });
    }
    // Neighbouring areas are only ~15 km apart, so default to alternating above and below their models.
    areaTags
      .sort((a, b) => a.x - b.x)
      .forEach((t, i) => {
        t.pref = i % 2 ? TAG_SLOTS[1] : TAG_SLOTS[0];
        t.slot = t.pref;
        t.obj.center.set(t.slot[0], t.slot[1]);
      });

    const proj = new THREE.Vector3();
    const homeBox = { w: 0, h: 0 };
    const screenOf = (obj: CSS2DObject, width: number, height: number) => {
      proj.setFromMatrixPosition(obj.matrixWorld).project(camera);
      if (proj.z > 1) return null;
      return { x: (proj.x + 1) * 0.5 * width, y: (1 - proj.y) * 0.5 * height };
    };
    // The state-wide view squeezes the SoCal areas together, so move any tag that would overlap into the next free slot.
    const declutter = () => {
      const { width, height } = labels.getSize();
      const placed: Rect[] = [];
      const home = screenOf(homeObj, width, height);
      if (!homeBox.w) {
        homeBox.w = homeTag.offsetWidth;
        homeBox.h = homeTag.offsetHeight;
      }
      if (home && homeBox.w) {
        const l = home.x + 0.08 * homeBox.w;
        placed.push({ l, r: l + homeBox.w, t: home.y - homeBox.h / 2, b: home.y + homeBox.h / 2 });
      }
      for (const t of areaTags) {
        t.lead.style.display = 'none';
        const s = screenOf(t.obj, width, height);
        if (!s) continue;
        if (!t.w) {
          t.w = t.el.offsetWidth;
          t.h = t.el.offsetHeight;
        }
        if (!t.w) continue;
        const rectAt = ([cx, cy]: Slot): Rect => {
          const left = s.x - cx * t.w;
          const top = s.y - cy * t.h;
          return { l: left, r: left + t.w, t: top, b: top + t.h };
        };
        const overlap = (slot: Slot) => {
          const a = rectAt(slot);
          const insideW = Math.max(0, Math.min(a.r, width) - Math.max(a.l, 0));
          const insideH = Math.max(0, Math.min(a.b, height) - Math.max(a.t, 0));
          let sum = t.w * t.h - insideW * insideH;
          for (const p of placed) {
            const ow = Math.min(a.r, p.r) - Math.max(a.l, p.l);
            const oh = Math.min(a.b, p.b) - Math.max(a.t, p.t);
            if (ow > 0 && oh > 0) sum += ow * oh;
          }
          return sum;
        };
        let best = t.pref;
        let bestCost = Infinity;
        for (const slot of [t.pref, t.slot, ...TAG_SLOTS]) {
          const cost = overlap(slot);
          if (cost < bestCost) {
            best = slot;
            bestCost = cost;
          }
          if (cost === 0) break;
        }
        if (best !== t.slot) {
          t.slot = best;
          t.obj.center.set(best[0], best[1]);
        }
        const box = rectAt(best);
        placed.push(box);
        const displaced = best !== TAG_SLOTS[0] && best !== TAG_SLOTS[1];
        t.lead.style.display = displaced ? '' : 'none';
        if (displaced) {
          t.lead.setAttribute('x1', s.x.toFixed(1));
          t.lead.setAttribute('y1', s.y.toFixed(1));
          t.lead.setAttribute('x2', THREE.MathUtils.clamp(s.x, box.l, box.r).toFixed(1));
          t.lead.setAttribute('y2', THREE.MathUtils.clamp(s.y, box.t, box.b).toFixed(1));
        }
      }
    };

    const tableCenter = bounds.getCenter(new THREE.Vector3()).setY(0);
    const tableSize = bounds.getSize(new THREE.Vector3());
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    const tablePose: Pose = {
      target: tableCenter,
      radius: Math.max(
        70,
        (tableSize.x * 0.5 + 18) / Math.tan(halfH),
        (tableSize.z * 0.5 + 14) / Math.tan(halfV)
      ),
      phi: 0.92,
      theta: 0,
    };
    const statePose: Pose = {
      target: (() => {
        const c = tableXZ(37.1, -119.6);
        return new THREE.Vector3(c.x, 0, c.z);
      })(),
      radius: 1750,
      phi: 0.5,
      theta: 0,
    };

    let tweening: gsap.core.Tween | null = null;
    function tween(from: Pose, to: Pose, duration: number, done?: () => void) {
      tweening?.kill();
      controls.enabled = false;
      const p = { t: 0 };
      tweening = gsap.to(p, {
        t: 1,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => applyPose(camera, controls, blendPose(from, to, p.t)),
        onComplete: () => {
          tweening = null;
          controls.enabled = true;
          done?.();
        },
      });
    }
    flyRef.current = fly;

    const arrivalOf = (id: string): Pose | null => {
      const a = anchors.get(id);
      if (!a) return null;
      return { target: new THREE.Vector3(a.x, a.y * 0.65, a.z), radius: 14, phi: ARRIVE_PHI, theta: ARRIVE_THETA };
    };
    const back = returnFrom ? arrivalOf(returnFrom) : null;
    if (reduced) {
      applyPose(camera, controls, tablePose);
    } else if (back) {
      applyPose(camera, controls, back);
      tween(back, tablePose, FLY_S);
    } else {
      applyPose(camera, controls, statePose);
      tween(statePose, tablePose, 2.8);
    }

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const canvas = renderer.domElement;
    const setNdc = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    };
    const pickResort = (): string | null => {
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      if (!hit) return null;
      let best: string | null = null;
      let bestD = Infinity;
      for (const d of destinations) {
        if (d.dem !== hit.object.userData.dem) continue;
        const a = anchors.get(d.id);
        if (!a) continue;
        const dist = Math.hypot(a.x - hit.point.x, a.z - hit.point.z);
        if (dist < bestD) {
          bestD = dist;
          best = d.id;
        }
      }
      return best;
    };
    const onMove = (ev: PointerEvent) => {
      if (tweening) return;
      setNdc(ev);
      canvas.style.cursor = pickResort() ? 'pointer' : '';
    };
    const onDown = (ev: PointerEvent) => {
      downAt = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = (ev: PointerEvent) => {
      if (!downAt || tweening) return;
      const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
      downAt = null;
      if (moved > 5) return;
      setNdc(ev);
      const id = pickResort();
      if (id) fly(id);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    let raf = 0;
    const tick = () => {
      if (!tweening) controls.update();
      renderer.render(scene, camera);
      declutter();
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
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', vis);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      tweening?.kill();
      flyRef.current = null;
      ro.disconnect();
      document.removeEventListener('visibilitychange', vis);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      canvas.remove();
      labels.domElement.remove();
    };
  }, [data, layoutKey]);

  useEffect(() => {
    if (flyRequest) flyRef.current?.(flyRequest);
  }, [flyRequest]);

  return (
    <div className="ski-trail-map ski-table" ref={host} role="application" aria-label="California ski table">
      {!data ? <p className="ski-table__loading">Setting the table…</p> : null}
      <div className="ski-3d-foot">
        <p>Click a mountain or a resort name to fly in · drag to orbit · scroll to zoom</p>
        <p>Terrain models {MODEL_SCALE}× scale, {VEXAG}× vertical · USGS 3DEP</p>
      </div>
    </div>
  );
}
