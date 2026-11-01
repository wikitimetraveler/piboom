/**
 * Hangar photoreal maps and walkable ship interiors.
 * Original geometry. Development work by David Lane.
 */
import * as THREE from 'three';

const HULL_KEYS = ['imperial', 'imperialDark', 'rebel', 'panel', 'tieWing', 'cannon', 'ywing', 'falcon', 'falconDark', 'death'];

function canvasTex(size, draw, colorSpace) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace || THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function noise(ctx, size, alpha, count) {
  for (let i = 0; i < count; i += 1) {
    const v = 18 + Math.random() * 40;
    ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + alpha + ')';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
}

function paintHull(ctx, size) {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#c5cad2');
  g.addColorStop(0.45, '#8e959f');
  g.addColorStop(1, '#d5dae1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(20, 24, 30, 0.72)';
  ctx.lineWidth = 3;
  const step = size / 4;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30, 34, 40, 0.85)';
  for (let y = 18; y < size; y += step) {
    for (let x = 18; x < size; x += step / 2) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  for (let y = 4; y < size; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + Math.sin(y) * 1.5);
    ctx.stroke();
  }
  noise(ctx, size, 0.18, 900);
}

function paintRough(ctx, size) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 4;
  const step = size / 4;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  noise(ctx, size, 0.35, 500);
}

function paintWall(ctx, size) {
  ctx.fillStyle = '#6e767f';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#5c656e';
  for (let y = 0; y < size; y += 48) ctx.fillRect(0, y, size, 6);
  ctx.strokeStyle = 'rgba(12, 14, 18, 0.55)';
  ctx.lineWidth = 2;
  for (let x = 0; x < size; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  noise(ctx, size, 0.15, 400);
}

function paintDeck(ctx, size) {
  ctx.fillStyle = '#2a3038';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#14181e';
  ctx.lineWidth = 2;
  for (let i = 0; i < size; i += 16) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  noise(ctx, size, 0.25, 350);
}

function makeSign(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10141a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#e0b15a';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = '#f2f5f8';
  ctx.font = '600 52px sans-serif';
  ctx.fillText(text, 28, 82);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.34),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  return mesh;
}

function add(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function markRoom(group, id, eye, look) {
  const node = new THREE.Object3D();
  node.name = id;
  node.position.set(eye[0], eye[1], eye[2]);
  node.userData.look = new THREE.Vector3(look[0], look[1], look[2]);
  group.add(node);
  group.userData.rooms.push(node);
  return node;
}

function newInterior(id) {
  const group = new THREE.Group();
  group.name = id;
  group.userData.rooms = [];
  group.userData.shipId = id;
  return group;
}

function bayLights(group, spots) {
  spots.forEach((spot) => {
    const light = new THREE.PointLight(spot.color, spot.intensity, spot.distance || 9, 2);
    light.position.set(spot.x, spot.y, spot.z);
    group.add(light);
  });
}

function corridor(group, mats, length, width, height, z0) {
  const floor = add(group, new THREE.BoxGeometry(width, 0.08, length), mats.deck, 0, 0, z0);
  floor.receiveShadow = false;
  add(group, new THREE.BoxGeometry(width, 0.08, length), mats.ceiling, 0, height, z0);
  add(group, new THREE.BoxGeometry(0.08, height, length), mats.wall, -width / 2, height / 2, z0);
  add(group, new THREE.BoxGeometry(0.08, height, length), mats.wall, width / 2, height / 2, z0);
  const ribs = Math.max(2, Math.floor(length / 1.4));
  for (let i = 0; i < ribs; i += 1) {
    const z = z0 - length / 2 + (i + 0.5) * (length / ribs);
    add(group, new THREE.BoxGeometry(width + 0.02, 0.06, 0.06), mats.trim, 0, height - 0.04, z);
    add(group, new THREE.BoxGeometry(0.05, 0.05, 0.9), mats.lamp, -width / 2 + 0.12, height - 0.12, z);
  }
}

function seat(group, mats, x, y, z, yaw) {
  const rig = new THREE.Group();
  add(rig, new THREE.BoxGeometry(0.48, 0.1, 0.48), mats.seat, 0, 0.48, 0);
  add(rig, new THREE.BoxGeometry(0.48, 0.62, 0.1), mats.seat, 0, 0.86, -0.2);
  add(rig, new THREE.BoxGeometry(0.08, 0.42, 0.08), mats.trim, -0.16, 0.22, 0);
  add(rig, new THREE.BoxGeometry(0.08, 0.42, 0.08), mats.trim, 0.16, 0.22, 0);
  rig.position.set(x, y, z);
  rig.rotation.y = yaw || 0;
  group.add(rig);
  return rig;
}

function consoleBank(group, mats, x, y, z, yaw) {
  const rig = new THREE.Group();
  add(rig, new THREE.BoxGeometry(0.9, 0.55, 0.42), mats.trim, 0, 0.55, 0);
  const screen = add(rig, new THREE.BoxGeometry(0.62, 0.28, 0.04), mats.screen, 0, 0.92, 0.18);
  screen.rotation.x = -0.4;
  rig.position.set(x, y, z);
  rig.rotation.y = yaw || 0;
  group.add(rig);
  return rig;
}

function buildLambda(mats) {
  const g = newInterior('lambda');
  corridor(g, mats, 8.2, 2.3, 2.15, 0.2);
  add(g, new THREE.BoxGeometry(1.1, 0.08, 1.6), mats.deck, 0, -0.15, -4.6);
  const ramp = add(g, new THREE.BoxGeometry(1.1, 0.06, 1.8), mats.trim, 0, -0.35, -5.6);
  ramp.rotation.x = 0.35;
  seat(g, mats, -0.45, 0, -1.2, 0);
  seat(g, mats, 0.45, 0, -1.2, 0);
  seat(g, mats, -0.45, 0, 0.4, Math.PI);
  seat(g, mats, 0.45, 0, 0.4, Math.PI);
  consoleBank(g, mats, 0, 0, 3.15, 0);
  seat(g, mats, -0.38, 0, 2.35, 0);
  seat(g, mats, 0.38, 0, 2.35, 0);
  const canopy = add(g, new THREE.SphereGeometry(0.85, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass, 0, 1.7, 2.7);
  canopy.scale.set(1.15, 0.7, 1.3);
  const sign = makeSign('CABIN');
  sign.position.set(0, 1.7, -2.4);
  g.add(sign);
  bayLights(g, [
    { x: 0, y: 1.9, z: -1, color: 0xfff2d2, intensity: 3.2 },
    { x: 0, y: 1.8, z: 2.6, color: 0x9ecbff, intensity: 2.4 },
    { x: 0, y: 0.6, z: -5.2, color: 0xffb070, intensity: 1.6, distance: 6 },
  ]);
  markRoom(g, 'ramp', [0, 1.45, -4.2], [0, 1.1, -6]);
  markRoom(g, 'cabin', [0, 1.55, -0.2], [0, 1.2, 1.4]);
  markRoom(g, 'cockpit', [0, 1.5, 1.7], [0, 1.15, 3.3]);
  return g;
}

function buildXwing(mats) {
  const g = newInterior('x-wing');
  corridor(g, mats, 3.2, 1.25, 1.45, 0);
  consoleBank(g, mats, 0, 0, 1.15, 0);
  seat(g, mats, 0, 0, 0.15, 0);
  const canopy = add(g, new THREE.SphereGeometry(0.62, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass, 0, 1.15, 0.35);
  canopy.scale.set(1, 0.72, 1.35);
  add(g, new THREE.SphereGeometry(0.28, 14, 10), mats.trim, 0, 0.55, -1.15);
  add(g, new THREE.CylinderGeometry(0.22, 0.26, 0.35, 12), mats.screen, 0, 0.35, -1.15);
  const sign = makeSign('SOCKET');
  sign.position.set(0, 1.15, -0.7);
  sign.rotation.y = Math.PI;
  g.add(sign);
  bayLights(g, [
    { x: 0, y: 1.2, z: 0.4, color: 0xd7e8ff, intensity: 2.2, distance: 4 },
    { x: 0, y: 0.8, z: -1.1, color: 0xffc46a, intensity: 1.2, distance: 3 },
  ]);
  markRoom(g, 'cockpit', [0, 1.15, -0.55], [0, 1.05, 1.2]);
  markRoom(g, 'socket', [0, 1.15, 0.35], [0, 0.7, -1.2]);
  return g;
}

function buildTie(mats) {
  const g = newInterior('tie');
  add(g, new THREE.SphereGeometry(1.35, 28, 20), mats.wall, 0, 1.15, 0).scale.set(1, 1, 1.05);
  const shell = g.children[0];
  shell.material = mats.wallInside;
  add(g, new THREE.CircleGeometry(0.42, 20), mats.glass, 0, 1.25, 1.28);
  add(g, new THREE.BoxGeometry(0.7, 0.45, 0.08), mats.screen, 0, 1.15, 0.95);
  seat(g, mats, 0, 0.15, -0.15, 0);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.28, 0.5, 0.06), mats.trim, Math.cos(a) * 1.05, 1.15, Math.sin(a) * 1.05);
  }
  const sign = makeSign('COCKPIT');
  sign.position.set(0, 2.05, -0.2);
  g.add(sign);
  bayLights(g, [
    { x: 0, y: 2.1, z: 0, color: 0xfff4e0, intensity: 2.4, distance: 5 },
    { x: 0, y: 1.2, z: 0.8, color: 0x7ec8ff, intensity: 1.5, distance: 3 },
  ]);
  markRoom(g, 'seat', [0, 1.35, -0.72], [0, 1.2, 1.1]);
  markRoom(g, 'panels', [0.15, 1.4, 0.35], [-1.05, 1.15, 0]);
  return g;
}

function buildYwing(mats) {
  const g = newInterior('y-wing');
  corridor(g, mats, 4.4, 1.35, 1.5, 0.2);
  consoleBank(g, mats, 0, 0, 1.7, 0);
  seat(g, mats, 0, 0, 0.7, 0);
  seat(g, mats, 0, 0, -0.8, Math.PI);
  add(g, new THREE.BoxGeometry(0.7, 0.35, 0.08), mats.screen, 0, 1.05, -1.35);
  const canopy = add(g, new THREE.SphereGeometry(0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass, 0, 1.25, 0.85);
  canopy.scale.set(1.05, 0.65, 1.2);
  bayLights(g, [
    { x: 0, y: 1.3, z: 0.8, color: 0xfff0d0, intensity: 2.1, distance: 4 },
    { x: 0, y: 1.1, z: -1.1, color: 0xff9a4a, intensity: 1.3, distance: 3 },
  ]);
  markRoom(g, 'pilot', [0, 1.2, -0.15], [0, 1.05, 1.6]);
  markRoom(g, 'gunner', [0, 1.2, 0.15], [0, 1.0, -1.4]);
  return g;
}

function buildFalcon(mats) {
  const g = newInterior('falcon');
  add(g, new THREE.CylinderGeometry(4.6, 4.6, 0.1, 40), mats.deck, 0, 0, 0);
  add(g, new THREE.CylinderGeometry(4.6, 4.6, 0.08, 40), mats.ceiling, 0, 2.35, 0);
  add(g, new THREE.TorusGeometry(4.55, 0.08, 8, 40), mats.trim, 0, 1.15, 0).rotation.x = Math.PI / 2;
  add(g, new THREE.CylinderGeometry(0.7, 0.7, 0.12, 20), mats.trim, -0.8, 0.72, 0.2);
  seat(g, mats, -1.6, 0, 0.9, 0.6);
  seat(g, mats, -1.5, 0, -0.5, -0.5);
  seat(g, mats, 0.1, 0, 0.9, 2.4);
  for (let i = 0; i < 4; i += 1) {
    add(g, new THREE.BoxGeometry(0.7, 0.55, 0.7), mats.crate, -2.4 + (i % 2) * 0.8, 0.28, -2.3 - Math.floor(i / 2) * 0.8);
  }
  const tube = new THREE.Group();
  add(tube, new THREE.BoxGeometry(2.4, 0.08, 1.15), mats.deck, 1.7, 0.02, 1.55);
  add(tube, new THREE.BoxGeometry(2.4, 0.08, 1.15), mats.ceiling, 1.7, 1.9, 1.55);
  add(tube, new THREE.BoxGeometry(2.4, 1.8, 0.08), mats.wall, 1.7, 0.95, 2.1);
  add(tube, new THREE.BoxGeometry(2.4, 1.8, 0.08), mats.wall, 1.7, 0.95, 1.0);
  g.add(tube);
  consoleBank(g, mats, 2.7, 0, 1.55, Math.PI / 2);
  seat(g, mats, 2.05, 0, 1.35, Math.PI / 2);
  seat(g, mats, 2.05, 0, 1.8, Math.PI / 2);
  add(g, new THREE.BoxGeometry(1.4, 1.2, 0.12), mats.engineGlow, 0, 0.8, -3.7);
  add(g, new THREE.BoxGeometry(0.35, 0.9, 0.2), mats.engineGlow, -0.45, 0.7, -3.45);
  add(g, new THREE.BoxGeometry(0.35, 0.9, 0.2), mats.engineGlow, 0.45, 0.7, -3.45);
  const ramp = add(g, new THREE.BoxGeometry(1.3, 0.07, 2.2), mats.trim, 0, -0.2, 4.8);
  ramp.rotation.x = 0.28;
  const holdSign = makeSign('HOLD');
  holdSign.position.set(-2.2, 1.7, 1.4);
  g.add(holdSign);
  const engSign = makeSign('ENGINES');
  engSign.position.set(0, 1.7, -2.6);
  g.add(engSign);
  bayLights(g, [
    { x: -0.8, y: 2.05, z: 0.2, color: 0xfff1d4, intensity: 6, distance: 12 },
    { x: 2.2, y: 1.6, z: 1.55, color: 0xb7d4ff, intensity: 2.4, distance: 6 },
    { x: 0, y: 1.2, z: -3.2, color: 0xff7a3a, intensity: 4, distance: 8 },
    { x: 0, y: 1.2, z: 4.2, color: 0xffc48a, intensity: 2, distance: 7 },
  ]);
  markRoom(g, 'ramp', [0, 1.5, 3.6], [0, 1.1, 5.4]);
  markRoom(g, 'hold', [-1.2, 1.6, 1.6], [-2.2, 0.8, -1.8]);
  markRoom(g, 'lounge', [0.4, 1.6, -0.6], [-0.9, 0.9, 0.3]);
  markRoom(g, 'cockpit', [1.15, 1.45, 1.55], [2.8, 1.1, 1.55]);
  markRoom(g, 'engineering', [0, 1.55, -1.8], [0, 1.0, -3.6]);
  return g;
}

function buildDestroyer(mats) {
  const g = newInterior('star-destroyer');
  add(g, new THREE.BoxGeometry(9.5, 0.1, 6.2), mats.deck, 0, 0, 6);
  add(g, new THREE.BoxGeometry(9.5, 0.08, 6.2), mats.ceiling, 0, 2.8, 6);
  add(g, new THREE.BoxGeometry(9.5, 2.6, 0.1), mats.wall, 0, 1.35, 9.05);
  add(g, new THREE.BoxGeometry(0.1, 2.6, 6.2), mats.wall, -4.75, 1.35, 6);
  add(g, new THREE.BoxGeometry(0.1, 2.6, 6.2), mats.wall, 4.75, 1.35, 6);
  const glass = add(g, new THREE.BoxGeometry(7.2, 1.3, 0.06), mats.glass, 0, 1.7, 9.02);
  glass.material = mats.glass;
  for (let i = -3; i <= 3; i += 1) {
    consoleBank(g, mats, i * 1.15, 0, 7.3, 0);
  }
  for (let i = -2; i <= 2; i += 1) seat(g, mats, i * 1.3, 0, 5.4, 0);
  corridor(g, mats, 8, 2.2, 2.3, -2.2);
  add(g, new THREE.BoxGeometry(8.5, 0.1, 7), mats.deck, 0, 0, -10);
  add(g, new THREE.BoxGeometry(8.5, 0.08, 7), mats.ceiling, 0, 3.4, -10);
  add(g, new THREE.BoxGeometry(0.1, 3.3, 7), mats.wall, -4.25, 1.65, -10);
  add(g, new THREE.BoxGeometry(0.1, 3.3, 7), mats.wall, 4.25, 1.65, -10);
  add(g, new THREE.BoxGeometry(2.2, 0.7, 3.4), mats.trim, -1.8, 0.4, -10.4);
  add(g, new THREE.ConeGeometry(0.35, 1.1, 10), mats.trim, -1.8, 0.9, -9.2).rotation.x = Math.PI / 2;
  add(g, new THREE.BoxGeometry(3.2, 2.2, 0.08), mats.lamp, 0, 1.4, -13.4);
  const sign = makeSign('BRIDGE');
  sign.position.set(-3.4, 2.2, 7.2);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  const baySign = makeSign('HANGAR');
  baySign.position.set(3.2, 2.4, -8.2);
  g.add(baySign);
  bayLights(g, [
    { x: 0, y: 2.4, z: 6.2, color: 0xd5e6ff, intensity: 5, distance: 14 },
    { x: 0, y: 2.0, z: -2.2, color: 0xfff0d2, intensity: 2.5, distance: 8 },
    { x: 0, y: 2.8, z: -10, color: 0xffd2a8, intensity: 5, distance: 14 },
  ]);
  markRoom(g, 'bridge', [0, 1.6, 4.6], [0, 1.5, 8.6]);
  markRoom(g, 'corridor', [0, 1.55, -1.2], [0, 1.3, -4.2]);
  markRoom(g, 'bay', [1.4, 1.6, -8.2], [-1.6, 1.1, -10.6]);
  return g;
}

function buildDeathStar(mats) {
  const g = newInterior('death-star');
  corridor(g, mats, 12, 2.6, 2.5, 0);
  add(g, new THREE.BoxGeometry(0.12, 0.08, 12), mats.engineGlow, -1.15, 0.35, 0);
  add(g, new THREE.CircleGeometry(1.15, 28), mats.engineGlow, 0, 1.4, 5.95);
  add(g, new THREE.TorusGeometry(1.25, 0.08, 8, 28), mats.trim, 0, 1.4, 5.9);
  add(g, new THREE.BoxGeometry(7.5, 0.1, 6.5), mats.deck, 0, 0, -9);
  add(g, new THREE.BoxGeometry(7.5, 0.08, 6.5), mats.ceiling, 0, 3.2, -9);
  add(g, new THREE.BoxGeometry(7.5, 3.1, 0.1), mats.wall, 0, 1.55, -12.2);
  add(g, new THREE.BoxGeometry(0.1, 3.1, 6.5), mats.wall, -3.75, 1.55, -9);
  add(g, new THREE.BoxGeometry(0.1, 3.1, 6.5), mats.wall, 3.75, 1.55, -9);
  add(g, new THREE.BoxGeometry(2.4, 0.8, 2.8), mats.trim, 1.4, 0.45, -9.2);
  add(g, new THREE.BoxGeometry(2.8, 2.4, 0.1), mats.lamp, 0, 1.5, -12.1);
  const sign = makeSign('GALLERY');
  sign.position.set(-1.05, 1.9, 3.2);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  const dock = makeSign('DOCK');
  dock.position.set(-2.8, 2.2, -8);
  g.add(dock);
  bayLights(g, [
    { x: 0, y: 2.2, z: 0, color: 0xffe6c8, intensity: 2.4, distance: 8 },
    { x: 0, y: 1.5, z: 5.2, color: 0xff4a32, intensity: 3.5, distance: 7 },
    { x: 0, y: 2.6, z: -9, color: 0xfff0d8, intensity: 4.5, distance: 12 },
  ]);
  markRoom(g, 'corridor', [0, 1.55, -2.4], [0, 1.3, 1.2]);
  markRoom(g, 'gallery', [0, 1.55, 3.4], [0, 1.4, 5.8]);
  markRoom(g, 'dock', [0, 1.6, -7.2], [1.2, 1.1, -9.4]);
  return g;
}

export function createDetailKit(renderer) {
  const hullMap = canvasTex(1024, paintHull);
  hullMap.repeat.set(2, 2);
  const roughMap = canvasTex(512, paintRough, THREE.NoColorSpace);
  roughMap.repeat.set(2, 2);
  const wallMap = canvasTex(512, paintWall);
  wallMap.repeat.set(2, 3);
  const deckMap = canvasTex(512, paintDeck, THREE.NoColorSpace);
  deckMap.repeat.set(4, 4);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  [hullMap, roughMap, wallMap, deckMap].forEach((tex) => {
    tex.anisotropy = Math.min(8, maxAniso || 1);
  });

  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(14, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x243044, side: THREE.BackSide })
  ));
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff4dd })
  );
  lamp.position.set(4, 5, 3);
  envScene.add(lamp);
  const warm = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.4, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xff7a3a })
  );
  warm.position.set(-3, 3.2, -2);
  envScene.add(warm);
  const cool = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xb9d4ff })
  );
  cool.position.set(-5, 2.2, 6);
  envScene.add(cool);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  envScene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });

  const mats = {
    wall: new THREE.MeshStandardMaterial({
      color: 0x8b939c, map: wallMap, roughness: 0.62, metalness: 0.42, envMapIntensity: 0.8,
    }),
    wallInside: new THREE.MeshStandardMaterial({
      color: 0x3a414c, map: wallMap, roughness: 0.7, metalness: 0.35, side: THREE.BackSide, envMapIntensity: 0.6,
    }),
    deck: new THREE.MeshStandardMaterial({
      color: 0x4a515a, map: deckMap, roughness: 0.84, metalness: 0.18, envMapIntensity: 0.45,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: 0x2c3138, roughness: 0.8, metalness: 0.2,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0x1c2128, roughness: 0.45, metalness: 0.55, envMapIntensity: 0.7,
    }),
    seat: new THREE.MeshStandardMaterial({
      color: 0x2a2420, roughness: 0.86, metalness: 0.05,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: 0xfff6e4, emissive: 0xffe2b0, emissiveIntensity: 1.4, roughness: 0.4,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x123044, emissive: 0x3ec6ff, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.1,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xb9dfff,
      roughness: 0.05,
      metalness: 0.04,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1,
    }),
    crate: new THREE.MeshStandardMaterial({
      color: 0x6a5a42, roughness: 0.78, metalness: 0.08,
    }),
    engineGlow: new THREE.MeshStandardMaterial({
      color: 0x3a2018, emissive: 0xff6a2a, emissiveIntensity: 1.8, roughness: 0.4,
    }),
  };

  return { hullMap, roughMap, deckMap, envMap, mats };
}

export function coatHulls(root, mats, kit) {
  const swapped = new Map();
  HULL_KEYS.forEach((key) => {
    const prev = mats[key];
    if (!prev || swapped.has(prev)) return;
    const next = new THREE.MeshPhysicalMaterial({
      color: prev.color,
      map: kit.hullMap,
      roughnessMap: kit.roughMap,
      metalness: Math.min(0.96, (prev.metalness || 0.4) + 0.28),
      roughness: Math.max(0.16, (prev.roughness == null ? 0.4 : prev.roughness) * 0.82),
      clearcoat: 0.62,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.45,
    });
    swapped.set(prev, next);
  });
  root.traverse((obj) => {
    if (obj.material && swapped.has(obj.material)) obj.material = swapped.get(obj.material);
  });
  swapped.forEach((next, prev) => prev.dispose());
  if (mats.floor) {
    mats.floor.color.setHex(0xc5ccd4);
    mats.floor.map = kit.deckMap;
    mats.floor.roughness = 0.72;
    mats.floor.metalness = 0.42;
    mats.floor.envMapIntensity = 0.4;
    mats.floor.needsUpdate = true;
  }
}

export function buildShipInteriors(kit) {
  const mats = kit.mats;
  return {
    lambda: buildLambda(mats),
    'x-wing': buildXwing(mats),
    tie: buildTie(mats),
    'y-wing': buildYwing(mats),
    falcon: buildFalcon(mats),
    'star-destroyer': buildDestroyer(mats),
    'death-star': buildDeathStar(mats),
  };
}
