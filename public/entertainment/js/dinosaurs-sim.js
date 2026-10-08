/**
 * Mesozoic air — WebGPU compute particle simulation over the sky.
 * Tens of thousands of dust motes / pollen / embers advected by curl-noise wind,
 * era buoyancy, pointer gusts, and the 66 Ma impact shockwave.
 * Uses WebGpuRuntime; resolves null (no-op) without WebGPU or with reduced motion.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const COMMON_WGSL = `
struct Particle {
  pos: vec2f,
  vel: vec2f,
  life: f32,
  maxLife: f32,
  seed: f32,
  heat: f32,
};

struct U {
  time: f32,
  dt: f32,
  aspect: f32,
  count: f32,
  pointer: vec2f,
  pointerVel: vec2f,
  colorA: vec4f,
  colorB: vec4f,
  lift: f32,
  wind: f32,
  swirl: f32,
  mode: f32,
  impactT: f32,
  impactX: f32,
  impactY: f32,
  pxSize: f32,
  craterX: f32,
  craterY: f32,
  _p0: f32,
  _p1: f32,
};
`;

  const COMPUTE_WGSL = COMMON_WGSL + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> parts: array<Particle>;

fn hash11(n: f32) -> f32 {
  return fract(sin(n) * 43758.5453);
}

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(234.34, 435.345));
  q = q + dot(q, q + 34.23);
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

fn potential(p: vec2f) -> f32 {
  return noise(p) + 0.5 * noise(p * 2.13 + vec2f(7.3, 1.9));
}

fn curl(p: vec2f) -> vec2f {
  let e = 0.02;
  let dx = potential(p + vec2f(e, 0.0)) - potential(p - vec2f(e, 0.0));
  let dy = potential(p + vec2f(0.0, e)) - potential(p - vec2f(0.0, e));
  return vec2f(dy, -dx) / (2.0 * e);
}

fn respawn(i: u32, p: ptr<function, Particle>) {
  let s = (*p).seed * 91.7 + u.time * 13.1 + f32(i) * 0.0131;
  let r1 = hash11(s);
  let r2 = hash11(s + 1.7);
  let r3 = hash11(s + 3.1);
  let r4 = hash11(s + 5.3);
  var pos = vec2f(0.0);
  var vel = vec2f(0.0);
  var life = 6.0;
  var heat = 0.5;
  if (u.mode < 0.5) {
    pos = vec2f(select(r1 * u.aspect, -0.02, r4 < 0.7), r2 * 0.7);
    vel = vec2f(0.08, 0.0);
    life = 6.0 + r3 * 7.0;
    heat = r3;
  } else if (u.mode < 1.5) {
    pos = vec2f(r1 * u.aspect, 0.03 + r2 * 0.85);
    life = 5.0 + r3 * 6.0;
    heat = r3;
  } else {
    if (r4 < 0.38) {
      pos = vec2f(u.craterX + (r1 - 0.5) * 0.05, u.craterY + r2 * 0.02);
      vel = vec2f((r1 - 0.5) * 0.06 + 0.02, 0.12 + r3 * 0.14);
    } else {
      pos = vec2f(r1 * u.aspect, -0.04 + r2 * 0.14);
      vel = vec2f(0.0, 0.03 + r3 * 0.05);
    }
    life = 3.0 + r3 * 5.0;
    heat = 0.65 + 0.35 * r2;
  }
  (*p).pos = pos;
  (*p).vel = vel;
  (*p).life = life;
  (*p).maxLife = life;
  (*p).heat = heat;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(u.count)) { return; }
  var p = parts[i];
  let dt = u.dt;
  p.life = p.life - dt;

  let outX = p.pos.x < -0.12 || p.pos.x > u.aspect + 0.12;
  let outY = p.pos.y < -0.2 || p.pos.y > 1.2;
  if (p.life <= 0.0 || outX || outY) {
    respawn(i, &p);
    parts[i] = p;
    return;
  }

  let t = u.time;
  var acc = vec2f(0.0);
  acc = acc + curl(p.pos * 2.4 + vec2f(t * 0.05, -t * 0.03)) * u.swirl;

  let drift = select(select(vec2f(0.02, 0.0), vec2f(0.012, 0.004), u.mode < 1.5), vec2f(0.11, 0.004), u.mode < 0.5);
  acc = acc + (drift * u.wind - p.vel) * 0.8;
  acc.y = acc.y + u.lift * p.heat;

  let d = p.pos - u.pointer;
  let dist2 = dot(d, d);
  let fall = exp(-dist2 / 0.012);
  acc = acc + u.pointerVel * fall * 6.0 + normalize(d + vec2f(1e-5, 0.0)) * fall * 0.3;

  if (u.impactT > 1.5) {
    let e = u.impactT - 1.5;
    let rel = p.pos - vec2f(u.impactX, u.impactY);
    let rd = length(rel);
    let front = e * 0.55;
    let z = (rd - front) / 0.07;
    let band = exp(-z * z) * exp(-e * 0.55);
    acc = acc + normalize(rel + vec2f(1e-5, 0.0)) * band * 9.0 + vec2f(0.0, 0.6) * band;
    p.heat = min(1.0, p.heat + band * dt * 18.0);
  }

  p.vel = (p.vel + acc * dt) * exp(-0.35 * dt);
  p.pos = p.pos + p.vel * dt;
  p.heat = max(0.0, p.heat - dt * select(0.02, 0.09, u.mode > 1.5));
  parts[i] = p;
}
`;

  const RENDER_WGSL = COMMON_WGSL + `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> parts: array<Particle>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec4f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let c = corners[vi];
  let p = parts[ii];
  let lifeK = clamp(p.life / max(p.maxLife, 0.001), 0.0, 1.0);
  let fade = smoothstep(0.0, 0.15, lifeK) * (1.0 - smoothstep(0.85, 1.0, lifeK));
  let sizeK = 0.55 + fract(p.seed * 7.13) * 1.15;
  let speed = length(p.vel);
  var dir = vec2f(1.0, 0.0);
  if (speed > 0.0001) { dir = p.vel / speed; }
  let stretch = 1.0 + min(speed * 7.0, 3.5);
  let local = dir * c.x * stretch + vec2f(-dir.y, dir.x) * c.y;
  let world = p.pos + local * u.pxSize * sizeK;
  let ndc = vec2f(world.x / u.aspect * 2.0 - 1.0, world.y * 2.0 - 1.0);

  var a = fade * mix(u.colorA.a, u.colorB.a, p.heat);
  if (u.mode > 0.5 && u.mode < 1.5) {
    a = a * (0.35 + 0.65 * max(0.0, sin(u.time * 2.6 + p.seed * 40.0)));
  }
  let col = mix(u.colorA.rgb, u.colorB.rgb, p.heat);

  var out: VsOut;
  out.pos = vec4f(ndc, 0.0, 1.0);
  out.uv = c;
  out.col = vec4f(col * a, a);
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let k = 1.0 - smoothstep(0.0, 1.0, length(in.uv));
  return in.col * k * k;
}
`;

  /* mode: 0 dust · 1 pollen/fireflies · 2 embers */
  const ERA_SIM = {
    triassic: { mode: 0, colorA: '#e8b88a', alphaA: 0.32, colorB: '#ffdcaa', alphaB: 0.6, lift: 0.01, wind: 1, swirl: 0.05, px: 1.5 },
    jurassic: { mode: 1, colorA: '#bfe39a', alphaA: 0.2, colorB: '#f4ffb4', alphaB: 0.9, lift: 0, wind: 1, swirl: 0.035, px: 1.9 },
    cretaceous: { mode: 2, colorA: '#8a2c12', alphaA: 0.3, colorB: '#ffb85a', alphaB: 1, lift: 0.12, wind: 1, swirl: 0.08, px: 1.8 },
  };

  function hexToRgb01(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function particleCount() {
    const narrow = root.matchMedia && root.matchMedia('(max-width: 991.98px)').matches;
    return narrow ? 24576 : 65536;
  }

  async function mount(opts) {
    const Runtime = root.WebGpuRuntime;
    const canvas = opts && opts.canvas;
    if (!Runtime || !canvas || Runtime.prefersReducedMotion()) return null;

    const gpu = await Runtime.requestGpu();
    if (gpu.backend !== 'webgpu' || !gpu.device) return null;
    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;

    const device = gpu.device;
    const format = gpu.format;
    const COUNT = particleCount();

    let computePipe;
    let renderPipe;
    device.pushErrorScope('validation');
    try {
      computePipe = Runtime.createComputePipeline(device, COMPUTE_WGSL, 'main');
      const module = device.createShaderModule({ code: RENDER_WGSL });
      const blend = { srcFactor: 'one', dstFactor: 'one', operation: 'add' };
      renderPipe = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format, blend: { color: blend, alpha: blend } }] },
        primitive: { topology: 'triangle-list' },
      });
    } catch (err) {
      await device.popErrorScope();
      console.warn('Dinosaur sim: WebGPU pipeline failed', err);
      return null;
    }
    const pipeErr = await device.popErrorScope();
    if (pipeErr) {
      console.warn('Dinosaur sim: WebGPU pipeline invalid', pipeErr.message);
      return null;
    }

    const init = new Float32Array(COUNT * 8);
    for (let i = 0; i < COUNT; i += 1) {
      const o = i * 8;
      init[o] = Math.random() * 2;
      init[o + 1] = Math.random();
      init[o + 4] = Math.random() * 6;
      init[o + 5] = 6;
      init[o + 6] = Math.random();
      init[o + 7] = Math.random();
    }
    const partBuf = device.createBuffer({
      size: init.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(partBuf, 0, init);

    const uniformData = new Float32Array(28);
    const uniformBuf = device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const computeBg = device.createBindGroup({
      layout: computePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: partBuf } },
      ],
    });
    const renderBg = device.createBindGroup({
      layout: renderPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        { binding: 1, resource: { buffer: partBuf } },
      ],
    });

    function sizeCanvas() {
      const dpr = Runtime.pixelRatio(1.5);
      canvas.width = Math.max(1, Math.floor(root.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(root.innerHeight * dpr));
      ctx.configure({ device, format, alphaMode: 'premultiplied' });
    }
    try {
      sizeCanvas();
    } catch (err) {
      partBuf.destroy();
      uniformBuf.destroy();
      return null;
    }

    const params = { colorA: [0, 0, 0], colorB: [0, 0, 0], alphaA: 0, alphaB: 0, lift: 0, wind: 1, swirl: 0.05, px: 1.6 };
    const target = Object.assign({}, params);
    let mode = 2;
    let destroyed = false;
    let raf = 0;
    let last = 0;
    let time = 0;
    let impactAt = -1;
    let scroll = 0;
    const pointer = { x: -10, y: -10, vx: 0, vy: 0, lastT: 0 };

    function setEra(id, o) {
      const cfg = ERA_SIM[id];
      if (!cfg) return;
      mode = cfg.mode;
      target.colorA = hexToRgb01(cfg.colorA);
      target.colorB = hexToRgb01(cfg.colorB);
      target.alphaA = cfg.alphaA;
      target.alphaB = cfg.alphaB;
      target.lift = cfg.lift;
      target.wind = cfg.wind;
      target.swirl = cfg.swirl;
      target.px = cfg.px;
      if (o && o.instant) {
        Object.assign(params, target, { colorA: target.colorA.slice(), colorB: target.colorB.slice() });
      }
    }

    function blend(dt) {
      const k = 1 - Math.exp(-dt * 2.2);
      for (let i = 0; i < 3; i += 1) {
        params.colorA[i] += (target.colorA[i] - params.colorA[i]) * k;
        params.colorB[i] += (target.colorB[i] - params.colorB[i]) * k;
      }
      ['alphaA', 'alphaB', 'lift', 'wind', 'swirl', 'px'].forEach((key) => {
        params[key] += (target[key] - params[key]) * k;
      });
    }

    function onPointer(e) {
      const h = Math.max(1, root.innerHeight);
      const x = e.clientX / h;
      const y = 1 - e.clientY / h;
      const t = performance.now();
      const dt = pointer.lastT ? Math.max(0.008, (t - pointer.lastT) / 1000) : 0.016;
      if (pointer.lastT) {
        pointer.vx += ((x - pointer.x) / dt - pointer.vx) * 0.35;
        pointer.vy += ((y - pointer.y) / dt - pointer.vy) * 0.35;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.lastT = t;
    }
    function onScroll() {
      scroll = Math.min(2, root.scrollY / Math.max(1, root.innerHeight));
    }

    function frame(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause()) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      time += dt;
      blend(dt);
      pointer.vx *= Math.exp(-dt * 4);
      pointer.vy *= Math.exp(-dt * 4);

      const aspect = canvas.width / Math.max(1, canvas.height);
      const impactT = impactAt < 0 ? -1 : time - impactAt;
      if (impactT > 12) impactAt = -1;

      const d = uniformData;
      d[0] = time;
      d[1] = dt;
      d[2] = aspect;
      d[3] = COUNT;
      d[4] = pointer.x;
      d[5] = pointer.y;
      d[6] = Math.max(-3, Math.min(3, pointer.vx));
      d[7] = Math.max(-3, Math.min(3, pointer.vy));
      d[8] = params.colorA[0];
      d[9] = params.colorA[1];
      d[10] = params.colorA[2];
      d[11] = params.alphaA;
      d[12] = params.colorB[0];
      d[13] = params.colorB[1];
      d[14] = params.colorB[2];
      d[15] = params.alphaB;
      d[16] = params.lift;
      d[17] = params.wind;
      d[18] = params.swirl;
      d[19] = mode;
      d[20] = impactT;
      d[21] = aspect * 0.8;
      d[22] = 0.37 - scroll * 0.05;
      d[23] = params.px / Math.max(1, root.innerHeight);
      d[24] = aspect * 0.16;
      d[25] = 0.52 - scroll * 0.11;
      device.queue.writeBuffer(uniformBuf, 0, d);

      const encoder = device.createCommandEncoder();
      const cpass = encoder.beginComputePass();
      cpass.setPipeline(computePipe);
      cpass.setBindGroup(0, computeBg);
      cpass.dispatchWorkgroups(Math.ceil(COUNT / 256));
      cpass.end();

      const rpass = encoder.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      rpass.setPipeline(renderPipe);
      rpass.setBindGroup(0, renderBg);
      rpass.draw(6, COUNT);
      rpass.end();
      device.queue.submit([encoder.finish()]);
    }

    function dispose() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onPointer);
      root.removeEventListener('scroll', onScroll);
      root.removeEventListener('resize', sizeCanvas);
      partBuf.destroy();
      uniformBuf.destroy();
      try { ctx.unconfigure(); } catch (_) { /* ignore */ }
    }

    root.addEventListener('pointermove', onPointer, { passive: true });
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('resize', sizeCanvas, { passive: true });
    root.addEventListener('pagehide', dispose, { once: true });
    if (device.lost && typeof device.lost.then === 'function') {
      device.lost.then(() => {
        dispose();
        if (typeof (opts && opts.onLost) === 'function') opts.onLost();
      });
    }

    setEra((opts && opts.era) || 'cretaceous', { instant: true });
    raf = requestAnimationFrame(frame);

    return {
      backend: 'webgpu',
      count: COUNT,
      setEra,
      impact() {
        impactAt = time;
      },
      dispose,
    };
  }

  root.DinosaursSim = { mount, ERA_SIM, particleCount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
