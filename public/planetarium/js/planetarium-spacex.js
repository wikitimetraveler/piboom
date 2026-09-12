/**
 * SpaceX rockets + launch dates page.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const VEHICLE_CLASS = {
    'falcon-1': 'sx-vehicle--f1',
    'falcon-9': 'sx-vehicle--f9',
    'falcon-heavy': 'sx-vehicle--fh',
    starship: 'sx-vehicle--ss',
  };
  const ROCKET_SHOTS = {
    'falcon-1': '/planetarium/assets/spacex/falcon-1-liftoff.png',
    'falcon-9': '/planetarium/assets/spacex/falcon-9-liftoff.png',
    'falcon-heavy': '/planetarium/assets/spacex/falcon-heavy-liftoff.png',
    starship: '/planetarium/assets/spacex/starship-liftoff.png',
  };
  const ROCKET_FACTS = {
    'falcon-1': {
      height: '21.3 m',
      stages: '2',
      engines: 'Merlin 1C · Kestrel',
      youtubeId: 'dLQ2tZEH6G0',
      youtubeTitle: 'Falcon 1 Flight 4',
    },
    'falcon-9': {
      height: '70 m',
      stages: '2',
      engines: '9 × Merlin 1D · Merlin Vacuum',
      youtubeId: '1B6oiLNyKKI',
      youtubeTitle: 'Falcon 9 first landing',
    },
    'falcon-heavy': {
      height: '70 m',
      stages: '2 + side boosters',
      engines: '27 × Merlin 1D at liftoff',
      youtubeId: 'wbSwFU6tY1c',
      youtubeTitle: 'Falcon Heavy test flight',
    },
    starship: {
      height: '121 m stacked',
      stages: 'Super Heavy + Ship',
      engines: 'Raptor',
      youtubeId: 'hI9HQfCAw64',
      youtubeTitle: 'Starship Flight 5',
    },
  };

  const els = {
    status: document.getElementById('sxStatus'),
    stats: document.getElementById('sxStats'),
    grid: document.getElementById('sxRocketGrid'),
    count: document.getElementById('sxLaunchCount'),
    search: document.getElementById('sxSearch'),
    rocketChips: document.getElementById('sxRocketChips'),
    whenChips: document.getElementById('sxWhenChips'),
    year: document.getElementById('sxYear'),
    body: document.getElementById('sxLaunchBody'),
    credit: document.getElementById('sxCredit'),
  };

  let catalog = { rockets: [], launches: [] };
  const state = { rocket: '', q: '', when: 'all', year: '' };
  let rocketsBuilt = false;

  function parseParams(search) {
    const q = new URLSearchParams(String(search || location.search || '').replace(/^\?/, ''));
    const whenRaw = String(q.get('when') || 'all').toLowerCase();
    return {
      rocket: q.get('rocket') || '',
      q: q.get('q') || '',
      when: whenRaw === 'upcoming' || whenRaw === 'past' ? whenRaw : 'all',
      year: q.get('year') || '',
    };
  }

  function filterLaunches(launches, query, now) {
    const rocket = String(query.rocket || '').trim();
    const needle = String(query.q || '').trim().toLowerCase();
    const when = query.when === 'upcoming' || query.when === 'past' ? query.when : 'all';
    const year = String(query.year || '').trim();
    const stamp = now instanceof Date ? now.getTime() : Date.now();
    let rows = Array.isArray(launches) ? launches : [];
    if (rocket && rocket !== 'all') {
      rows = rows.filter((row) => row.rocketId === rocket);
    }
    if (/^\d{4}$/.test(year)) {
      rows = rows.filter((row) => String(row.net || '').startsWith(year));
    }
    if (when === 'upcoming') {
      rows = rows.filter((row) => Date.parse(row.net) >= stamp);
    } else if (when === 'past') {
      rows = rows.filter((row) => Date.parse(row.net) < stamp);
    }
    if (needle) {
      rows = rows.filter((row) => {
        const hay = [row.mission, row.rocket, row.variant, row.pad, row.location, row.status]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    return rows;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return { day: '—', time: '' };
    const day = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return { day: day, time: hh + ':' + mm + ' UTC' };
  }

  function outcomeClass(status) {
    const key = String(status || '').toLowerCase().replace(/\s+/g, '-');
    if (key === 'partial-failure') return 'sx-outcome--partial';
    if (key === 'success') return 'sx-outcome--success';
    if (key === 'failure') return 'sx-outcome--failure';
    if (key === 'go' || key === 'tbc' || key === 'tbd') return 'sx-outcome--' + key;
    return '';
  }

  function vehicleMarkup(id) {
    const cls = VEHICLE_CLASS[id] || 'sx-vehicle--f9';
    if (id === 'falcon-heavy') {
      return (
        '<span class="sx-vehicle ' +
        cls +
        '" aria-hidden="true">' +
        '<span class="sx-vehicle__core"></span>' +
        '<span class="sx-vehicle__core"></span>' +
        '<span class="sx-vehicle__core"></span>' +
        '<span class="sx-vehicle__flame"></span>' +
        '</span>'
      );
    }
    const fins =
      id === 'starship'
        ? '<span class="sx-vehicle__fin sx-vehicle__fin--l"></span><span class="sx-vehicle__fin sx-vehicle__fin--r"></span>'
        : '';
    return (
      '<span class="sx-vehicle ' +
      cls +
      '" aria-hidden="true">' +
      '<span class="sx-vehicle__core">' +
      fins +
      '</span>' +
      '<span class="sx-vehicle__flame"></span>' +
      '</span>'
    );
  }

  function writeUrl() {
    const next = new URLSearchParams();
    if (state.rocket) next.set('rocket', state.rocket);
    if (state.q) next.set('q', state.q);
    if (state.when && state.when !== 'all') next.set('when', state.when);
    if (state.year) next.set('year', state.year);
    const qs = next.toString();
    const url = qs ? location.pathname + '?' + qs : location.pathname;
    history.replaceState(null, '', url);
  }

  function chip(label, pressed, attrs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sx-chip';
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    Object.keys(attrs || {}).forEach((key) => btn.setAttribute(key, attrs[key]));
    btn.textContent = label;
    return btn;
  }

  function renderStats(summary) {
    if (!els.stats) return;
    const next = summary.nextLaunch;
    const nextLabel = next
      ? formatDate(next.net).day + ' · ' + next.mission
      : 'None scheduled in catalog';
    els.stats.innerHTML =
      '<div class="sx-stat"><span class="sx-stat__kicker">Vehicles</span><strong>' +
      summary.rocketCount +
      '</strong></div>' +
      '<div class="sx-stat"><span class="sx-stat__kicker">Tracked launches</span><strong>' +
      summary.launchCount.toLocaleString() +
      '</strong></div>' +
      '<div class="sx-stat"><span class="sx-stat__kicker">Past successes</span><strong>' +
      summary.successCount.toLocaleString() +
      '</strong></div>' +
      '<div class="sx-stat"><span class="sx-stat__kicker">Next launch</span><strong>' +
      escapeHtml(nextLabel) +
      '</strong></div>';
  }

  function rocketStats(id) {
    const rows = (catalog.launches || []).filter((row) => row.rocketId === id);
    const pads = [...new Set(rows.map((row) => row.pad).filter(Boolean))].slice(0, 3);
    return {
      success: rows.filter((row) => String(row.status || '') === 'Success').length,
      failure: rows.filter((row) => /fail/i.test(String(row.status || ''))).length,
      pads: pads,
    };
  }

  function youtubeUrl(id) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
  }

  function youtubeEmbed(id) {
    return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?rel=0';
  }

  function unmountYoutube(card) {
    const host = card && card.querySelector('[data-yt-host]');
    if (!host) return;
    host.replaceChildren();
  }

  function mountYoutube(card) {
    const host = card && card.querySelector('[data-yt-host]');
    const id = card && card.dataset.youtube;
    if (!host || !id || host.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    iframe.src = youtubeEmbed(id);
    iframe.title = card.dataset.youtubeTitle || 'SpaceX launch video';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    host.appendChild(iframe);
  }

  function setCardFlipped(card, on) {
    if (!card) return;
    card.classList.toggle('is-flipped', on);
    card.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) mountYoutube(card);
    else unmountYoutube(card);
  }

  function closeOtherCards(keep) {
    if (!els.grid) return;
    els.grid.querySelectorAll('.sx-card.is-flipped').forEach((card) => {
      if (card !== keep) setCardFlipped(card, false);
    });
  }

  function selectRocket(id) {
    state.rocket = state.rocket === id ? '' : id;
    writeUrl();
    render();
    syncPad(state.rocket);
  }

  function askCarlAbout(name) {
    const ask = window.PlanetariumAskCarl;
    if (typeof ask === 'function') {
      ask('Tell me about ' + name + ' and how SpaceX flies it.');
    }
  }

  function getCarlContext() {
    const now = new Date();
    const summary = catalog.summary || summarize(now);
    const next = summary.nextLaunch;
    const focus = catalog.rockets.find((row) => row.id === state.rocket) || null;
    return {
      surface: 'spacex',
      spacex: {
        focusRocket: focus ? focus.name : '',
        nextLaunch: next
          ? formatDate(next.net).day + ' · ' + next.mission + ' · ' + (next.variant || next.rocket)
          : '',
        launchCount: summary.launchCount,
        successCount: summary.successCount,
        vehicles: (catalog.rockets || []).map((row) => row.name + ' (' + row.launchCount + ')').join(', '),
      },
    };
  }

  function syncPad(id) {
    const pad = window.PlanetariumSpacexPad;
    if (pad && typeof pad.setVehicle === 'function') pad.setVehicle(id || '');
    const hangar = window.PlanetariumSpacexHangar;
    if (id && hangar && typeof hangar.cueRocket === 'function') hangar.cueRocket(id);
  }

  function renderRockets() {
    if (!els.grid) return;
    if (!rocketsBuilt) {
      els.grid.replaceChildren();
      catalog.rockets.forEach((rocket) => {
        const facts = ROCKET_FACTS[rocket.id] || {};
        const stats = rocketStats(rocket.id);
        const card = document.createElement('article');
        card.className = 'sx-card';
        card.dataset.rocket = rocket.id;
        card.tabIndex = 0;
        card.setAttribute('aria-expanded', 'false');
        card.setAttribute('aria-label', rocket.name + ' — flip for video and facts');
        if (facts.youtubeId) {
          card.dataset.youtube = facts.youtubeId;
          card.dataset.youtubeTitle = facts.youtubeTitle || rocket.name;
        }
        const maiden = rocket.maidenFlight
          ? (rocket.maidenLabel || 'First flight') + ' · ' + formatDate(rocket.maidenFlight + 'T12:00:00Z').day
          : 'First flight unknown';
        const milestone =
          Array.isArray(rocket.milestones) && rocket.milestones[0]
            ? rocket.milestones[0].label + ' · ' + formatDate(rocket.milestones[0].date + 'T12:00:00Z').day
            : '';
        const shot = ROCKET_SHOTS[rocket.id] || '';
        const ytHref = facts.youtubeId ? youtubeUrl(facts.youtubeId) : '';
        const wiki = rocket.wikiUrl
          ? '<a class="sx-card__wiki" href="' +
            escapeHtml(rocket.wikiUrl) +
            '" target="_blank" rel="noopener noreferrer">Wikipedia</a>'
          : '';
        card.innerHTML =
          '<div class="sx-card-inner">' +
          '<div class="sx-face sx-face--front">' +
          '<span class="sx-card__shot">' +
          vehicleMarkup(rocket.id) +
          (shot
            ? '<img class="sx-card__photo lane-lightbox-ignore" src="' +
              shot +
              '" alt="' +
              escapeHtml(rocket.name) +
              ' lifting off" width="768" height="1024" loading="lazy"/>'
            : '') +
          '<span class="sx-card__shot-shade"></span>' +
          (ytHref
            ? '<a class="sx-card__yt" href="' +
              ytHref +
              '" target="_blank" rel="noopener noreferrer">' +
              '<i class="bi bi-youtube" aria-hidden="true"></i> YouTube</a>'
            : '') +
          '</span>' +
          '<span class="sx-card__meta">' +
          '<span class="sx-badge sx-badge--' +
          escapeHtml(rocket.status) +
          '">' +
          escapeHtml(rocket.status) +
          '</span>' +
          '</span>' +
          '<h3>' +
          escapeHtml(rocket.name) +
          '</h3>' +
          '<p class="sx-card__date">' +
          escapeHtml(maiden) +
          (milestone ? '<br/>' + escapeHtml(milestone) : '') +
          '</p>' +
          '<p class="sx-card__desc">' +
          escapeHtml(rocket.description) +
          '</p>' +
          '<p class="sx-card__count">' +
          Number(rocket.launchCount || 0).toLocaleString() +
          ' launches in catalog</p>' +
          '<p class="sx-card__flip-hint">Flip for video + facts</p>' +
          '</div>' +
          '<div class="sx-face sx-face--back">' +
          '<div class="sx-card__video" data-yt-host></div>' +
          '<p class="sx-card__kicker">' +
          escapeHtml(facts.youtubeTitle || rocket.name) +
          '</p>' +
          '<dl class="sx-card__facts">' +
          '<div><dt>Height</dt><dd>' +
          escapeHtml(facts.height || '—') +
          '</dd></div>' +
          '<div><dt>Stages</dt><dd>' +
          escapeHtml(facts.stages || '—') +
          '</dd></div>' +
          '<div><dt>Engines</dt><dd>' +
          escapeHtml(facts.engines || '—') +
          '</dd></div>' +
          '<div><dt>Success / fail</dt><dd>' +
          stats.success.toLocaleString() +
          ' / ' +
          stats.failure.toLocaleString() +
          '</dd></div>' +
          (stats.pads.length
            ? '<div><dt>Pads</dt><dd>' + escapeHtml(stats.pads.join(' · ')) + '</dd></div>'
            : '') +
          '</dl>' +
          '<div class="sx-card__actions">' +
          '<button type="button" class="pw-btn pw-btn--primary" data-sx-pad>Put on pad</button>' +
          '<button type="button" class="pw-btn" data-sx-filter>Filter launches</button>' +
          '<button type="button" class="pw-btn" data-sx-carl>Ask Carl</button>' +
          (ytHref
            ? '<a class="pw-btn" href="' +
              ytHref +
              '" target="_blank" rel="noopener noreferrer">Open YouTube</a>'
            : '') +
          wiki +
          '<button type="button" class="pw-btn" data-sx-flip-back>Flip back</button>' +
          '</div>' +
          '</div>' +
          '</div>';
        els.grid.appendChild(card);
      });
      els.grid.addEventListener('click', (event) => {
        const card = event.target.closest('.sx-card');
        if (!card || !els.grid.contains(card)) return;
        if (event.target.closest('.sx-card__yt, .sx-card__wiki, a.pw-btn')) return;
        const padBtn = event.target.closest('[data-sx-pad]');
        if (padBtn) {
          event.preventDefault();
          event.stopPropagation();
          state.rocket = card.dataset.rocket || '';
          writeUrl();
          render();
          syncPad(state.rocket);
          return;
        }
        const filterBtn = event.target.closest('[data-sx-filter]');
        if (filterBtn) {
          event.preventDefault();
          event.stopPropagation();
          state.rocket = card.dataset.rocket || '';
          writeUrl();
          render();
          syncPad(state.rocket);
          document.getElementById('sxLaunches')?.scrollIntoView({ block: 'start' });
          return;
        }
        const carlBtn = event.target.closest('[data-sx-carl]');
        if (carlBtn) {
          event.preventDefault();
          event.stopPropagation();
          const name = card.querySelector('.sx-face--front h3');
          askCarlAbout(name ? name.textContent : 'this rocket');
          return;
        }
        const flipBack = event.target.closest('[data-sx-flip-back]');
        if (flipBack) {
          event.preventDefault();
          event.stopPropagation();
          setCardFlipped(card, false);
          return;
        }
        if (event.target.closest('.sx-face--back')) return;
        closeOtherCards(card);
        setCardFlipped(card, !card.classList.contains('is-flipped'));
      });
      els.grid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('a, button')) return;
        const card = event.target.closest('.sx-card');
        if (!card || event.target !== card) return;
        event.preventDefault();
        closeOtherCards(card);
        setCardFlipped(card, !card.classList.contains('is-flipped'));
      });
      rocketsBuilt = true;
    }
    els.grid.querySelectorAll('.sx-card').forEach((card) => {
      const on = card.dataset.rocket === state.rocket;
      card.classList.toggle('is-active', on);
    });
  }

  function renderChips() {
    if (els.rocketChips) {
      els.rocketChips.replaceChildren();
      els.rocketChips.appendChild(
        chip('All rockets', !state.rocket, { 'data-rocket': '' })
      );
      catalog.rockets.forEach((rocket) => {
        els.rocketChips.appendChild(
          chip(rocket.name, state.rocket === rocket.id, { 'data-rocket': rocket.id })
        );
      });
      els.rocketChips.querySelectorAll('[data-rocket]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.rocket = btn.getAttribute('data-rocket') || '';
          writeUrl();
          render();
          syncPad(state.rocket);
        });
      });
    }
    if (els.whenChips) {
      els.whenChips.replaceChildren();
      [
        ['all', 'All dates'],
        ['past', 'Past'],
        ['upcoming', 'Upcoming'],
      ].forEach(([value, label]) => {
        const btn = chip(label, state.when === value, { 'data-when': value });
        btn.addEventListener('click', () => {
          state.when = value;
          writeUrl();
          render();
        });
        els.whenChips.appendChild(btn);
      });
    }
    if (els.year) {
      const years = [
        ...new Set(
          catalog.launches
            .map((row) => String(row.net || '').slice(0, 4))
            .filter((year) => /^\d{4}$/.test(year))
        ),
      ];
      const current = els.year.value;
      els.year.innerHTML = '<option value="">All years</option>';
      years.forEach((year) => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        els.year.appendChild(opt);
      });
      els.year.value = years.includes(state.year) ? state.year : '';
      if (current && !state.year) els.year.value = '';
    }
  }

  function renderTable(rows) {
    if (!els.body) return;
    els.body.replaceChildren();
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5"><p class="sx-empty">No launches match those filters.</p></td>';
      els.body.appendChild(tr);
      return;
    }
    let lastYear = '';
    const frag = document.createDocumentFragment();
    rows.forEach((row) => {
      const year = String(row.net || '').slice(0, 4);
      const tr = document.createElement('tr');
      if (year && year !== lastYear) {
        tr.className = 'is-year-start';
        tr.id = 'year-' + year;
        lastYear = year;
      }
      const when = formatDate(row.net);
      const status = row.status || 'Unknown';
      tr.innerHTML =
        '<td class="sx-date">' +
        escapeHtml(when.day) +
        '<small>' +
        escapeHtml(when.time) +
        '</small></td>' +
        '<td>' +
        escapeHtml(row.mission) +
        (row.missionType
          ? '<small class="sx-date"><small>' + escapeHtml(row.missionType) + '</small></small>'
          : '') +
        '</td>' +
        '<td>' +
        escapeHtml(row.variant || row.rocket) +
        '</td>' +
        '<td>' +
        escapeHtml(row.pad || '—') +
        (row.location ? '<small class="sx-date"><small>' + escapeHtml(row.location) + '</small></small>' : '') +
        '</td>' +
        '<td><span class="sx-outcome ' +
        outcomeClass(status) +
        '">' +
        escapeHtml(status) +
        '</span></td>';
      frag.appendChild(tr);
    });
    els.body.appendChild(frag);
  }

  function summarize(now) {
    const stamp = now.getTime();
    const past = catalog.launches.filter((row) => Date.parse(row.net) < stamp);
    const upcoming = catalog.launches.filter((row) => Date.parse(row.net) >= stamp);
    return {
      rocketCount: catalog.rockets.length,
      launchCount: catalog.launches.length,
      successCount: past.filter((row) => row.status === 'Success').length,
      nextLaunch: upcoming[0] || null,
    };
  }

  function render() {
    const now = new Date();
    const rows = filterLaunches(catalog.launches, state, now);
    renderRockets();
    renderChips();
    renderTable(rows);
    if (els.count) {
      els.count.textContent = rows.length.toLocaleString() + ' shown';
    }
    if (els.search && els.search.value !== state.q) els.search.value = state.q;
    if (els.year) els.year.value = state.year;
  }

  async function loadCatalog() {
    try {
      const res = await fetch('/api/planetarium/spacex', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && Array.isArray(json.launches)) {
          return {
            rockets: json.rockets || [],
            launches: json.launches,
            sourceUrl: json.sourceUrl,
            credit: json.credit,
            fetchedAt: json.fetchedAt,
            summary: json.summary,
          };
        }
      }
    } catch (err) {
      console.warn(err);
    }
    const res = await fetch('/data/planetarium/spacex-catalog.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('SpaceX catalog unavailable');
    return res.json();
  }

  async function boot() {
    Object.assign(state, parseParams(location.search));
    try {
      catalog = await loadCatalog();
      if (els.credit && catalog.sourceUrl) els.credit.href = catalog.credit || catalog.sourceUrl;
      const summary = catalog.summary || summarize(new Date());
      renderStats(summary);
      const fetched = catalog.fetchedAt ? formatDate(catalog.fetchedAt).day : '';
      if (els.status) {
        els.status.textContent = fetched
          ? 'Catalog snapshot ' + fetched + ' · ' + catalog.launches.length.toLocaleString() + ' launches'
          : catalog.launches.length.toLocaleString() + ' launches loaded';
      }
      render();
    } catch (err) {
      if (els.status) els.status.textContent = 'Could not load the SpaceX launch catalog.';
      console.warn(err);
    }
  }

  if (els.search) {
    els.search.addEventListener('input', () => {
      state.q = els.search.value.trim();
      writeUrl();
      render();
    });
  }
  if (els.year) {
    els.year.addEventListener('change', () => {
      state.year = els.year.value;
      writeUrl();
      render();
    });
  }

  window.PlanetariumSpacex = { parseParams, filterLaunches, getCarlContext };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
