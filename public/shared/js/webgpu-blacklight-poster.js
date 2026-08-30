/**
 * Sound-reactive black-light poster — same WebGPU compute path as the home globe.
 * Procedural by default; a GPT (or uploaded) image becomes the albedo the
 * compute shader paints — UV wash, fbm warp, night-city glow.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const COMPUTE_WGSL = `
struct Uniforms {
  time: f32,
  bass: f32,
  mids: f32,
  highs: f32,
  width: f32,
  height: f32,
  seed: f32,
  reduced: f32,
  mode: f32,
  _p0: f32,
  _p1: f32,
  _p2: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var posterTex: texture_2d<f32>;
@group(0) @binding(2) var posterSamp: sampler;
@group(0) @binding(3) var outTex: texture_storage_2d<rgba8unorm, write>;

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

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var v = 0.0;
  var a = 0.5;
  for (var i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07;
    a = a * 0.5;
  }
  return v;
}

fn proceduralInk(uv: vec2f, p: vec2f, seed: f32, t: f32, audio: f32, pulse: f32) -> vec3f {
  var q = p * (1.6 + seed * 0.8);
  q = q + vec2f(fbm(q + seed * 3.1), fbm(q + vec2f(2.1, seed))) * (0.45 + u.bass * 0.35);
  let flow = fbm(q * 2.2 + vec2f(t * 0.35 + seed, -t * 0.22));
  let rings = sin(length(p) * (14.0 + seed * 10.0) - t * 2.2 + audio * 5.0);
  let spiral = sin(atan2(p.y, p.x) * (3.0 + seed * 5.0) + length(p) * 16.0 - t * 1.6);
  let stars = step(0.972, hash21(floor(uv * (110.0 + seed * 50.0)) + seed * 7.0));

  let magenta = vec3f(1.0, 0.08, 0.85);
  let cyan = vec3f(0.05, 0.95, 1.0);
  let lime = vec3f(0.35, 1.0, 0.12);
  let orange = vec3f(1.0, 0.42, 0.05);

  var ink = mix(magenta, cyan, 0.5 + 0.5 * spiral);
  ink = mix(ink, lime, 0.25 + 0.35 * rings);
  ink = mix(ink, orange, flow * 0.4);
  ink = ink * (0.4 + 0.6 * flow);
  ink = ink + lime * stars * (1.1 + u.highs);
  ink = ink * pulse;

  let topBar = smoothstep(0.14, 0.09, uv.y) * smoothstep(0.03, 0.08, uv.y);
  let botBar = smoothstep(0.86, 0.91, uv.y) * smoothstep(0.97, 0.92, uv.y);
  let letter = step(0.55, hash21(floor(uv * vec2f(16.0, 36.0)) + seed * 11.0));
  ink = mix(ink, vec3f(0.03, 0.0, 0.08), (topBar + botBar) * 0.9);
  ink = ink + magenta * letter * topBar * 1.5;
  ink = ink + lime * letter * botBar * 1.3;
  return ink;
}

fn gpuizePhoto(uv: vec2f, p: vec2f, seed: f32, t: f32, audio: f32) -> vec3f {
  // Warp sample UVs like globe continent fbm so the GPT image is computed, not blitted.
  let warp = vec2f(
    fbm(p * 2.4 + vec2f(seed, t * 0.15)),
    fbm(p * 2.4 + vec2f(t * 0.12, seed + 1.7))
  );
  let suv = saturate(uv + (warp - 0.5) * (0.045 + u.bass * 0.06));
  var src = textureSampleLevel(posterTex, posterSamp, suv, 0.0).rgb;

  let luma = dot(src, vec3f(0.299, 0.587, 0.114));
  let sat = distance(src, vec3f(luma));
  let neon = saturate((sat - 0.06) * 2.6 + (max(src.r, max(src.g, src.b)) - luma) * 1.5);
  let room = mix(0.12, 0.28, u.mids);
  var col = src * room;
  let glow = vec3f(0.95, 0.15, 0.85) * src.r
    + vec3f(0.15, 0.95, 0.45) * src.g
    + vec3f(0.2, 0.55, 1.0) * src.b;
  col = col + glow * neon * (0.4 + u.bass * 1.15);
  col = col + src * (0.35 + audio * 0.55);
  return saturate(col);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(u.width);
  let h = u32(u.height);
  if (id.x >= w || id.y >= h) { return; }

  let uv = (vec2f(f32(id.x), f32(id.y)) + 0.5) / vec2f(u.width, u.height);
  var p = uv * 2.0 - 1.0;
  p.x = p.x * (u.width / max(u.height, 1.0));

  let seed = u.seed;
  let t = select(u.time * 0.28, 0.45, u.reduced > 0.5);
  let audio = u.bass * 0.55 + u.mids * 0.35 + u.highs * 0.28;
  let pulse = 0.55 + audio * 0.9;

  var col = vec3f(0.02, 0.0, 0.05);
  let frame = max(abs(p.x) * 0.72, abs(p.y) * 0.95);
  let inPoster = 1.0 - smoothstep(0.92, 1.05, frame);

  var ink = proceduralInk(uv, p, seed, t, audio, pulse);
  if (u.mode > 0.5) {
    ink = gpuizePhoto(uv, p, seed, t, audio);
  }

  let magenta = vec3f(1.0, 0.08, 0.85);
  let cyan = vec3f(0.05, 0.95, 1.0);
  let lime = vec3f(0.35, 1.0, 0.12);
  let flow = fbm(p * 2.2 + vec2f(t * 0.35 + seed, -t * 0.22));
  let glow = magenta * u.bass * 0.55 + cyan * u.mids * 0.4 + lime * u.highs * 0.35;
  ink = ink + glow * (0.22 + flow * 0.35);
  let flicker = 1.0 + sin(u.time * 26.0 + uv.y * 36.0) * u.highs * 0.16;
  ink = saturate(ink * flicker);

  col = mix(col, ink, inPoster);
  let rim = smoothstep(1.08, 0.88, frame) * (1.0 - inPoster);
  col = col + cyan * rim * (0.15 + audio * 0.25);

  textureStore(outTex, vec2i(i32(id.x), i32(id.y)), vec4f(col, 1.0));
}
`;

  function hashString(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  }

  function fftBands(data) {
    const arr = data || [];
    const n = arr.length || 1;
    const avg = (a, b) => {
      let s = 0;
      let c = 0;
      const end = Math.min(n - 1, b);
      for (let i = Math.max(0, a); i <= end; i += 1) {
        s += arr[i] || 0;
        c += 1;
      }
      return c ? s / (c * 255) : 0;
    };
    return {
      bass: avg(0, Math.max(2, Math.floor(n * 0.08))),
      mids: avg(Math.floor(n * 0.08), Math.floor(n * 0.35)),
      highs: avg(Math.floor(n * 0.35), n - 1),
    };
  }

  function createPlaceholderTex(device) {
    const tex = device.createTexture({
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: tex },
      new Uint8Array([20, 0, 40, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
    return tex;
  }

  function imageToTexture(device, img) {
    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const tex = device.createTexture({
      size: { width: w, height: h },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: img },
      { texture: tex },
      { width: w, height: h }
    );
    return tex;
  }

  async function mount(opts) {
    const Runtime = root.WebGpuRuntime;
    const canvas = opts && opts.canvas;
    if (!Runtime || !canvas) return null;

    const gpu = await Runtime.requestGpu();
    if (gpu.backend !== 'webgpu' || !gpu.device) return null;

    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;

    const device = gpu.device;
    const format = gpu.format;
    let destroyed = false;
    let raf = 0;
    let inView = true;
    let tex = null;
    let texW = 0;
    let texH = 0;
    const start = performance.now();
    const bands = { bass: 0.05, mids: 0.1, highs: 0.06 };
    let seed = hashString((opts && opts.seedKey) || 'Zed|Studio Console');
    let mode = 0;
    let posterTex = createPlaceholderTex(device);
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    const uniformData = new Float32Array(12);
    const uniformBuf = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    let computePipe;
    let blit;
    try {
      computePipe = Runtime.createComputePipeline(device, COMPUTE_WGSL, 'main');
      blit = Runtime.createBlitPipeline(device, format);
    } catch (_) {
      return null;
    }

    const stage = canvas.parentElement || canvas;

    function sizeCanvas() {
      const dpr = Runtime.pixelRatio(2);
      const w = Math.max(1, stage.clientWidth || canvas.clientWidth || 640);
      const h = Math.max(1, stage.clientHeight || canvas.clientHeight || 480);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      try {
        ctx.configure({ device, format, alphaMode: 'opaque' });
      } catch (_) {
        return false;
      }
      if (!tex || texW !== canvas.width || texH !== canvas.height) {
        if (tex) tex.destroy();
        tex = Runtime.createStorageTexture(device, canvas.width, canvas.height);
        texW = canvas.width;
        texH = canvas.height;
      }
      return true;
    }

    if (!sizeCanvas()) return null;

    function frame() {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause() || !inView) return;
      const reduced = Runtime.prefersReducedMotion();
      const t = reduced ? 0 : (performance.now() - start) / 1000;
      uniformData[0] = t;
      uniformData[1] = bands.bass;
      uniformData[2] = bands.mids;
      uniformData[3] = bands.highs;
      uniformData[4] = texW;
      uniformData[5] = texH;
      uniformData[6] = seed;
      uniformData[7] = reduced ? 1 : 0;
      uniformData[8] = mode;
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const computeBg = device.createBindGroup({
        layout: computePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: posterTex.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: tex.createView() },
        ],
      });
      const blitBg = device.createBindGroup({
        layout: blit.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: tex.createView() },
          { binding: 1, resource: blit.sampler },
        ],
      });

      const encoder = device.createCommandEncoder();
      const cpass = encoder.beginComputePass();
      cpass.setPipeline(computePipe);
      cpass.setBindGroup(0, computeBg);
      Runtime.dispatch2d(cpass, texW, texH, 8, 8);
      cpass.end();

      const view = ctx.getCurrentTexture().createView();
      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: 0.02, g: 0, b: 0.05, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      rpass.setPipeline(blit.pipeline);
      rpass.setBindGroup(0, blitBg);
      rpass.draw(3);
      rpass.end();
      device.queue.submit([encoder.finish()]);
    }

    const offVis = Runtime.onVisibility(function () {});
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(
        (entries) => {
          inView = entries.some((en) => en.isIntersecting);
        },
        { threshold: 0.05 }
      );
      io.observe(stage);
    }

    const onResize = () => {
      sizeCanvas();
    };
    window.addEventListener('resize', onResize);

    function dispose() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      offVis();
      if (io) io.disconnect();
      window.removeEventListener('resize', onResize);
      if (tex) tex.destroy();
      if (posterTex) posterTex.destroy();
      uniformBuf.destroy();
    }

    window.addEventListener('pagehide', dispose, { once: true });
    raf = requestAnimationFrame(frame);

    return {
      backend: 'webgpu',
      dispose,
      resize: sizeCanvas,
      setBands(next) {
        if (!next) return;
        bands.bass = Number(next.bass) || 0;
        bands.mids = Number(next.mids) || 0;
        bands.highs = Number(next.highs) || 0;
      },
      generateProcedural({ artist, album } = {}) {
        mode = 0;
        seed = hashString(`${artist || 'Zed'}|${album || 'Studio'}`);
        return seed;
      },
      setPosterImage(img) {
        if (!img) {
          mode = 0;
          return;
        }
        const next = imageToTexture(device, img);
        if (posterTex) posterTex.destroy();
        posterTex = next;
        mode = 1;
      },
    };
  }

  root.WebGpuBlacklightPoster = { mount, fftBands, hashString };
})(typeof globalThis !== 'undefined' ? globalThis : window);
