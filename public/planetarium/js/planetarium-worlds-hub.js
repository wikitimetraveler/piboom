/**
 * Planet worlds hub — card grid from dossier index.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const GRID = document.getElementById('pwHubGrid');
  const LEDE = document.getElementById('pwHubLede');

  async function loadIndex() {
    const res = await fetch('/data/planetarium/worlds/index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Worlds index unavailable');
    return res.json();
  }

  async function loadDossier(id) {
    const res = await fetch('/data/planetarium/worlds/' + encodeURIComponent(id) + '.json', {
      cache: 'force-cache',
    });
    if (!res.ok) throw new Error('Missing dossier: ' + id);
    return res.json();
  }

  function bodyUrl(id) {
    const Sky = window.FunHomeSky;
    if (Sky && typeof Sky.buildWorldUrl === 'function') {
      return Sky.buildWorldUrl({ id });
    }
    return '/planetarium/worlds/body.html?id=' + encodeURIComponent(id);
  }

  async function render() {
    if (!GRID) return;
    try {
      const index = await loadIndex();
      if (LEDE && index.lede) LEDE.textContent = index.lede;
      const bodies = Array.isArray(index.bodies) ? index.bodies : [];
      const dossiers = await Promise.all(bodies.map((id) => loadDossier(id)));
      GRID.replaceChildren();
      dossiers.forEach((d) => {
        const a = document.createElement('a');
        a.className = 'pw-hub-card';
        a.href = bodyUrl(d.id);
        a.setAttribute('aria-label', 'Open ' + d.name + ' world page');
        a.innerHTML =
          '<img class="pw-hub-card__thumb" src="' +
          String(d.texture || '').replace(/"/g, '') +
          '" alt="" loading="lazy" width="512" height="512"/>' +
          '<span class="pw-hub-card__label">' +
          '<span class="pw-hub-card__kicker">' +
          (d.kicker || 'World') +
          '</span>' +
          (d.name || d.id) +
          '</span>';
        GRID.appendChild(a);
      });
    } catch (err) {
      GRID.textContent = 'Could not load planet worlds.';
      console.warn(err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
