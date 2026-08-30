/**
 * WebGPU knowledge constellation — visualizes server-returned RAG neighbors.
 * Does not embed or search; only paints citations the API already returned.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const STORE_COLORS = {
    ice: [0.15, 0.55, 0.85],
    encompass: [0.12, 0.55, 0.45],
    heygen: [0.75, 0.25, 0.85],
    gse: [0.1, 0.55, 0.5],
    other: [0.55, 0.6, 0.7],
  };

  function inferStore(row) {
    const blob = `${row.store || ''} ${row.sourceType || ''} ${row.category || ''} ${row.repo || ''} ${row.url || ''} ${row.title || ''}`.toLowerCase();
    if (/gse|umb|freddie|fannie|fhfa|pooling|arm/.test(blob)) return 'gse';
    if (/heygen|avatar|streaming/.test(blob)) return 'heygen';
    if (/encompass|ellie|elliemae|loan officer|custom.?field/.test(blob)) return 'encompass';
    if (/ice|imt-|developerconnect|nyse/.test(blob)) return 'ice';
    return 'other';
  }

  function normalizeNeighbors(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.slice(0, 48).map((row, i) => {
      const scoreRaw = row.score != null ? Number(row.score) : NaN;
      const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(1, scoreRaw > 1 ? scoreRaw / 100 : scoreRaw)) : 0.35;
      const store = inferStore(row);
      return {
        id: String(row.id || `N${i + 1}`),
        title: String(row.title || 'Untitled').slice(0, 120),
        score,
        store,
        category: String(row.category || ''),
        retrieval: String(row.retrieval || ''),
        url: row.url || '',
        excerpt: String(row.content || row.excerpt || '').slice(0, 200),
      };
    });
  }

  /** Deterministic layout in unit square (0–1) by store cloud + score. */
  function layoutNeighbors(neighbors) {
    const stores = ['ice', 'encompass', 'heygen', 'gse', 'other'];
    const centers = {
      ice: [0.22, 0.35],
      encompass: [0.45, 0.28],
      heygen: [0.72, 0.38],
      gse: [0.38, 0.68],
      other: [0.7, 0.72],
    };
    return neighbors.map((n, i) => {
      const c = centers[n.store] || centers.other;
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 0.06 + (1 - n.score) * 0.14 + (i % 5) * 0.01;
      return {
        ...n,
        x: Math.max(0.05, Math.min(0.95, c[0] + Math.cos(a) * r)),
        y: Math.max(0.08, Math.min(0.92, c[1] + Math.sin(a) * r * 0.85)),
        storeIndex: stores.indexOf(n.store),
      };
    });
  }

  const COMPUTE_WGSL = `
struct Uniforms {
  time: f32,
  count: f32,
  width: f32,
  height: f32,
  reduced: f32,
  _p0: f32,
  _p1: f32,
  _p2: f32,
};

struct Neighbor {
  x: f32,
  y: f32,
  score: f32,
  store: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> neighbors: array<Neighbor>;
@group(0) @binding(2) var outTex: texture_storage_2d<rgba8unorm, write>;

fn storeColor(s: f32) -> vec3f {
  let i = i32(s);
  if (i == 0) { return vec3f(0.15, 0.55, 0.95); }
  if (i == 1) { return vec3f(0.12, 0.62, 0.48); }
  if (i == 2) { return vec3f(0.82, 0.28, 0.9); }
  if (i == 3) { return vec3f(0.1, 0.6, 0.55); }
  return vec3f(0.55, 0.6, 0.7);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(u.width);
  let h = u32(u.height);
  if (id.x >= w || id.y >= h) { return; }
  let uv = (vec2f(f32(id.x), f32(id.y)) + 0.5) / vec2f(u.width, u.height);
  var col = vec3f(0.04, 0.06, 0.1);
  var alpha = 0.92;
  let nCount = i32(u.count);
  for (var i = 0; i < 48; i++) {
    if (i >= nCount) { break; }
    let n = neighbors[i];
    let d = distance(uv, vec2f(n.x, n.y));
    let glowR = 0.035 + n.score * 0.055;
    let pulse = 1.0 + select(0.0, sin(u.time * 2.2 + f32(i)) * 0.08 * n.score, u.reduced < 0.5);
    let g = exp(-(d * d) / (glowR * glowR * pulse * pulse));
    let c = storeColor(n.store);
    col = col + c * g * (0.55 + n.score * 0.9);
  }
  col = saturate(col);
  textureStore(outTex, vec2i(i32(id.x), i32(id.y)), vec4f(col, alpha));
}
`;

  function drawFallback(ctx, laidOut, w, h, time, reduced) {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);
    laidOut.forEach((n, i) => {
      const rgb = STORE_COLORS[n.store] || STORE_COLORS.other;
      const r = (10 + n.score * 18) * (reduced ? 1 : 1 + Math.sin(time * 2 + i) * 0.06);
      const x = n.x * w;
      const y = n.y * h;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      grd.addColorStop(0, `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},0.85)`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  async function mount(opts) {
    const Runtime = root.WebGpuRuntime;
    const canvas = opts && opts.canvas;
    if (!canvas) return null;

    let neighbors = [];
    let laidOut = [];
    let onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : null;
    let backend = 'none';
    let disposeFn = () => {};

    const api = {
      backend: 'none',
      setNeighbors(rows) {
        neighbors = normalizeNeighbors(rows);
        laidOut = layoutNeighbors(neighbors);
        if (api._setLaidOut) api._setLaidOut(laidOut);
      },
      dispose() {
        disposeFn();
      },
      getNeighbors() {
        return neighbors.slice();
      },
    };

    const gpu = Runtime ? await Runtime.requestGpu() : { backend: 'webgl2' };
    if (gpu.backend === 'webgpu' && gpu.device) {
      try {
        const live = await mountGpu(canvas, gpu, Runtime, api, opts);
        if (live) {
          backend = 'webgpu';
          disposeFn = live.dispose;
          api._setLaidOut = live.setLaidOut;
          api.backend = backend;
          wirePick(canvas, api, onSelect);
          return api;
        }
      } catch (_) {
        /* 2d fallback */
      }
    }

    const live = mount2d(canvas, Runtime, api, opts);
    disposeFn = live.dispose;
    api._setLaidOut = live.setLaidOut;
    api.backend = 'webgl2';
    wirePick(canvas, api, onSelect);
    return api;
  }

  function wirePick(canvas, api, onSelect) {
    canvas.style.cursor = 'pointer';
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      const laid = layoutNeighbors(api.getNeighbors());
      let best = null;
      let bestD = 0.06;
      laid.forEach((n) => {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      });
      if (best && onSelect) onSelect(best);
    });
  }

  function mount2d(canvas, Runtime, api, opts) {
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement || canvas;
    let laidOut = [];
    let raf = 0;
    let dead = false;
    const start = performance.now();

    function resize() {
      const dpr = Runtime ? Runtime.pixelRatio(2) : 1;
      const w = wrap.clientWidth || 640;
      const h = Math.max(220, wrap.clientHeight || 280);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    resize();

    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime && Runtime.shouldPause()) return;
      const t = (performance.now() - start) / 1000;
      drawFallback(ctx, laidOut, canvas.width, canvas.height, t, Runtime && Runtime.prefersReducedMotion());
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return {
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      },
      setLaidOut(next) {
        laidOut = next || [];
      },
    };
  }

  async function mountGpu(canvas, gpu, Runtime, api, opts) {
    const device = gpu.device;
    const format = gpu.format;
    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;
    ctx.configure({ device, format, alphaMode: 'opaque' });

    const computePipe = Runtime.createComputePipeline(device, COMPUTE_WGSL, 'main');
    const blit = Runtime.createBlitPipeline(device, format);
    const uniformBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const neighborBuf = device.createBuffer({
      size: 48 * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    let outTex = null;
    let texW = 0;
    let texH = 0;
    let laidOut = [];
    let raf = 0;
    let dead = false;
    const start = performance.now();
    const wrap = canvas.parentElement || canvas;
    const uniformData = new Float32Array(8);
    const neighborData = new Float32Array(48 * 4);

    function resize() {
      const dpr = Runtime.pixelRatio(2);
      const w = Math.max(1, wrap.clientWidth || 640);
      const h = Math.max(220, wrap.clientHeight || 280);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.configure({ device, format, alphaMode: 'opaque' });
      if (!outTex || texW !== canvas.width || texH !== canvas.height) {
        if (outTex) outTex.destroy();
        outTex = Runtime.createStorageTexture(device, canvas.width, canvas.height);
        texW = canvas.width;
        texH = canvas.height;
      }
    }
    resize();

    function writeNeighbors() {
      neighborData.fill(0);
      laidOut.forEach((n, i) => {
        const o = i * 4;
        neighborData[o] = n.x;
        neighborData[o + 1] = n.y;
        neighborData[o + 2] = n.score;
        neighborData[o + 3] = n.storeIndex >= 0 ? n.storeIndex : 4;
      });
      device.queue.writeBuffer(neighborBuf, 0, neighborData);
    }

    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause()) return;
      const reduced = Runtime.prefersReducedMotion();
      uniformData[0] = reduced ? 0 : (performance.now() - start) / 1000;
      uniformData[1] = laidOut.length;
      uniformData[2] = texW;
      uniformData[3] = texH;
      uniformData[4] = reduced ? 1 : 0;
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const computeBg = device.createBindGroup({
        layout: computePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: neighborBuf } },
          { binding: 2, resource: outTex.createView() },
        ],
      });
      const blitBg = device.createBindGroup({
        layout: blit.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: outTex.createView() },
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
          { view, clearValue: { r: 0.04, g: 0.06, b: 0.1, a: 1 }, loadOp: 'clear', storeOp: 'store' },
        ],
      });
      rpass.setPipeline(blit.pipeline);
      rpass.setBindGroup(0, blitBg);
      rpass.draw(3);
      rpass.end();
      device.queue.submit([encoder.finish()]);
    }

    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return {
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        if (outTex) outTex.destroy();
        uniformBuf.destroy();
        neighborBuf.destroy();
      },
      setLaidOut(next) {
        laidOut = next || [];
        writeNeighbors();
      },
    };
  }

  root.WebGpuKnowledgeConstellation = {
    mount,
    normalizeNeighbors,
    layoutNeighbors,
    inferStore,
    STORE_COLORS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
