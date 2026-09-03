/**
 * Optional WebGPU Milky Way + twinkle backdrop under the planetarium FunHomeSky dome.
 * Soft-fails to a 2D canvas wash when navigator.gpu is unavailable.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const COMPUTE_WGSL = `
struct Uniforms {
  time: f32,
  width: f32,
  height: f32,
  reduced: f32,
  seed: f32,
  _p0: f32,
  _p1: f32,
  _p2: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var outTex: texture_storage_2d<rgba8unorm, write>;

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q = q + dot(q, q + 74.7);
  return fract(q.x * q.y);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var v = 0.0;
  var a = 0.5;
  for (var i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.05;
    a *= 0.5;
  }
  return v;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let wh = vec2u(u32(u.width), u32(u.height));
  if (id.x >= wh.x || id.y >= wh.y) { return; }
  let uv = vec2f(f32(id.x) + 0.5, f32(id.y) + 0.5) / vec2f(u.width, u.height);
  let aspect = u.width / max(u.height, 1.0);

  // Deep night wash
  var col = vec3f(0.02, 0.035, 0.07);
  col += vec3f(0.01, 0.02, 0.04) * (1.0 - uv.y);

  // Soft Milky Way band only — catalog stars come from FunHomeSky (no pixel lattice)
  let mwUv = vec2f((uv.x - 0.5) * aspect, uv.y - 0.42);
  let c = cos(-0.48);
  let s = sin(-0.48);
  let mwP = vec2f(c * mwUv.x - s * mwUv.y, s * mwUv.x + c * mwUv.y);
  let band = exp(-pow(mwP.y * 3.4, 2.0)) * smoothstep(1.15, 0.15, abs(mwP.x));
  let dust = fbm(mwP * vec2f(3.2, 8.0) + vec2f(u.seed, u.time * 0.015));
  col += vec3f(0.16, 0.18, 0.28) * band * (0.32 + dust * 0.5);

  // Very soft airglow — no discrete star points (those looked like a square grid)
  let air = fbm(uv * vec2f(3.5 * aspect, 2.8) + vec2f(u.time * 0.01, u.seed));
  col += vec3f(0.04, 0.05, 0.09) * air * 0.35;

  textureStore(outTex, vec2i(id.xy), vec4f(col, 1.0));
}
`;

  function sizeCanvas(canvas, Runtime) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Runtime.pixelRatio(1.5);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr };
  }

  function mount2d(canvas, Runtime, api) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      api.backend = 'none';
      return api;
    }
    api.backend = 'canvas2d';
    let raf = 0;
    const tick = (t) => {
      if (api._dead || Runtime.shouldPause()) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const { w, h } = sizeCanvas(canvas, Runtime);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a1020');
      g.addColorStop(0.55, '#070c18');
      g.addColorStop(1, '#04060e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w * 0.5, h * 0.42);
      ctx.rotate(-0.48);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.55);
      rg.addColorStop(0, 'rgba(180, 195, 230, 0.18)');
      rg.addColorStop(0.45, 'rgba(140, 155, 200, 0.08)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.scale(1.6, 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(w, h) * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // No discrete star dots here — FunHomeSky owns the catalog points.
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    api.destroy = () => {
      api._dead = true;
      cancelAnimationFrame(raf);
    };
    return api;
  }

  async function mountGpu(canvas, gpu, Runtime, api) {
    const device = gpu.device;
    const format = gpu.format;
    const context = canvas.getContext('webgpu');
    if (!context) return mount2d(canvas, Runtime, api);

    context.configure({ device, format, alphaMode: 'opaque' });
    const pipeline = Runtime.createComputePipeline(device, COMPUTE_WGSL, 'main');
    const blit = Runtime.createBlitPipeline(device, format);
    const uniformBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    let storage = null;
    let bindCompute = null;
    let bindBlit = null;
    let raf = 0;
    const t0 = performance.now();

    function ensureTargets(w, h) {
      if (storage && storage.width === w && storage.height === h) return;
      if (storage) storage.destroy();
      storage = Runtime.createStorageTexture(device, w, h);
      bindCompute = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: storage.createView() },
        ],
      });
      bindBlit = device.createBindGroup({
        layout: blit.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: storage.createView() },
          { binding: 1, resource: blit.sampler },
        ],
      });
    }

    const tick = () => {
      if (api._dead) return;
      if (Runtime.shouldPause()) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const { w, h } = sizeCanvas(canvas, Runtime);
      ensureTargets(w, h);
      const reduced = Runtime.prefersReducedMotion() ? 1 : 0;
      const time = (performance.now() - t0) / 1000;
      const floats = new Float32Array([time, w, h, reduced, 0.37, 0, 0, 0]);
      device.queue.writeBuffer(uniformBuf, 0, floats);

      const encoder = device.createCommandEncoder();
      const cpass = encoder.beginComputePass();
      cpass.setPipeline(pipeline);
      cpass.setBindGroup(0, bindCompute);
      Runtime.dispatch2d(cpass, w, h, 8, 8);
      cpass.end();

      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.02, g: 0.03, b: 0.06, a: 1 },
          },
        ],
      });
      rpass.setPipeline(blit.pipeline);
      rpass.setBindGroup(0, bindBlit);
      rpass.draw(3);
      rpass.end();
      device.queue.submit([encoder.finish()]);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    api.backend = 'webgpu';
    api.destroy = () => {
      api._dead = true;
      cancelAnimationFrame(raf);
      if (storage) storage.destroy();
      uniformBuf.destroy();
    };
    return api;
  }

  async function mount(opts) {
    const Runtime = root.WebGpuRuntime;
    const options = opts || {};
    const canvas =
      options.canvas ||
      (typeof document !== 'undefined' ? document.getElementById(options.canvasId || 'planSkyGpu') : null);
    const api = {
      backend: 'none',
      destroy() {},
      _dead: false,
    };
    if (!canvas || !Runtime) return api;

    const stage = canvas.closest('.plan-stage');
    if (stage) stage.classList.add('plan-stage--gpu');

    const offVis = Runtime.onVisibility(() => {});
    const prevDestroy = api.destroy;
    api.destroy = () => {
      offVis();
      prevDestroy();
    };

    try {
      const gpu = await Runtime.requestGpu();
      if (gpu && gpu.backend === 'webgpu' && gpu.device) {
        return mountGpu(canvas, gpu, Runtime, api);
      }
    } catch (_) {
      /* fall through */
    }
    return mount2d(canvas, Runtime, api);
  }

  root.WebGpuPlanetariumSky = { mount, COMPUTE_WGSL };
})(typeof globalThis !== 'undefined' ? globalThis : window);
