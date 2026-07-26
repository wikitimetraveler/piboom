/**
 * Glazed hero — Three.js exploding donut (ephemeral scene, auto-dispose)
 * Development work by David Lane
 */
import * as THREE from 'three';

const SPRINKLE_COLORS = [
  '#ff7a9a',
  '#fff4e8',
  '#5c3a2a',
  '#f5c76a',
  '#7ec8e3',
  '#e85a7a',
  '#ffd98a',
  '#c4f0c2'
];

const PIECE_COUNT = 96;
const SPARKLE_COUNT = 60;
const DURATION_MS = 1600;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (_) {
    return false;
  }
}

class DonutExplosion3D {
  /**
   * @param {HTMLElement} containerEl — stage host (e.g. .gz-hero-stage)
   * @param {string} productImage — URL for product cutout texture
   */
  constructor(containerEl, productImage) {
    this.container = containerEl;
    this.productImage = productImage || '/donuts/assets/products/classic-glazed-cutout.png';
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pieces = [];
    this.sparkles = null;
    this.shockwave = null;
    this.raf = 0;
    this.start = 0;
    this.disposed = false;
    this.texture = null;
    this.canvasEl = null;
  }

  static isSupported() {
    return canUseWebGL() && !prefersReducedMotion();
  }

  async explode() {
    if (this.disposed || !this.container) return false;
    try {
      await this.init();
      this.createParticles();
      this.createShockwave();
      this.start = performance.now();
      this.tick();
      window.setTimeout(() => this.dispose(), DURATION_MS + 200);
      return true;
    } catch (err) {
      console.warn('DonutExplosion3D failed', err);
      this.dispose();
      return false;
    }
  }

  async init() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(180, Math.round(rect.width || 280));
    const height = Math.max(180, Math.round(rect.height || width));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 0.15, 3.2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);

    const canvas = this.renderer.domElement;
    canvas.className = 'gz-explosion-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.canvasEl = canvas;
    this.container.appendChild(canvas);

    const loader = new THREE.TextureLoader();
    this.texture = await new Promise((resolve, reject) => {
      loader.load(
        this.productImage,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

    const light = new THREE.DirectionalLight(0xfff4e8, 1.15);
    light.position.set(1.2, 2, 2.5);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffd98a, 0.55));
  }

  createParticles() {
    const grid = 4;
    const cell = 1 / grid;
    const geom = new THREE.PlaneGeometry(0.28, 0.28);
    let pieceIdx = 0;

    for (let gy = 0; gy < grid; gy += 1) {
      for (let gx = 0; gx < grid; gx += 1) {
        const mat = new THREE.MeshBasicMaterial({
          map: this.texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        // UV crop per grid cell
        mat.map = this.texture.clone();
        mat.map.offset.set(gx * cell, 1 - (gy + 1) * cell);
        mat.map.repeat.set(cell, cell);
        mat.map.needsUpdate = true;

        const mesh = new THREE.Mesh(geom, mat);
        const ox = (gx - (grid - 1) / 2) * 0.32;
        const oy = ((grid - 1) / 2 - gy) * 0.32;
        mesh.position.set(ox, oy, 0);

        const angle = Math.atan2(oy, ox) + (Math.random() - 0.5) * 0.7;
        const speed = 1.35 + Math.random() * 1.55;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed + 0.55;
        const vz = (Math.random() - 0.5) * 0.9;
        const spin = {
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8,
          z: (Math.random() - 0.5) * 10
        };

        this.pieces.push({ mesh, vx, vy, vz, spin, born: 0 });
        this.scene.add(mesh);
        pieceIdx += 1;
      }
    }

    // Extra crumb-like billboards for density (reusing texture, smaller)
    const crumbs = PIECE_COUNT - pieceIdx;
    const crumbGeom = new THREE.PlaneGeometry(0.12, 0.12);
    for (let i = 0; i < crumbs; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.95,
        side: THREE.DoubleSide
      });
      mat.map = this.texture.clone();
      const u = Math.random() * 0.7;
      const v = Math.random() * 0.7;
      mat.map.offset.set(u, v);
      mat.map.repeat.set(0.28, 0.28);
      mat.map.needsUpdate = true;

      const mesh = new THREE.Mesh(crumbGeom, mat);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 1.8;
      this.pieces.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.7,
        vz: (Math.random() - 0.5) * 1.2,
        spin: {
          x: (Math.random() - 0.5) * 12,
          y: (Math.random() - 0.5) * 12,
          z: (Math.random() - 0.5) * 14
        },
        born: Math.random() * 0.05
      });
      this.scene.add(mesh);
    }

    // Sparkle point cloud
    const positions = new Float32Array(SPARKLE_COUNT * 3);
    const colors = new Float32Array(SPARKLE_COUNT * 3);
    const velocities = [];
    const color = new THREE.Color();

    for (let i = 0; i < SPARKLE_COUNT; i += 1) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      color.set(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.0 + Math.random() * 2.2;
      velocities.push({
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.4,
        vz: (Math.random() - 0.5) * 1.5
      });
    }

    const sparkleGeom = new THREE.BufferGeometry();
    sparkleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    sparkleGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const sparkleMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    this.sparkles = {
      points: new THREE.Points(sparkleGeom, sparkleMat),
      velocities,
      geom: sparkleGeom
    };
    this.scene.add(this.sparkles.points);
  }

  createShockwave() {
    const geom = new THREE.TorusGeometry(0.05, 0.018, 8, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff7a9a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.shockwave = new THREE.Mesh(geom, mat);
    this.shockwave.rotation.x = Math.PI / 2;
    this.scene.add(this.shockwave);
  }

  tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const elapsed = (performance.now() - this.start) / 1000;
    const dt = 1 / 60;
    const gravity = -2.4;

    for (let i = 0; i < this.pieces.length; i += 1) {
      const p = this.pieces[i];
      const localT = Math.max(0, elapsed - p.born);
      if (localT <= 0) continue;
      p.vy += gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;

      const life = Math.min(1, localT / 1.35);
      const scale = 1 - life * 0.78;
      p.mesh.scale.setScalar(Math.max(0.15, scale));
      if (p.mesh.material) {
        p.mesh.material.opacity = life < 0.55 ? 1 : 1 - (life - 0.55) / 0.45;
      }
    }

    if (this.sparkles) {
      const pos = this.sparkles.geom.attributes.position.array;
      for (let i = 0; i < SPARKLE_COUNT; i += 1) {
        const v = this.sparkles.velocities[i];
        v.vy += gravity * 0.55 * dt;
        pos[i * 3] += v.vx * dt;
        pos[i * 3 + 1] += v.vy * dt;
        pos[i * 3 + 2] += v.vz * dt;
      }
      this.sparkles.geom.attributes.position.needsUpdate = true;
      const sparkLife = Math.min(1, elapsed / 1.2);
      this.sparkles.points.material.opacity = 1 - sparkLife * 0.95;
      this.sparkles.points.material.size = 0.09 * (1 - sparkLife * 0.5);
    }

    if (this.shockwave) {
      const t = Math.min(1, elapsed / 0.35);
      const r = 0.05 + t * 1.55;
      this.shockwave.scale.set(r / 0.05, r / 0.05, 1);
      this.shockwave.material.opacity = 0.85 * (1 - t);
    }

    this.renderer.render(this.scene, this.camera);

    if (elapsed * 1000 > DURATION_MS) {
      this.dispose();
    }
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map && m.map !== this.texture) m.map.dispose();
            m.dispose();
          });
        }
      });
    }

    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.canvasEl?.parentNode) {
      this.canvasEl.parentNode.removeChild(this.canvasEl);
    }
    this.canvasEl = null;
    this.scene = null;
    this.camera = null;
    this.pieces = [];
    this.sparkles = null;
    this.shockwave = null;
  }
}

window.THREE_AVAILABLE = true;
window.DonutExplosion3D = DonutExplosion3D;
