/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Search the Lane graph and step forward or back along the path between two people.
 */
(function () {
  const LIMIT = 25;
  const state = {
    query: '',
    offset: 0,
    total: 0,
    hits: [],
    start: null,
    end: null,
    via: 'kin',
    path: null,
    index: 0,
    timer: null
  };

  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function yearsOf(person) {
    if (!person) return '';
    const birth = person.birthYear || '';
    const death = person.deathYear || '';
    if (!birth && !death) return '';
    return `${birth || '?'}–${death || '?'}`;
  }

  function placeOf(person) {
    return person?.born || person?.deathPlace || '';
  }

  function codeOf(person) {
    return person?.genealogyCode?.label || '';
  }

  function stopPlay() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const play = $('lanePathPlay');
    if (play) {
      play.innerHTML = '<i class="bi-play-fill"></i> Play forward';
      play.setAttribute('aria-pressed', 'false');
    }
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.start) params.set('from', String(state.start.id));
    if (state.end) params.set('to', String(state.end.id));
    if (state.via && state.via !== 'kin') params.set('via', state.via);
    if (state.query) params.set('q', state.query);
    const next = params.toString();
    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  function personPayload(person) {
    if (!person) return null;
    return {
      id: person.id,
      name: person.name || 'Unknown',
      gender: person.gender || '',
      birthYear: person.birthYear ?? '',
      deathYear: person.deathYear ?? '',
      born: person.born || '',
      deathPlace: person.deathPlace || '',
      generation: person.generation ?? null,
      title: person.title || '',
      genealogyCode: person.genealogyCode
        ? {
            label: person.genealogyCode.label || '',
            section: person.genealogyCode.section || '',
            familyKey: person.genealogyCode.familyKey != null ? String(person.genealogyCode.familyKey) : ''
          }
        : null
    };
  }

  function renderSlot(which) {
    const person = which === 'start' ? state.start : state.end;
    const nameEl = $(which === 'start' ? 'lanePathStartName' : 'lanePathEndName');
    const metaEl = $(which === 'start' ? 'lanePathStartMeta' : 'lanePathEndMeta');
    const clearEl = $(which === 'start' ? 'lanePathClearStart' : 'lanePathClearEnd');
    const slot = $(which === 'start' ? 'lanePathStartSlot' : 'lanePathEndSlot');
    if (!person) {
      nameEl.textContent = 'Choose a person';
      metaEl.textContent = which === 'start' ? 'Use Start on a search result.' : 'Use End on a search result.';
      clearEl.hidden = true;
      slot.classList.remove('is-filled');
      return;
    }
    nameEl.textContent = person.name;
    const bits = [yearsOf(person), placeOf(person), codeOf(person)].filter(Boolean);
    metaEl.textContent = bits.join(' · ') || 'In the Lane graph';
    clearEl.hidden = false;
    slot.classList.add('is-filled');
  }

  function renderResults() {
    const host = $('lanePathResults');
    const status = $('lanePathSearchStatus');
    const more = $('lanePathMore');
    if (!state.query) {
      host.innerHTML = '';
      status.textContent = '';
      more.hidden = true;
      return;
    }
    if (!state.hits.length) {
      host.innerHTML = '';
      status.textContent = state.notice || 'No one matched that search.';
      more.hidden = true;
      return;
    }
    const shown = state.hits.length;
    status.textContent = state.total > shown
      ? `Showing ${shown} of ${state.total} matches, best first.`
      : `${state.total} match${state.total === 1 ? '' : 'es'}.`;
    more.hidden = shown >= state.total;
    host.innerHTML = state.hits.map((person) => {
      const meta = [yearsOf(person), placeOf(person), person.generation != null ? `Gen ${person.generation}` : '', codeOf(person)]
        .filter(Boolean)
        .join(' · ');
      const why = person.match && person.match.why ? `Matched ${person.match.why}` : '';
      const startOn = state.start && Number(state.start.id) === Number(person.id);
      const endOn = state.end && Number(state.end.id) === Number(person.id);
      return `
        <article class="lane-path-hit">
          <div class="lane-path-hit-main">
            <div class="lane-path-hit-name">${esc(person.name)}</div>
            <div class="small text-muted">${esc(meta)}</div>
            ${why ? `<div class="small">${esc(why)}</div>` : ''}
          </div>
          <div class="lane-path-actions">
            <button type="button" class="btn btn-sm ${startOn ? 'btn-primary' : 'btn-outline-primary'}" data-set-start="${esc(person.id)}">Start</button>
            <button type="button" class="btn btn-sm ${endOn ? 'btn-primary' : 'btn-outline-primary'}" data-set-end="${esc(person.id)}">End</button>
            <a class="btn btn-sm btn-outline-secondary" href="/family/genealogy.html?id=${encodeURIComponent(person.id)}">Profile</a>
          </div>
        </article>`;
    }).join('');
  }

  function hopCaption(nextIndex) {
    const path = state.path;
    if (!path || !path.steps || nextIndex < 0 || nextIndex >= path.steps.length) return '';
    const arriving = path.steps[nextIndex];
    if (!arriving || !arriving.step) return '';
    const leaving = path.steps[nextIndex - 1];
    return `${arriving.person.name} is the ${arriving.step.phrase} of ${leaving.person.name}.`;
  }

  function renderTracker() {
    const path = state.path;
    const headline = $('lanePathHeadline');
    const summary = $('lanePathSummary');
    const hinge = $('lanePathHinge');
    const count = $('lanePathStepCount');
    const rail = $('lanePathRail');
    const card = $('lanePathCard');
    const back = $('lanePathBack');
    const forward = $('lanePathForward');
    const play = $('lanePathPlay');
    const caption = $('lanePathHopCaption');

    if (!state.start || !state.end) {
      headline.textContent = 'Pick two people to see how the graph joins them.';
      summary.textContent = '';
      hinge.textContent = '';
      count.textContent = '';
      rail.innerHTML = '';
      card.innerHTML = '<p class="small text-muted mb-0">The current person on the path will appear here.</p>';
      back.disabled = true;
      forward.disabled = true;
      play.disabled = true;
      caption.textContent = '';
      return;
    }

    if (!path) {
      headline.textContent = 'Tracing the path…';
      summary.textContent = '';
      hinge.textContent = '';
      count.textContent = '';
      rail.innerHTML = '';
      back.disabled = true;
      forward.disabled = true;
      play.disabled = true;
      caption.textContent = '';
      return;
    }

    if (!path.found) {
      headline.textContent = path.summary || 'No path joins these two people through the selected links.';
      summary.textContent = '';
      hinge.textContent = '';
      count.textContent = '';
      rail.innerHTML = '';
      card.innerHTML = '<p class="mb-0">Try Blood only, or Include associations, if a marriage or a side note is the connection you want.</p>';
      back.disabled = true;
      forward.disabled = true;
      play.disabled = true;
      caption.textContent = '';
      return;
    }

    const steps = path.steps || [];
    const index = Math.max(0, Math.min(state.index, steps.length - 1));
    state.index = index;
    const current = steps[index];
    headline.textContent = path.headline || path.summary || 'Path found.';
    summary.textContent = path.headline && path.summary && path.summary !== path.headline ? path.summary : '';
    if (path.hinge && path.hinge.name) {
      const backN = path.ups ? `${path.ups} back` : '';
      const foreN = path.downs ? `${path.downs} forward` : '';
      const counts = [backN, foreN].filter(Boolean).join(', then ');
      hinge.textContent = counts
        ? `Shared ancestor on this path: ${path.hinge.name} (${counts}).`
        : `Shared ancestor on this path: ${path.hinge.name}.`;
    } else if (path.ups && !path.downs) {
      hinge.textContent = `${path.ups} generation${path.ups === 1 ? '' : 's'} back from the start.`;
    } else if (path.downs && !path.ups) {
      hinge.textContent = `${path.downs} generation${path.downs === 1 ? '' : 's'} forward from the start.`;
    } else {
      hinge.textContent = '';
    }
    count.textContent = steps.length ? `Person ${index + 1} of ${steps.length}` : '';

    rail.innerHTML = steps.map((step, stepIndex) => {
      const rel = step.step ? step.step.label : 'Start';
      const currentClass = stepIndex === index ? ' is-current' : '';
      const currentAttr = stepIndex === index ? ' aria-current="step"' : '';
      return `
        <button type="button" class="lane-path-stop${currentClass}" data-path-index="${stepIndex}"${currentAttr}>
          <span class="lane-path-stop-rel">${esc(rel)}</span>
          <span class="d-block">${esc(step.person.name)}</span>
          <span class="small text-muted">${esc(yearsOf(step.person))}</span>
        </button>`;
    }).join('');

    const meta = [yearsOf(current.person), placeOf(current.person), codeOf(current.person)].filter(Boolean).join(' · ');
    const arrived = current.step
      ? `<p class="mb-2">Reached by going <strong>${esc(current.step.direction)}</strong> — ${esc(current.person.name)} is the ${esc(current.step.phrase)} of ${esc(steps[index - 1].person.name)}.</p>`
      : '<p class="mb-2">This is the start of the path.</p>';
    card.innerHTML = `
      <p class="small text-uppercase text-muted mb-1">${index === 0 ? 'Start' : index === steps.length - 1 ? 'End' : 'Along the path'}</p>
      <h3>${esc(current.person.name)}</h3>
      <p class="mb-2">${esc(meta || 'Years and place are not recorded on this node.')}</p>
      ${arrived}
      <a href="/family/genealogy.html?id=${encodeURIComponent(current.person.id)}">Open profile</a>
    `;

    back.disabled = index <= 0;
    forward.disabled = index >= steps.length - 1;
    play.disabled = steps.length < 2;
    const nextCaption = index < steps.length - 1 ? `Forward: ${hopCaption(index + 1)}` : 'End of the path.';
    const prevCaption = index > 0 ? `Back: ${hopCaption(index)}` : '';
    caption.textContent = [prevCaption, nextCaption].filter(Boolean).join(' ');

    const currentStop = rail.querySelector('.is-current');
    if (currentStop) {
      const left = currentStop.offsetLeft - (rail.clientWidth - currentStop.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }

  async function loadPath() {
    stopPlay();
    renderSlot('start');
    renderSlot('end');
    renderResults();
    syncUrl();
    if (!state.start || !state.end) {
      state.path = null;
      state.index = 0;
      renderTracker();
      return;
    }
    state.path = null;
    renderTracker();
    const params = new URLSearchParams({
      from: String(state.start.id),
      to: String(state.end.id),
      via: state.via
    });
    try {
      const response = await fetch(`/api/genealogy/path?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || data.success === false) {
        state.path = {
          found: false,
          summary: data.error || 'The path could not be traced.'
        };
      } else {
        state.path = data;
        state.index = 0;
      }
    } catch (error) {
      state.path = { found: false, summary: error.message || 'The path request failed.' };
    }
    renderTracker();
  }

  function choose(which, person) {
    const picked = personPayload(person);
    if (!picked) return;
    if (which === 'start') state.start = picked;
    else state.end = picked;
    loadPath();
  }

  async function search(reset) {
    const input = $('lanePathQuery');
    const q = input ? input.value.trim() : '';
    state.query = q;
    if (reset) {
      state.offset = 0;
      state.hits = [];
      state.total = 0;
    }
    const status = $('lanePathSearchStatus');
    if (!q) {
      state.notice = '';
      renderResults();
      syncUrl();
      return;
    }
    status.textContent = 'Searching…';
    const params = new URLSearchParams({
      q,
      limit: String(LIMIT),
      offset: String(state.offset)
    });
    try {
      const response = await fetch(`/api/genealogy/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || data.success === false) {
        state.notice = data.error || 'Search failed.';
        if (reset) state.hits = [];
      } else {
        state.notice = data.notice || '';
        state.total = data.total || 0;
        const batch = Array.isArray(data.results) ? data.results : [];
        state.hits = reset ? batch : state.hits.concat(batch);
        state.offset = state.hits.length;
      }
    } catch (error) {
      state.notice = error.message || 'Search failed.';
      if (reset) state.hits = [];
    }
    renderResults();
    syncUrl();
  }

  async function loadPerson(id) {
    const numeric = parseInt(id, 10);
    if (!Number.isFinite(numeric)) return null;
    const response = await fetch(`/api/genealogy/${numeric}`);
    const data = await response.json();
    if (!response.ok || !data.success || !data.person) return null;
    return personPayload(data.person);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const via = params.get('via');
    if (via === 'blood' || via === 'all' || via === 'kin') {
      state.via = via;
      $('lanePathVia').value = via;
    }
    const q = params.get('q');
    if (q) $('lanePathQuery').value = q;

    $('lanePathSearchForm').addEventListener('submit', (event) => {
      event.preventDefault();
      search(true);
    });
    let debounce = null;
    $('lanePathQuery').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => search(true), 280);
    });
    $('lanePathMore').addEventListener('click', () => search(false));
    $('lanePathResults').addEventListener('click', (event) => {
      const startBtn = event.target.closest('[data-set-start]');
      const endBtn = event.target.closest('[data-set-end]');
      if (!startBtn && !endBtn) return;
      const id = Number((startBtn || endBtn).getAttribute(startBtn ? 'data-set-start' : 'data-set-end'));
      const person = state.hits.find((hit) => Number(hit.id) === id);
      if (person) choose(startBtn ? 'start' : 'end', person);
    });
    $('lanePathClearStart').addEventListener('click', () => {
      state.start = null;
      loadPath();
    });
    $('lanePathClearEnd').addEventListener('click', () => {
      state.end = null;
      loadPath();
    });
    $('lanePathSwap').addEventListener('click', () => {
      const hold = state.start;
      state.start = state.end;
      state.end = hold;
      loadPath();
    });
    $('lanePathVia').addEventListener('change', () => {
      state.via = $('lanePathVia').value;
      if (state.start && state.end) loadPath();
      else syncUrl();
    });
    $('lanePathBack').addEventListener('click', () => {
      stopPlay();
      if (state.index > 0) {
        state.index -= 1;
        renderTracker();
      }
    });
    $('lanePathForward').addEventListener('click', () => {
      stopPlay();
      const last = state.path && state.path.steps ? state.path.steps.length - 1 : 0;
      if (state.index < last) {
        state.index += 1;
        renderTracker();
      }
    });
    $('lanePathPlay').addEventListener('click', () => {
      if (state.timer) {
        stopPlay();
        return;
      }
      const play = $('lanePathPlay');
      play.innerHTML = '<i class="bi-pause-fill"></i> Pause';
      play.setAttribute('aria-pressed', 'true');
      state.timer = setInterval(() => {
        const last = state.path && state.path.steps ? state.path.steps.length - 1 : 0;
        if (state.index >= last) {
          stopPlay();
          return;
        }
        state.index += 1;
        renderTracker();
      }, 1600);
    });
    $('lanePathRail').addEventListener('click', (event) => {
      const stop = event.target.closest('[data-path-index]');
      if (!stop) return;
      stopPlay();
      state.index = parseInt(stop.getAttribute('data-path-index'), 10) || 0;
      renderTracker();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!state.path || !state.path.found) return;
      event.preventDefault();
      stopPlay();
      if (event.key === 'ArrowLeft' && state.index > 0) state.index -= 1;
      if (event.key === 'ArrowRight' && state.index < state.path.steps.length - 1) state.index += 1;
      renderTracker();
    });

    const fromId = params.get('from');
    const toId = params.get('to');
    try {
      if (fromId) state.start = await loadPerson(fromId);
      if (toId) state.end = await loadPerson(toId);
    } catch (error) {
      $('lanePathHeadline').textContent = error.message || 'Could not load one of the people in the link.';
    }
    if (q) await search(true);
    else {
      renderSlot('start');
      renderSlot('end');
    }
    if (state.start || state.end) await loadPath();
    else renderTracker();
  });
})();
