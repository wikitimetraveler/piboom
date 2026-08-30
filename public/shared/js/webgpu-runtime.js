/**
 * Shared WebGPU runtime — detect, device, compute + blit helpers.
 * Falls back to webgl2/none when navigator.gpu is missing.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const BLIT_WGSL = `
struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VsOut;
  out.pos = vec4f(p[i], 0.0, 1.0);
  out.uv = p[i] * 0.5 + vec2f(0.5);
  return out;
}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSamp: sampler;

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  return textureSample(srcTex, srcSamp, vec2f(in.uv.x, 1.0 - in.uv.y));
}
`;

  function pixelRatio(max) {
    const cap = typeof max === 'number' && max > 0 ? max : 2;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    return Math.min(dpr, cap);
  }

  function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function shouldPause() {
    if (typeof document === 'undefined') return false;
    return Boolean(document.hidden);
  }

  function detectBackend(gpu) {
    const navGpu =
      gpu !== undefined
        ? gpu
        : typeof navigator !== 'undefined'
          ? navigator.gpu
          : undefined;
    if (navGpu) return 'webgpu';
    return 'webgl2';
  }

  let cachedGpu = null;

  async function requestGpu() {
    if (cachedGpu) return cachedGpu;
    const gpu = typeof navigator !== 'undefined' ? navigator.gpu : undefined;
    if (!gpu) return { backend: 'webgl2' };
    try {
      const adapter = await gpu.requestAdapter();
      if (!adapter) return { backend: 'webgl2' };
      const device = await adapter.requestDevice();
      if (!device) return { backend: 'webgl2' };
      const format =
        typeof gpu.getPreferredCanvasFormat === 'function'
          ? gpu.getPreferredCanvasFormat()
          : 'bgra8unorm';
      cachedGpu = { backend: 'webgpu', gpu, adapter, device, format };
      return cachedGpu;
    } catch (_) {
      return { backend: 'webgl2' };
    }
  }

  function createStorageTexture(device, width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    return device.createTexture({
      size: { width: w, height: h },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    });
  }

  function createComputePipeline(device, code, entryPoint) {
    const module = device.createShaderModule({ code });
    return device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: entryPoint || 'main' },
    });
  }

  function createBlitPipeline(device, format) {
    const module = device.createShaderModule({ code: BLIT_WGSL });
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: format || 'bgra8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
    return { pipeline, sampler };
  }

  function dispatch2d(pass, width, height, gx, gy) {
    const x = Math.ceil(width / (gx || 8));
    const y = Math.ceil(height / (gy || 8));
    pass.dispatchWorkgroups(Math.max(1, x), Math.max(1, y), 1);
  }

  function onVisibility(handler) {
    if (typeof document === 'undefined') return function () {};
    const fn = () => handler(shouldPause());
    document.addEventListener('visibilitychange', fn);
    return function () {
      document.removeEventListener('visibilitychange', fn);
    };
  }

  const WebGpuRuntime = {
    BLIT_WGSL,
    pixelRatio,
    prefersReducedMotion,
    shouldPause,
    detectBackend,
    requestGpu,
    createStorageTexture,
    createComputePipeline,
    createBlitPipeline,
    dispatch2d,
    onVisibility,
  };

  root.WebGpuRuntime = WebGpuRuntime;
})(typeof globalThis !== 'undefined' ? globalThis : window);
