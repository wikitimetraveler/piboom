/**
 * Planetarium boot — load Three.js dome when possible; never block the page sky.
 * Development work by David Lane
 */
async function start() {
  try {
    await import('/planetarium/js/planetarium-gl.js?v=19');
  } catch (err) {
    console.warn('PlanetariumGL module failed to load', err);
  }
  if (window.Planetarium && typeof window.Planetarium.initPage === 'function') {
    window.Planetarium.initPage();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
