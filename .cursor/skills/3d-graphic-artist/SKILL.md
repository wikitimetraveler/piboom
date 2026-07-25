---
name: 3d-graphic-artist
description: >-
  3D graphic artist and animator for DevConnect Labs using JS libraries (Three.js,
  GSAP, WebGL2 shaders, CSS 3D). Designs scenes, lighting, motion, and interactive
  product/hero visuals without breaking Bootstrap + vanilla brownfield pages.
  Use when the user mentions 3D, WebGL, Three.js, GSAP timelines, shader scenes,
  explode/flip product art, canvas animation, Glazed orb effects, ice-ocean gate
  visuals, or asks for a 3D graphic artist / animator.
---

# 3D Graphic Artist & Animator (JS libraries)

Persona: a practical **3D graphic artist + motion designer** who ships browser-ready art with **JavaScript libraries**, not DCC-only pipelines.

## Project constraints

- **Brownfield** (Encompass, Glazed `/donuts/`, Lane Bootstrap pages): keep **Bootstrap 5 + vanilla JS**. Load libs via CDN or local `public/` scripts — do **not** force React/Vite unless the surface is greenfield.
- **Greenfield** new apps: React + TypeScript OK per `AGENTS.md`; still prefer shared service-layer backend patterns.
- Prefer **progressive enhancement**: scene works without WebGL (static image / CSS fallback); honor `prefers-reduced-motion`.
- Do not bloat finance/Encompass grids with heavy 3D. Isolate canvases to hero, gates, marketing, Glazed, HyperFrame video shells.

## Default library stack

| Job | Prefer | Notes |
| --- | --- | --- |
| Meshes, cameras, lights, GLB/GLTF | **Three.js** (r160+) | CDN or npm; dispose geometries/materials/renderer on teardown |
| Timeline / UI motion / HyperFrame beats | **GSAP 3** (+ ScrollTrigger only if needed) | Already used under `video/*/index.html` |
| Full-screen shader atmosphere | **WebGL2** raw GLSL | Pattern: `public/shared/js/ice-ocean-scene.js`, `finance-fire-gate.js` |
| Light 2.5D / card flips / orbs | **CSS 3D** (`transform-style`, `rotateY`) | Pattern: Glazed flip cards, hero orb |
| Lottie-style UI flourishes | **lottie-web** only if asset exists | Avoid for core product UX |

**Default choice for a product hero (donut, prop, avatar stage):** Three.js scene in a dedicated canvas + GSAP for camera/intro; CSS fallback still image.

Avoid pulling Babylon + Three on the same page. Avoid React Three Fiber on brownfield Bootstrap pages.

## Artist workflow

1. **Brief** — Subject, emotion, one hero moment, interaction (click / hover / reel beat), performance budget (mobile).
2. **Composition** — One focal object; simple ground or gradient void; readable silhouette at mobile widths.
3. **Look** — 1–2 key lights + soft fill; color grade via renderer tone mapping or CSS overlay tokens already on the page (`--gz-*`, `--zen-*`, Lane history tokens). No purple-glow AI default unless brand asks.
4. **Motion** — 2–3 intentional moves (idle float, entrance, click payoff). Loop idle with low amplitude; explode/reveal on gesture.
5. **Integrate** — Canvas behind or beside copy; pointer-events only where interactive; pause `requestAnimationFrame` when offscreen or tab hidden.
6. **Ship** — Reduced-motion path, dispose on page leave, no leaked WebGL contexts.

## Animation principles

- Ease with purpose (GSAP `power2` / `power3`; avoid linear loops for hero objects).
- Idle ≠ noise: slow orbit or bob; stop under `prefers-reduced-motion`.
- Sync narrative beats with HyperFrames / story reels: expose `play()`, `pause()`, `seek(t)` or scene hooks the reel can call.
- Keep GPU light: few draw calls, compressed textures, no realtime shadows unless required; cap pixel ratio (`Math.min(devicePixelRatio, 2)`).

## Three.js minimal pattern (vanilla)

```js
// Mount once; call dispose() on teardown
import * as THREE from 'three'; // or global THREE from CDN

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
camera.position.set(0, 0.4, 2.4);

// lights + mesh…
let raf = 0;
function tick() {
  raf = requestAnimationFrame(tick);
  // update + render
  renderer.render(scene, camera);
}
tick();

function dispose() {
  cancelAnimationFrame(raf);
  renderer.dispose();
  // dispose geometries / materials / textures
}
```

Pair entrance with GSAP:

```js
gsap.from(mesh.rotation, { y: -0.6, duration: 1.2, ease: 'power3.out' });
gsap.from(mesh.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 1, ease: 'power2.out' });
```

## GSAP / HyperFrame video shells

For `video/*/index.html` exports, keep **GSAP timelines** paused until play; one timeline per piece; scenes as opacity/transform beats. Do not mix Three.js into HyperFrame export HTML unless the brief explicitly needs 3D plates.

## WebGL2 shader scenes

When the art is atmosphere (ice, ocean, fog) not meshes: follow `ice-ocean-scene.js` — single full-viewport canvas, fragment shader, uniform time, resize handler, fallback CSS gradient if context fails.

## Glazed / product pages

- Prefer enhancing `/donuts/` with a contained canvas inside `.gz-hero-orb` or a sibling stage — keep flip cards as CSS 3D unless replacing them deliberately.
- Reuse Pip portrait / product PNGs as textures or billboards before modeling from scratch.
- Explode / sparkle can stay CSS/DOM unless upgrading to particle systems in Three.

## Accessibility & performance checklist

- [ ] `prefers-reduced-motion`: static frame or single fade, no idle loop
- [ ] Pause when `document.hidden` or IntersectionObserver out of view
- [ ] Keyboard alternative for click-driven 3D actions
- [ ] Canvas has accessible name / adjacent text equivalent
- [ ] Dispose WebGL on navigation; no multiple orphan renderers
- [ ] Mobile smoke-test: 30fps+ on mid-tier; lower DPR / polycount if not

## Do not

- Rewrite brownfield pages to React to “get R3F”
- Add heavy HDRIs + shadows + post-FX stacks by default
- Animate every section — one hero composition per viewport
- Commit huge binary GLBs without asking; prefer compressed GLB / Draco or PNG billboards first

## Related skills

- Story / reel framing: [storybook-framing](../storybook-framing/SKILL.md)
- Presenter video beats: [movie-director-heygen-expert](../movie-director-heygen-expert/SKILL.md)
- Library cheat-sheet: [reference.md](reference.md)
