/**
 * Unified Disasters — WebGPU FIRMS heat field + near arcs over Leaflet,
 * plus a small pulse globe in the geo rail.
 * Clustering / PostGIS stay on the server; this only paints.
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  const COMPUTE_WGSL = `
struct Uniforms {
  time: f32,
  pointCount: f32,
  arcCount: f32,
  width: f32,
  height: f32,
  heatOn: f32,
  arcsOn: f32,
  reduced: f32,
};

struct Point {
  x: f32,
  y: f32,
  weight: f32,
  kind: f32,
};

struct Arc {
  x0: f32,
  y0: f32,
  x1: f32,
  y1: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> points: array<Point>;
@group(0) @binding(2) var<storage, read> arcs: array<Arc>;
@group(0) @binding(3) var outTex: texture_storage_2d<rgba8unorm, write>;

fn distToSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(u.width);
  let h = u32(u.height);
  if (id.x >= w || id.y >= h) { return; }
  let uv = (vec2f(f32(id.x), f32(id.y)) + 0.5) / vec2f(u.width, u.height);
  var col = vec3f(0.0);
  var alpha = 0.0;

  if (u.heatOn > 0.5) {
    let n = i32(u.pointCount);
    for (var i = 0; i < 200; i++) {
      if (i >= n) { break; }
      let p = points[i];
      if (p.kind > 0.5) { continue; }
      let d = distance(uv, vec2f(p.x, p.y));
      let r = 0.02 + p.weight * 0.028;
      let g = exp(-(d * d) / (r * r));
      let hot = mix(vec3f(1.0, 0.75, 0.15), vec3f(1.0, 0.2, 0.05), clamp(p.weight / 2.0, 0.0, 1.0));
      col = col + hot * g * (0.35 + p.weight * 0.25);
      alpha = max(alpha, g * 0.55);
    }
  }

  if (u.arcsOn > 0.5) {
    let n = i32(u.arcCount);
    for (var i = 0; i < 40; i++) {
      if (i >= n) { break; }
      let a = arcs[i];
      let d = distToSegment(uv, vec2f(a.x0, a.y0), vec2f(a.x1, a.y1));
      let g = exp(-(d * d) / 0.00018);
      col = col + vec3f(0.95, 0.7, 0.15) * g * 0.65;
      alpha = max(alpha, g * 0.5);
    }
  }

  textureStore(outTex, vec2i(i32(id.x), i32(id.y)), vec4f(saturate(col), saturate(alpha)));
}
`;

  function parseFirmsWeight(row) {
    const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
    const frp = Number(raw.frp ?? raw.FRP);
    const bright = Number(raw.brightness ?? raw.bright_ti4 ?? raw.bright_ti5);
    const frpOk = Number.isFinite(frp) ? frp : 0;
    const brightOk = Number.isFinite(bright) ? bright : 0;
    return Math.min(3, Math.max(0.15, Math.max(frpOk / 40, brightOk > 0 ? (brightOk - 280) / 80 : 0, 0.15)));
  }

  function toUv(map, lat, lng, width, height) {
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const pt = map.latLngToContainerPoint([lat, lng]);
    if (!pt) return null;
    return { x: pt.x / Math.max(1, width), y: pt.y / Math.max(1, height) };
  }

  async function mount(opts) {
    const Runtime = global.WebGpuRuntime;
    const map = opts && opts.map;
    const canvas = opts && opts.canvas;
    if (!map || !canvas || !Runtime) return null;

    const shared = {
      heatOn: Boolean(opts.heatOn),
      arcsOn: Boolean(opts.arcsOn),
      firmsRows: [],
      rays: [],
      seededAt: null,
    };

    const gpu = await Runtime.requestGpu();
    if (gpu.backend !== 'webgpu' || !gpu.device) {
      return mount2d(map, canvas, Runtime, shared);
    }

    const device = gpu.device;
    const format = gpu.format;
    const ctx = canvas.getContext('webgpu');
    if (!ctx) {
      return mount2d(map, canvas, Runtime, shared);
    }

    let computePipe;
    let blit;
    try {
      computePipe = Runtime.createComputePipeline(device, COMPUTE_WGSL, 'main');
      blit = Runtime.createBlitPipeline(device, format);
    } catch (_) {
      return mount2d(map, canvas, Runtime, shared);
    }

    ctx.configure({ device, format, alphaMode: 'premultiplied' });
    const uniformBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const pointBuf = device.createBuffer({
      size: 200 * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const arcBuf = device.createBuffer({
      size: 40 * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    let outTex = null;
    let texW = 0;
    let texH = 0;
    let raf = 0;
    let dead = false;
    const start = performance.now();
    const uniformData = new Float32Array(8);
    const pointData = new Float32Array(200 * 4);
    const arcData = new Float32Array(40 * 4);

    function resize() {
      const wrap = canvas.parentElement || canvas;
      const dpr = Runtime.pixelRatio(1.5);
      const w = Math.max(1, wrap.clientWidth || map.getSize().x);
      const h = Math.max(1, wrap.clientHeight || map.getSize().y);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.configure({ device, format, alphaMode: 'premultiplied' });
      if (!outTex || texW !== canvas.width || texH !== canvas.height) {
        if (outTex) outTex.destroy();
        outTex = Runtime.createStorageTexture(device, canvas.width, canvas.height);
        texW = canvas.width;
        texH = canvas.height;
      }
    }

    function project() {
      const size = map.getSize();
      const cssW = size.x;
      const cssH = size.y;
      pointData.fill(0);
      arcData.fill(0);
      let pi = 0;
      shared.firmsRows.slice(0, 200).forEach((r) => {
        const lat = Number(r.lat ?? r.latitude ?? r.avg_latitude);
        const lng = Number(r.lng ?? r.longitude ?? r.avg_longitude);
        const uv = toUv(map, lat, lng, cssW, cssH);
        if (!uv || uv.x < -0.05 || uv.x > 1.05 || uv.y < -0.05 || uv.y > 1.05) return;
        const o = pi * 4;
        pointData[o] = uv.x;
        pointData[o + 1] = uv.y;
        pointData[o + 2] = parseFirmsWeight(r);
        pointData[o + 3] = 0;
        pi += 1;
      });
      let ai = 0;
      shared.rays.slice(0, 40).forEach((r) => {
        const a = toUv(map, Number(r.from?.lat), Number(r.from?.lng), cssW, cssH);
        const b = toUv(map, Number(r.to?.lat), Number(r.to?.lng), cssW, cssH);
        if (!a || !b) return;
        const o = ai * 4;
        arcData[o] = a.x;
        arcData[o + 1] = a.y;
        arcData[o + 2] = b.x;
        arcData[o + 3] = b.y;
        ai += 1;
      });
      device.queue.writeBuffer(pointBuf, 0, pointData);
      device.queue.writeBuffer(arcBuf, 0, arcData);
      return { pointCount: pi, arcCount: ai };
    }

    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause()) return;
      if (!shared.heatOn && !shared.arcsOn) {
        const encoder = device.createCommandEncoder();
        const view = ctx.getCurrentTexture().createView();
        const rpass = encoder.beginRenderPass({
          colorAttachments: [
            { view, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
          ],
        });
        rpass.end();
        device.queue.submit([encoder.finish()]);
        return;
      }
      const counts = project();
      const reduced = Runtime.prefersReducedMotion();
      uniformData[0] = reduced ? 0 : (performance.now() - start) / 1000;
      uniformData[1] = counts.pointCount;
      uniformData[2] = counts.arcCount;
      uniformData[3] = texW;
      uniformData[4] = texH;
      uniformData[5] = shared.heatOn ? 1 : 0;
      uniformData[6] = shared.arcsOn ? 1 : 0;
      uniformData[7] = reduced ? 1 : 0;
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const computeBg = device.createBindGroup({
        layout: computePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: pointBuf } },
          { binding: 2, resource: { buffer: arcBuf } },
          { binding: 3, resource: outTex.createView() },
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
          { view, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
        ],
      });
      rpass.setPipeline(blit.pipeline);
      rpass.setBindGroup(0, blitBg);
      rpass.draw(3);
      rpass.end();
      device.queue.submit([encoder.finish()]);
    }

    resize();
    raf = requestAnimationFrame(frame);
    map.on('move zoom resize', resize);
    window.addEventListener('resize', resize);

    return {
      backend: 'webgpu',
      setFirmsRows(rows) {
        shared.firmsRows = (Array.isArray(rows) ? rows : []).filter(
          (r) => String(r.source || '').toLowerCase() === 'firms'
        );
      },
      setGraphNearRays(nearLinks, meta) {
        shared.rays = Array.isArray(nearLinks) ? nearLinks : [];
        shared.seededAt = meta?.seededAtMax || null;
      },
      setHeatVisible(on) {
        shared.heatOn = Boolean(on);
      },
      setArcsVisible(on) {
        shared.arcsOn = Boolean(on);
      },
      getSeededAt() {
        return shared.seededAt;
      },
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        map.off('move zoom resize', resize);
        window.removeEventListener('resize', resize);
        if (outTex) outTex.destroy();
        uniformBuf.destroy();
        pointBuf.destroy();
        arcBuf.destroy();
      },
    };
  }

  function mount2d(map, canvas, Runtime, shared) {
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let dead = false;

    function resize() {
      const wrap = canvas.parentElement || canvas;
      const dpr = Runtime.pixelRatio(1.5);
      const size = map.getSize();
      const w = wrap.clientWidth || size.x;
      const h = wrap.clientHeight || size.y;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause()) return;
      const st = shared;
      const size = map.getSize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sx = canvas.width / Math.max(1, size.x);
      const sy = canvas.height / Math.max(1, size.y);
      if (st.heatOn) {
        st.firmsRows.slice(0, 200).forEach((r) => {
          const lat = Number(r.lat ?? r.latitude);
          const lng = Number(r.lng ?? r.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const pt = map.latLngToContainerPoint([lat, lng]);
          const weight = parseFirmsWeight(r);
          const radius = (8 + weight * 14) * sx;
          const grd = ctx.createRadialGradient(pt.x * sx, pt.y * sy, 0, pt.x * sx, pt.y * sy, radius);
          grd.addColorStop(0, `rgba(255,${weight > 1 ? 80 : 160},20,0.45)`);
          grd.addColorStop(1, 'rgba(255,100,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(pt.x * sx, pt.y * sy, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      if (st.arcsOn) {
        ctx.strokeStyle = 'rgba(245, 180, 40, 0.55)';
        ctx.lineWidth = 2 * sx;
        ctx.setLineDash([6 * sx, 4 * sx]);
        st.rays.slice(0, 40).forEach((r) => {
          const a = map.latLngToContainerPoint([Number(r.from?.lat), Number(r.from?.lng)]);
          const b = map.latLngToContainerPoint([Number(r.to?.lat), Number(r.to?.lng)]);
          if (!a || !b) return;
          ctx.beginPath();
          ctx.moveTo(a.x * sx, a.y * sy);
          ctx.lineTo(b.x * sx, b.y * sy);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    }

    resize();
    raf = requestAnimationFrame(frame);
    map.on('move zoom resize', resize);
    return {
      backend: 'webgl2',
      setFirmsRows(rows) {
        shared.firmsRows = (Array.isArray(rows) ? rows : []).filter(
          (r) => String(r.source || '').toLowerCase() === 'firms'
        );
      },
      setGraphNearRays(nearLinks, meta) {
        shared.rays = Array.isArray(nearLinks) ? nearLinks : [];
        shared.seededAt = meta?.seededAtMax || null;
      },
      setHeatVisible(on) {
        shared.heatOn = Boolean(on);
      },
      setArcsVisible(on) {
        shared.arcsOn = Boolean(on);
      },
      getSeededAt() {
        return shared.seededAt || null;
      },
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        map.off('move zoom resize', resize);
      },
    };
  }

  /** Small rail globe: plot event pulses as dots on a 2D / WebGPU soft orb. */
  async function mountPulseGlobe(opts) {
    const canvas = opts && opts.canvas;
    const Runtime = global.WebGpuRuntime;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    let events = [];
    let raf = 0;
    let dead = false;
    const start = performance.now();

    function resize() {
      const dpr = Runtime ? Runtime.pixelRatio(2) : 1;
      const w = canvas.parentElement?.clientWidth || 200;
      const h = 180;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    function project(lat, lng, cx, cy, r) {
      const lon = ((lng + 180) % 360) - 180;
      const x = cx + (lon / 180) * r * 0.92;
      const y = cy - (lat / 90) * r * 0.72;
      return { x, y };
    }

    function frame() {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime && Runtime.shouldPause()) return;
      const t = (performance.now() - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.5;
      const cy = h * 0.52;
      const r = Math.min(w, h) * 0.36;
      const grd = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grd.addColorStop(0, '#4a90a4');
      grd.addColorStop(1, '#0e2030');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      events.slice(0, 80).forEach((ev, i) => {
        const p = project(ev.lat, ev.lng, cx, cy, r);
        const pulse = 1 + Math.sin(t * 3 + i) * 0.25 * (ev.strength || 0.5);
        ctx.fillStyle = ev.color || 'rgba(255,120,40,0.85)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * pulse * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return {
      setEvents(list) {
        events = Array.isArray(list) ? list : [];
      },
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      },
    };
  }

  global.DuWebGpuHeat = { mount, mountPulseGlobe, parseFirmsWeight };
})(typeof window !== 'undefined' ? window : globalThis);
