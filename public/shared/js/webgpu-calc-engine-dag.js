/**
 * WebGPU FHA Streamline DAG — paints createFHACalculatorConfig topology.
 * CPU calcMath remains the money source of truth; an i32 kernel verifies cents.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const MAX_NODES = 24;
  const MAX_EDGES = 24;

  function nodeLabel(id) {
    const tail = String(id || '').split('_').pop();
    return String(tail || id || '').toUpperCase();
  }

  function layoutFhaDag(groups = []) {
    const list = Array.isArray(groups) ? groups : [];
    const resultIds = new Set(list.map((g) => g.resultId).filter(Boolean));
    const allIds = new Set();
    const edges = [];
    list.forEach((g) => {
      if (g.resultId) allIds.add(g.resultId);
      (g.inputIds || []).forEach((id) => {
        if (!id) return;
        allIds.add(id);
        edges.push({ from: id, to: g.resultId, calculation: g.calculation || '' });
      });
    });

    const depth = new Map();
    function depthOf(id, stack) {
      if (depth.has(id)) return depth.get(id);
      if (stack.has(id)) return 0;
      const incoming = edges.filter((e) => e.to === id);
      if (!incoming.length) {
        depth.set(id, 0);
        return 0;
      }
      stack.add(id);
      const d = 1 + Math.max(...incoming.map((e) => depthOf(e.from, stack)));
      stack.delete(id);
      depth.set(id, d);
      return d;
    }
    allIds.forEach((id) => depthOf(id, new Set()));
    const maxDepth = Math.max(0, ...depth.values());
    const byDepth = new Map();
    [...allIds].sort().forEach((id) => {
      const d = depth.get(id) || 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(id);
    });

    const nodes = [];
    [...byDepth.keys()]
      .sort((a, b) => a - b)
      .forEach((d) => {
        const ids = byDepth.get(d) || [];
        ids.forEach((id, i) => {
          nodes.push({
            id,
            label: nodeLabel(id),
            x: (d + 0.5) / (maxDepth + 1),
            y: (i + 0.5) / Math.max(1, ids.length),
            depth: d,
            isResult: resultIds.has(id),
            heat: 0,
          });
        });
      });

    return { nodes, edges, maxDepth };
  }

  function evalIntegerCents(input) {
    const math = root.calcMath;
    if (!math || typeof math.fhaLoanAmountIntegerCents !== 'function') return null;
    return math.fhaLoanAmountIntegerCents(input || {});
  }

  const PAINT_WGSL = `
struct Uniforms {
  time: f32,
  nodeCount: f32,
  edgeCount: f32,
  width: f32,
  height: f32,
  reduced: f32,
  _p0: f32,
  _p1: f32,
};

struct Node {
  x: f32,
  y: f32,
  heat: f32,
  kind: f32,
};

struct Edge {
  ax: f32,
  ay: f32,
  bx: f32,
  by: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<storage, read> edges: array<Edge>;
@group(0) @binding(3) var outTex: texture_storage_2d<rgba8unorm, write>;

fn distSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 {
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
  var col = vec3f(0.05, 0.09, 0.14);
  let nCount = i32(u.nodeCount);
  let eCount = i32(u.edgeCount);

  for (var i = 0; i < 24; i++) {
    if (i >= eCount) { break; }
    let e = edges[i];
    let d = distSeg(uv, vec2f(e.ax, e.ay), vec2f(e.bx, e.by));
    let glow = exp(-(d * d) / 0.00018);
    col = col + vec3f(0.18, 0.42, 0.48) * glow * 0.55;
  }

  for (var i = 0; i < 24; i++) {
    if (i >= nCount) { break; }
    let n = nodes[i];
    let d = distance(uv, vec2f(n.x, n.y));
    let pulse = 1.0 + select(0.0, n.heat * 0.45, u.reduced < 0.5);
    let glowR = select(0.028, 0.038, n.kind > 0.5) * pulse;
    let g = exp(-(d * d) / (glowR * glowR));
    let base = select(vec3f(0.45, 0.62, 0.72), vec3f(0.22, 0.72, 0.78), n.kind > 0.5);
    let hot = vec3f(0.95, 0.78, 0.35);
    col = col + mix(base, hot, clamp(n.heat, 0.0, 1.0)) * g * (0.7 + n.heat * 0.9);
  }

  col = saturate(col);
  textureStore(outTex, vec2i(i32(id.x), i32(id.y)), vec4f(col, 1.0));
}
`;

  const INTEGER_KERNEL_WGSL = `
@group(0) @binding(0) var<storage, read> inn: array<i32>;
@group(0) @binding(1) var<storage, read_write> outv: array<i32>;

fn floor_dollar_cents(cents: i32) -> i32 {
  return (cents / 100) * 100;
}

fn round_half_up_mul_div(a: i32, b: i32, denom: i32) -> i32 {
  if (denom <= 0) { return 0; }
  let q = a / denom;
  let r = a % denom;
  let hi = q * b;
  let lo = (r * b + denom / 2) / denom;
  return hi + lo;
}

@compute @workgroup_size(1)
fn main() {
  let g7 = inn[0];
  let g8 = inn[1];
  let g9 = inn[2];
  let g12 = inn[3];
  let g13 = inn[4];
  let g14 = inn[5];
  let pctBps = inn[6];
  let g15 = g12 + g13 + g14;
  let g18 = g15;
  let g19 = g9;
  let g20 = g18 - g19;
  let g22 = g8;
  var g24 = g20;
  if (g22 < g24) { g24 = g22; }
  g24 = floor_dollar_cents(g24);
  let g28 = g24;
  let e29 = round_half_up_mul_div(g24, pctBps, 10000);
  let g29 = floor_dollar_cents(e29);
  let g30 = g28 + g29;
  var g33 = 0;
  if (g7 != 0) { g33 = round_half_up_mul_div(g24, 100, g7); }
  outv[0] = g15;
  outv[1] = g18;
  outv[2] = g19;
  outv[3] = g20;
  outv[4] = g22;
  outv[5] = g24;
  outv[6] = g28;
  outv[7] = e29;
  outv[8] = g29;
  outv[9] = g30;
  outv[10] = g33;
  outv[11] = 1;
}
`;

  function centsOutFromArray(arr) {
    return {
      g15: arr[0],
      g18: arr[1],
      g19: arr[2],
      g20: arr[3],
      g22: arr[4],
      g24: arr[5],
      g28: arr[6],
      e29: arr[7],
      g29: arr[8],
      g30: arr[9],
      g33Hundredths: arr[10],
    };
  }

  function packInputs(input, math) {
    const dtc = math && math.dollarsToCents ? math.dollarsToCents.bind(math) : (v) => Math.round(Number(v || 0) * 100);
    return new Int32Array([
      dtc(input.g7),
      dtc(input.g8),
      dtc(input.g9),
      dtc(input.g12),
      dtc(input.g13),
      dtc(input.g14),
      dtc(input.d29),
      0,
    ]);
  }

  function drawFallback(ctx, layout, w, h, reduced) {
    ctx.fillStyle = '#0c1722';
    ctx.fillRect(0, 0, w, h);
    const nodes = (layout && layout.nodes) || [];
    const edges = (layout && layout.edges) || [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    ctx.lineWidth = Math.max(1, w / 420);
    edges.forEach((e) => {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) return;
      ctx.strokeStyle = 'rgba(70, 160, 175, 0.45)';
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    });
    nodes.forEach((n) => {
      const x = n.x * w;
      const y = n.y * h;
      const heat = n.heat || 0;
      const r = (n.isResult ? 11 : 8) * (reduced ? 1 : 1 + heat * 0.35) * (w / 640);
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      const rgb = n.isResult ? [40, 190, 200] : [120, 160, 185];
      const hot = [240, 190, 80];
      const mix = (c, hch) => Math.round(c + (hch - c) * heat);
      grd.addColorStop(
        0,
        `rgba(${mix(rgb[0], hot[0])},${mix(rgb[1], hot[1])},${mix(rgb[2], hot[2])},0.95)`
      );
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(232, 244, 248, 0.92)';
      ctx.font = `${Math.max(10, Math.round(11 * (w / 700)))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x, y);
    });
  }

  async function mount(opts) {
    const Runtime = root.WebGpuRuntime;
    const canvas = opts && opts.canvas;
    if (!canvas) return null;

    let layout = opts.layout || { nodes: [], edges: [] };
    let backend = 'none';
    let disposeFn = () => {};
    let pulseImpl = () => {};
    let gpuKernel = null;

    const api = {
      backend: 'none',
      pulse(resultId) {
        pulseImpl(resultId);
      },
      setLayout(next) {
        layout = next || { nodes: [], edges: [] };
        if (api._setLayout) api._setLayout(layout);
      },
      async runIntegerKernel(input) {
        const cpu = evalIntegerCents(input);
        if (gpuKernel) {
          try {
            const gpu = await gpuKernel(input);
            return { source: 'gpu', cents: gpu, cpu };
          } catch (_) {
            /* CPU fallback */
          }
        }
        return { source: 'cpu', cents: cpu, cpu };
      },
      dispose() {
        disposeFn();
      },
    };

    const gpu = Runtime ? await Runtime.requestGpu() : { backend: 'webgl2' };
    if (gpu.backend === 'webgpu' && gpu.device) {
      try {
        const live = await mountGpu(canvas, gpu, Runtime, api, layout);
        if (live) {
          backend = 'webgpu';
          disposeFn = live.dispose;
          pulseImpl = live.pulse;
          api._setLayout = live.setLayout;
          gpuKernel = live.runIntegerKernel;
          api.backend = backend;
          return api;
        }
      } catch (_) {
        /* 2d fallback */
      }
    }

    const live = mount2d(canvas, Runtime, api, layout);
    disposeFn = live.dispose;
    pulseImpl = live.pulse;
    api._setLayout = live.setLayout;
    api.backend = 'webgl2';
    return api;
  }

  function decayHeat(nodes, dt, reduced) {
    const k = reduced ? 0.35 : 0.55;
    nodes.forEach((n) => {
      n.heat = Math.max(0, (n.heat || 0) - dt * k);
    });
  }

  function mount2d(canvas, Runtime, api, initialLayout) {
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement || canvas;
    let layout = initialLayout || { nodes: [], edges: [] };
    let raf = 0;
    let dead = false;
    let last = performance.now();

    function resize() {
      const dpr = Runtime ? Runtime.pixelRatio(2) : 1;
      const w = wrap.clientWidth || 640;
      const h = Math.max(240, wrap.clientHeight || 320);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    resize();

    function frame(now) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime && Runtime.shouldPause()) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const reduced = Runtime && Runtime.prefersReducedMotion();
      decayHeat(layout.nodes || [], dt, reduced);
      drawFallback(ctx, layout, canvas.width, canvas.height, reduced);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return {
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      },
      setLayout(next) {
        layout = next || { nodes: [], edges: [] };
      },
      pulse(resultId) {
        const node = (layout.nodes || []).find((n) => n.id === resultId);
        if (node) node.heat = 1;
      },
    };
  }

  async function mountGpu(canvas, gpu, Runtime, api, initialLayout) {
    const device = gpu.device;
    const format = gpu.format;
    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;
    ctx.configure({ device, format, alphaMode: 'opaque' });

    const paintPipe = Runtime.createComputePipeline(device, PAINT_WGSL, 'main');
    const intPipe = Runtime.createComputePipeline(device, INTEGER_KERNEL_WGSL, 'main');
    const blit = Runtime.createBlitPipeline(device, format);
    const uniformBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const nodeBuf = device.createBuffer({
      size: MAX_NODES * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const edgeBuf = device.createBuffer({
      size: MAX_EDGES * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const intInBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const intOutBuf = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const intReadBuf = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    let outTex = null;
    let texW = 0;
    let texH = 0;
    let layout = initialLayout || { nodes: [], edges: [] };
    let raf = 0;
    let dead = false;
    let last = performance.now();
    const wrap = canvas.parentElement || canvas;
    const uniformData = new Float32Array(8);
    const nodeData = new Float32Array(MAX_NODES * 4);
    const edgeData = new Float32Array(MAX_EDGES * 4);

    function resize() {
      const dpr = Runtime.pixelRatio(2);
      const w = Math.max(1, wrap.clientWidth || 640);
      const h = Math.max(240, wrap.clientHeight || 320);
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

    function writeGraph() {
      nodeData.fill(0);
      edgeData.fill(0);
      const nodes = layout.nodes || [];
      const byId = new Map(nodes.map((n) => [n.id, n]));
      nodes.slice(0, MAX_NODES).forEach((n, i) => {
        const o = i * 4;
        nodeData[o] = n.x;
        nodeData[o + 1] = n.y;
        nodeData[o + 2] = n.heat || 0;
        nodeData[o + 3] = n.isResult ? 1 : 0;
      });
      (layout.edges || []).slice(0, MAX_EDGES).forEach((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return;
        const o = i * 4;
        edgeData[o] = a.x;
        edgeData[o + 1] = a.y;
        edgeData[o + 2] = b.x;
        edgeData[o + 3] = b.y;
      });
      device.queue.writeBuffer(nodeBuf, 0, nodeData);
      device.queue.writeBuffer(edgeBuf, 0, edgeData);
    }
    writeGraph();

    function frame(now) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause()) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const reduced = Runtime.prefersReducedMotion();
      decayHeat(layout.nodes || [], dt, reduced);
      writeGraph();
      uniformData[0] = reduced ? 0 : now / 1000;
      uniformData[1] = Math.min(MAX_NODES, (layout.nodes || []).length);
      uniformData[2] = Math.min(MAX_EDGES, (layout.edges || []).length);
      uniformData[3] = texW;
      uniformData[4] = texH;
      uniformData[5] = reduced ? 1 : 0;
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const computeBg = device.createBindGroup({
        layout: paintPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: { buffer: nodeBuf } },
          { binding: 2, resource: { buffer: edgeBuf } },
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
      cpass.setPipeline(paintPipe);
      cpass.setBindGroup(0, computeBg);
      Runtime.dispatch2d(cpass, texW, texH, 8, 8);
      cpass.end();
      const view = ctx.getCurrentTexture().createView();
      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          { view, clearValue: { r: 0.05, g: 0.09, b: 0.14, a: 1 }, loadOp: 'clear', storeOp: 'store' },
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

    async function runIntegerKernel(input) {
      const math = root.calcMath;
      device.queue.writeBuffer(intInBuf, 0, packInputs(input, math));
      const bg = device.createBindGroup({
        layout: intPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: intInBuf } },
          { binding: 1, resource: { buffer: intOutBuf } },
        ],
      });
      const encoder = device.createCommandEncoder();
      const cpass = encoder.beginComputePass();
      cpass.setPipeline(intPipe);
      cpass.setBindGroup(0, bg);
      cpass.dispatchWorkgroups(1);
      cpass.end();
      encoder.copyBufferToBuffer(intOutBuf, 0, intReadBuf, 0, 48);
      device.queue.submit([encoder.finish()]);
      await intReadBuf.mapAsync(GPUMapMode.READ);
      const copy = Int32Array.from(new Int32Array(intReadBuf.getMappedRange()));
      intReadBuf.unmap();
      return centsOutFromArray(copy);
    }

    return {
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        if (outTex) outTex.destroy();
        uniformBuf.destroy();
        nodeBuf.destroy();
        edgeBuf.destroy();
        intInBuf.destroy();
        intOutBuf.destroy();
        intReadBuf.destroy();
      },
      setLayout(next) {
        layout = next || { nodes: [], edges: [] };
        writeGraph();
      },
      pulse(resultId) {
        const node = (layout.nodes || []).find((n) => n.id === resultId);
        if (node) node.heat = 1;
      },
      runIntegerKernel,
    };
  }

  root.WebGpuCalcEngineDag = {
    mount,
    layoutFhaDag,
    nodeLabel,
    evalIntegerCents,
    PAINT_WGSL,
    INTEGER_KERNEL_WGSL,
    MAX_NODES,
    MAX_EDGES,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
