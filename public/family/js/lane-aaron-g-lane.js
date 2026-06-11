/**
 * Development work by David Lane
 */
/**
 * Mojave pioneer chapter — Scientific Lane shell (map + timeline, no cinema reel).
 */
(function () {
  const DATA_URL = '/data/lane-aaron-g-lane.json';
  const STAR_PATH = 'M 0,-10 2.9,-3.1 10,-3.1 4.2,1.2 6.2,8.1 0,4 -6.2,8.1 -4.2,1.2 -10,-3.1 -2.9,-3.1 z';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function personLink(personId, name) {
    if (!personId) return esc(name);
    return `<a href="/family/genealogy.html?id=${encodeURIComponent(personId)}">${esc(name)}</a>`;
  }

  function renderHero(hero) {
    const el = document.getElementById('slHero');
    if (!el || !hero) return;
    el.innerHTML = `
      <p class="sl-kicker">${esc(hero.kicker)}</p>
      <h1 class="sl-title">${esc(hero.title)}</h1>
      <p class="sl-subtitle">${esc(hero.subtitle)}</p>
      <p class="sl-era">${esc(hero.era)}</p>
    `;
  }

  function renderKinship(kinship, hero) {
    const el = document.getElementById('slKinship');
    if (!el || !kinship) return;
    const steps = (kinship.steps || [])
      .map((step) => {
        const hi = step.highlight ? ' is-highlight' : '';
        return `<li class="${hi}">
          <span class="sl-step-rel">${esc(step.relation)}</span>
          <span class="sl-step-name">${personLink(step.personId, step.name)}</span>
          <span class="text-muted small">${esc(step.years || '')}</span>
        </li>`;
      })
      .join('');
    const portrait = hero?.portraitUrl
      ? `<figure class="sl-portrait sl-portrait--plate">
          <img src="${esc(hero.portraitUrl)}" alt="${esc(hero.title || 'Portrait')}" loading="lazy" width="640" height="360" />
          <figcaption>
            <span class="sl-plate-label">Exhibit portrait</span>
            ${esc(hero.portraitCaption || '')}
          </figcaption>
        </figure>`
      : '';
    el.innerHTML = `
      <h2 id="slKinshipTitle">How he fits the family</h2>
      <p>${esc(kinship.summary)}</p>
      ${portrait}
      <ul class="sl-kinship-steps">${steps}</ul>
    `;
  }

  function renderFamily(thread) {
    const el = document.getElementById('slFamily');
    if (!el || !thread) return;
    const entries = (thread.entries || [])
      .map(
        (e) => `<div class="sl-homer-entry">
          <div class="sl-homer-role">${esc(e.role)}</div>
          <div><strong>${personLink(e.personId, e.name)}</strong></div>
          <p class="small text-muted mb-0">${esc(e.note)}</p>
        </div>`
      )
      .join('');
    el.innerHTML = `
      <h2 id="slFamilyTitle">${esc(thread.title)}</h2>
      <p>${esc(thread.lede)}</p>
      ${entries}
      ${thread.caution ? `<p class="sl-caution">${esc(thread.caution)}</p>` : ''}
    `;
  }

  function renderEvidence(panels) {
    const el = document.getElementById('slEvidence');
    if (!el || !panels?.length) return;
    el.innerHTML = panels
      .map((p) => {
        const tierClass = p.tier === 'Evidence' ? 'sl-tier-badge--evidence' : 'sl-tier-badge--context';
        const links = (p.links || [])
          .map((l) => {
            const ext = l.external ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${esc(l.url)}"${ext}>${esc(l.label)}</a>`;
          })
          .join('');
        return `<section class="sl-panel">
          <span class="sl-tier-badge ${tierClass}">${esc(p.tier)}</span>
          <h2 class="h5 mb-2">${esc(p.label)}</h2>
          <p class="mb-1">${esc(p.body)}</p>
          <div class="sl-links">${links}</div>
        </section>`;
      })
      .join('');
  }

  let arcMap = null;
  let earthMarkers = new Map();
  let openInfoWindow = null;
  let mapAllBounds = null;
  let activeEventId = null;
  let placesData = null;

  function placeColor(item) {
    return item.kind === 'context' ? '#8eb4d9' : '#c4a574';
  }

  function googleMapsSearchUrl(item) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lng}`)}`;
  }

  function placeInfoHtml(item) {
    const people = (item.personIds || [])
      .map(
        (p) =>
          `<a href="/family/genealogy.html?id=${encodeURIComponent(p.id)}" style="margin-right:8px">${esc(p.name)}</a>`
      )
      .join('');
    return `
      <div style="min-width:220px;max-width:320px;color:#111">
        <strong>${esc(item.name)}</strong><br/>
        <small class="text-muted">${esc(item.years || '')}</small>
        <p class="small mt-1 mb-1">${esc(item.note || '')}</p>
        ${people ? `<div class="small"><strong>People:</strong> ${people}</div>` : ''}
      </div>`;
  }

  function setMapBadge(label) {
    const badge = document.getElementById('slArcMapBadge');
    if (!badge) return;
    badge.innerHTML = `<i class="bi bi-globe-americas" aria-hidden="true"></i> ${esc(label)}`;
  }

  function emphasizePlace(placeId, on) {
    const entry = earthMarkers.get(placeId);
    if (!entry) return;
    if (!on) {
      entry.marker.setIcon(entry.baseIcon);
      entry.marker.setZIndex(undefined);
      return;
    }
    entry.marker.setIcon({
      ...entry.baseIcon,
      scale: entry.baseIcon.scale * 1.5,
      strokeColor: '#ece8df',
      strokeWeight: 2.5
    });
    entry.marker.setZIndex(999);
  }

  function pulsePlace(placeId) {
    const entry = earthMarkers.get(placeId);
    if (!entry || !window.google?.maps?.Animation) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    entry.marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(() => entry.marker.setAnimation(null), 1400);
  }

  function focusEarthPlace(placeId) {
    const item = (placesData?.items || []).find((i) => i.id === placeId);
    const entry = earthMarkers.get(placeId);
    if (!entry || !arcMap || !item) return;
    earthMarkers.forEach((_, id) => emphasizePlace(id, id === placeId));
    arcMap.panTo(entry.marker.getPosition());
    if (arcMap.getZoom() < 8) arcMap.setZoom(8);
    if (openInfoWindow) openInfoWindow.close();
    entry.infoWindow.open(arcMap, entry.marker);
    openInfoWindow = entry.infoWindow;
    pulsePlace(placeId);
    setMapBadge(item.name);
  }

  function resetArcView() {
    activeEventId = null;
    document.querySelectorAll('#slTimeline .sl-timeline li').forEach((li) => li.classList.remove('is-active'));
    if (openInfoWindow) {
      openInfoWindow.close();
      openInfoWindow = null;
    }
    earthMarkers.forEach((_, id) => emphasizePlace(id, false));
    if (arcMap && mapAllBounds) {
      arcMap.fitBounds(mapAllBounds, { top: 40, right: 40, bottom: 40, left: 40 });
      google.maps.event.addListenerOnce(arcMap, 'idle', () => {
        if (arcMap.getZoom() > 7) arcMap.setZoom(7);
      });
    }
    setMapBadge('Earth — life arc');
  }

  function activateTimelineEvent(eventId, timeline) {
    const event = timeline.find((t) => t.id === eventId);
    if (!event) return;
    if (activeEventId === eventId) {
      resetArcView();
      return;
    }
    activeEventId = eventId;
    document.querySelectorAll('#slTimeline .sl-timeline li').forEach((li) => {
      li.classList.remove('is-related');
      li.classList.toggle('is-active', li.dataset.eventId === eventId);
    });
    if (event.placeId) focusEarthPlace(event.placeId);
  }

  function renderTimeline(timeline, places) {
    const el = document.getElementById('slTimeline');
    if (!el || !timeline?.length) return;
    placesData = places;
    const items = timeline
      .map((t) => {
        const interactive = !!t.placeId;
        const cls = interactive ? 'sl-timeline-item--interactive' : '';
        const attrs = interactive
          ? ` data-event-id="${esc(t.id)}" data-place-id="${esc(t.placeId)}" tabindex="0" role="button"`
          : '';
        const pin = interactive
          ? `<span class="sl-tl-pin" aria-hidden="true"><i class="bi bi-geo-alt"></i></span>`
          : '';
        return `<li class="${cls}"${attrs}>
          ${pin}
          <div class="sl-tl-year">${esc(t.year)}</div>
          <div class="sl-tl-title">${esc(t.title)}</div>
          <p class="sl-tl-body">${esc(t.body)}</p>
        </li>`;
      })
      .join('');
    el.innerHTML = `
      <h2 id="slTimelineTitle">Life arc</h2>
      <p class="sl-arc-lede">${esc(places?.lede || 'Select a moment on the right — the map flies to that stop.')}</p>
      <div class="sl-arc-grid">
        <div class="sl-arc-map-col">
          <div id="slArcMapBadge" class="sl-arc-map-badge sl-arc-map-badge--earth">
            <i class="bi bi-globe-americas" aria-hidden="true"></i> Earth — life arc
          </div>
          <div id="slArcMap" class="sl-arc-map" role="application" aria-label="Interactive map for Aaron G. Lane life arc"></div>
          <div id="slArcMapFallback" class="small text-muted" hidden></div>
        </div>
        <div class="sl-arc-timeline-col">
          <ul class="sl-timeline sl-timeline--interactive">${items}</ul>
          <p class="sl-arc-hint small mb-0"><i class="bi bi-hand-index-thumb" aria-hidden="true"></i> Click again to reset the full route.</p>
        </div>
      </div>
    `;
    el.querySelectorAll('.sl-timeline-item--interactive').forEach((li) => {
      li.addEventListener('click', () => activateTimelineEvent(li.dataset.eventId, timeline));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateTimelineEvent(li.dataset.eventId, timeline);
        }
      });
    });
    initArcMap(places);
  }

  async function initArcMap(places) {
    const mapEl = document.getElementById('slArcMap');
    const fallbackEl = document.getElementById('slArcMapFallback');
    if (!mapEl || !places?.items?.length) return;

    const loadFn = typeof window.laneFamilyLoadGoogleMaps === 'function' ? window.laneFamilyLoadGoogleMaps : null;
    const ok = loadFn ? await loadFn() : false;
    if (!ok) {
      mapEl.hidden = true;
      if (fallbackEl) {
        fallbackEl.hidden = false;
        const links = places.items
          .map(
            (i) =>
              `<a href="${esc(googleMapsSearchUrl(i))}" target="_blank" rel="noopener noreferrer">${esc(i.name)}</a>`
          )
          .join(' · ');
        fallbackEl.innerHTML = `${esc(
          window.__laneGoogleMapsUnavailableReason || 'Map unavailable.'
        )} Open places directly: ${links}`;
      }
      return;
    }

    arcMap = new google.maps.Map(mapEl, {
      center: { lat: 41.5, lng: -75.5 },
      zoom: 6,
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }]
    });

    const bounds = new google.maps.LatLngBounds();
    for (const item of places.items) {
      if (item.lat == null || item.lng == null) continue;
      const position = { lat: Number(item.lat), lng: Number(item.lng) };
      const baseIcon = {
        path: item.highlight ? STAR_PATH : google.maps.SymbolPath.CIRCLE,
        scale: item.highlight ? 1.4 : 7,
        fillColor: placeColor(item),
        fillOpacity: 0.95,
        strokeColor: '#0d1016',
        strokeWeight: 1.5
      };
      const marker = new google.maps.Marker({
        position,
        map: arcMap,
        title: item.name,
        icon: baseIcon
      });
      const infoWindow = new google.maps.InfoWindow({ content: placeInfoHtml(item) });
      marker.addListener('click', () => {
        earthMarkers.forEach((_, id) => emphasizePlace(id, id === item.id));
        if (openInfoWindow) openInfoWindow.close();
        infoWindow.open(arcMap, marker);
        openInfoWindow = infoWindow;
        activeEventId = null;
        document.querySelectorAll('#slTimeline .sl-timeline li').forEach((li) => {
          li.classList.remove('is-active');
          li.classList.toggle('is-related', li.dataset.placeId === item.id);
        });
        setMapBadge(item.name);
      });
      earthMarkers.set(item.id, { marker, infoWindow, baseIcon });
      bounds.extend(position);
    }
    mapAllBounds = bounds;
    arcMap.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    google.maps.event.addListenerOnce(arcMap, 'idle', () => {
      if (arcMap.getZoom() > 7) arcMap.setZoom(7);
    });
  }

  function renderRoutes(block) {
    const el = document.getElementById('slRoutes');
    if (!el || !block) return;
    const beats = (block.beats || []).map((b) => `<li>${esc(b)}</li>`).join('');
    const diagrams =
      block.diagramUrl || block.siteDiagramUrl
        ? `<div class="sl-route-diagrams">
            ${block.diagramUrl ? `<img src="${esc(block.diagramUrl)}" alt="Mojave corridor routes diagram" loading="lazy" />` : ''}
            ${block.siteDiagramUrl ? `<img src="${esc(block.siteDiagramUrl)}" alt="Lane's Crossing site diagram" loading="lazy" />` : ''}
          </div>`
        : '';
    el.innerHTML = `
      <h2 id="slRoutesTitle">${esc(block.title)}</h2>
      <ul class="mb-0">${beats}</ul>
      ${diagrams}
    `;
  }

  function renderPhotos(gallery) {
    const el = document.getElementById('slPhotos');
    if (!el || !gallery?.items?.length) return;
    const cards = gallery.items
      .map(
        (p) => `<figure class="sl-photo-card">
          <img src="${esc(p.url)}" alt="${esc(p.alt || p.caption)}" loading="lazy" />
          <figcaption>${esc(p.caption || '')}${p.credit ? `<br/><span class="text-muted">${esc(p.credit)}</span>` : ''}</figcaption>
        </figure>`
      )
      .join('');
    el.innerHTML = `
      <h2 id="slPhotosTitle">${esc(gallery.title)}</h2>
      ${gallery.lede ? `<p class="sl-arc-lede">${esc(gallery.lede)}</p>` : ''}
      <div class="sl-photo-grid">${cards}</div>
    `;
  }

  function renderCta(cta) {
    const el = document.getElementById('slCta');
    if (!el || !cta?.length) return;
    const buttons = cta
      .map(
        (c) => `<a class="sl-cta-btn" href="${esc(c.url)}"${/\.mp4$/i.test(c.url || '') ? ' target="_blank" rel="noopener"' : ''}>
          <i class="bi ${esc(c.icon || 'bi-link-45deg')}" aria-hidden="true"></i>
          ${esc(c.label)}
        </a>`
      )
      .join('');
    el.innerHTML = `
      <h2 id="slCtaTitle">Explore further</h2>
      <div class="sl-cta-grid">${buttons}</div>
    `;
  }

  async function init() {
    const errEl = document.getElementById('slError');
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load chapter data (${res.status})`);
      const data = await res.json();
      renderHero(data.hero);
      renderKinship(data.kinship, data.hero);
      renderFamily(data.familyThread);
      renderEvidence(data.evidence);
      renderTimeline(data.timeline, data.places);
      renderRoutes(data.routes);
      renderPhotos(data.photoGallery);
      renderCta(data.cta);
    } catch (e) {
      if (errEl) errEl.textContent = e.message || 'Could not load Mojave pioneer chapter.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
