/**
 * Open Lender Suite — WebGPU Blue Marble spinning with worldwide hazard pulses.
 * Uses shared WebGpuRuntime + WebGpuGlobe (same stack as the home NASA globe).
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  let globeApi = null;
  let mounting = false;

  function statusEl() {
    return document.getElementById('openSuiteGlobeStatus');
  }

  function setStatus(msg) {
    const el = statusEl();
    if (el) el.textContent = msg || '';
  }

  async function mount() {
    if (globeApi || mounting) return globeApi;
    const canvas = document.getElementById('openSuiteGlobe');
    const stage = document.getElementById('openSuiteGlobeStage');
    const Globe = global.WebGpuGlobe;
    const Runtime = global.WebGpuRuntime;
    if (!canvas || !Globe || !Runtime) {
      setStatus('WebGPU globe unavailable');
      return null;
    }
    mounting = true;
    setStatus('Igniting WebGPU globe…');
    try {
      const api = await Globe.mount({
        canvas,
        body: 'earth',
        spinRate: 0.32,
        autoFirms: true,
        includeLavaSeeds: true,
        markBodyClass: false,
        getNight: () => true,
        prefersReducedMotion:
          typeof Runtime.prefersReducedMotion === 'function'
            ? Runtime.prefersReducedMotion()
            : false,
      });
      if (!api) {
        setStatus('WebGPU not available — globe idle');
        if (stage) stage.classList.add('open-suite-globe-stage--fallback');
        mounting = false;
        return null;
      }
      globeApi = api;
      if (stage) stage.classList.add('open-suite-globe-stage--live');
      setStatus('Worldwide hazard pulse · WebGPU Blue Marble');
      mounting = false;
      return globeApi;
    } catch (err) {
      console.warn('Open suite WebGPU globe failed', err);
      setStatus('WebGPU globe failed to start');
      if (stage) stage.classList.add('open-suite-globe-stage--fallback');
      mounting = false;
      return null;
    }
  }

  function init() {
    void mount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.OpenSuiteGlobe = { mount, getApi: () => globeApi };
})(typeof window !== 'undefined' ? window : globalThis);
