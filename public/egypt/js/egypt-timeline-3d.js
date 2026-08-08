/**
 * Egypt timeline — light Three.js sandstone stele (scholarly accent).
 * Falls back silently if WebGL / THREE unavailable. Pauses offscreen.
 * Development work by David Lane
 */
(function () {
  'use strict';

  let renderer;
  let scene;
  let camera;
  let stele;
  let raf = 0;
  let running = false;
  let reduced = false;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function dispose() {
    cancelAnimationFrame(raf);
    raf = 0;
    running = false;
    if (stele) {
      stele.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      stele = null;
    }
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }
    scene = null;
    camera = null;
  }

  function buildStele(THREE) {
    const group = new THREE.Group();

    const stone = new THREE.MeshStandardMaterial({
      color: 0xc4a574,
      roughness: 0.82,
      metalness: 0.08
    });
    const rim = new THREE.MeshStandardMaterial({
      color: 0x74172a,
      roughness: 0.55,
      metalness: 0.15
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xc9992f,
      roughness: 0.45,
      metalness: 0.35
    });

    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.18), stone);
    slab.castShadow = false;
    group.add(slab);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.22, 0.06), rim);
    frame.position.z = -0.08;
    group.add(frame);

    // Calendar groove ticks on the face
    for (let i = 0; i < 7; i += 1) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.018, 0.02), gold);
      tick.position.set(0, 0.38 - i * 0.12, 0.1);
      group.add(tick);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.22), gold);
    cap.position.y = 0.62;
    group.add(cap);

    group.rotation.x = 0.18;
    group.rotation.y = -0.35;
    return group;
  }

  function resize(mount) {
    if (!renderer || !camera || !mount) return;
    const w = Math.max(120, mount.clientWidth || 160);
    const h = Math.max(120, mount.clientHeight || 140);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function tick(t) {
    if (!running || !renderer || !scene || !camera) return;
    raf = requestAnimationFrame(tick);
    if (stele && !reduced) {
      stele.rotation.y = -0.35 + Math.sin(t * 0.00045) * 0.22;
      stele.position.y = Math.sin(t * 0.0011) * 0.04;
    }
    renderer.render(scene, camera);
  }

  function setRunning(on) {
    if (on === running) return;
    running = on;
    if (on) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function init() {
    const mount = document.getElementById('egTimeline3d');
    if (!mount || typeof window.THREE === 'undefined') return;

    reduced = prefersReducedMotion();
    const THREE = window.THREE;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (_) {
      mount.hidden = true;
      return;
    }

    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0.15, 3.1);

    const key = new THREE.DirectionalLight(0xffe8c8, 1.15);
    key.position.set(2.2, 3.2, 2.5);
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xf6efe2, 0.55));
    const fill = new THREE.DirectionalLight(0xb5301f, 0.25);
    fill.position.set(-2, 0.5, -1);
    scene.add(fill);

    stele = buildStele(THREE);
    scene.add(stele);
    resize(mount);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize(mount)) : null;
    if (ro) ro.observe(mount);
    window.addEventListener('resize', () => resize(mount), { passive: true });

    const section = document.getElementById('egTimeline');
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        setRunning(visible && !document.hidden && section?.classList.contains('is-open'));
      },
      { threshold: 0.12 }
    );
    if (section) io.observe(section);

    document.addEventListener('visibilitychange', () => {
      const open = section?.classList.contains('is-open');
      setRunning(open && !document.hidden && (section?.getBoundingClientRect().bottom || 0) > 0);
    });

    document.addEventListener('hl:section-expanded', (event) => {
      if (event.detail?.id === 'egTimeline') {
        resize(mount);
        setRunning(!document.hidden);
      }
    });

    // Collapse pauses via MutationObserver on class
    if (section) {
      const mo = new MutationObserver(() => {
        const open = section.classList.contains('is-open');
        if (!open) setRunning(false);
        else {
          resize(mount);
          setRunning(!document.hidden);
        }
      });
      mo.observe(section, { attributes: true, attributeFilter: ['class'] });
    }

    if (reduced) {
      renderer.render(scene, camera);
      return;
    }

    setRunning(true);

    window.addEventListener('pagehide', dispose, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // THREE may load with defer — wait briefly
      if (typeof window.THREE !== 'undefined') init();
      else {
        let tries = 0;
        const timer = setInterval(() => {
          tries += 1;
          if (typeof window.THREE !== 'undefined' || tries > 40) {
            clearInterval(timer);
            init();
          }
        }, 50);
      }
    });
  } else if (typeof window.THREE !== 'undefined') {
    init();
  }
})();
