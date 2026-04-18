(function () {
  'use strict';

  const API_BASE = '/api/genealogy';

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseBirthYear(person) {
    const y = parseInt(person.birthYear, 10);
    return Number.isFinite(y) ? y : null;
  }

  function parseDeathYear(person) {
    const y = parseInt(person.deathYear, 10);
    return Number.isFinite(y) ? y : null;
  }

  function isBookOrOcrSource(person) {
    const im = person.importMeta;
    if (im && (im.source || im.parser)) return true;
    const refs = person.sourceRefs;
    return Array.isArray(refs) && refs.length > 0;
  }

  function sortByBirthYear(a, b) {
    const ay = parseBirthYear(a);
    const by = parseBirthYear(b);
    const aUnknown = ay === null;
    const bUnknown = by === null;
    if (aUnknown && bUnknown) return (a.name || '').localeCompare(b.name || '');
    if (aUnknown) return 1;
    if (bUnknown) return -1;
    if (ay !== by) return ay - by;
    return (a.name || '').localeCompare(b.name || '');
  }

  function centuryLabel(year) {
    const c = Math.floor(year / 100) * 100;
    return `${c}s`;
  }

  function decadeRange(year) {
    const start = Math.floor(year / 10) * 10;
    return { start, label: `${start}–${start + 9}` };
  }

  function groupByCenturyAndDecade(people) {
    const dated = [];
    const undated = [];
    for (const p of people) {
      const y = parseBirthYear(p);
      if (y === null) undated.push(p);
      else dated.push(p);
    }
    dated.sort(sortByBirthYear);

    /** @type {Map<string, Map<string, typeof people>>} */
    const byCentury = new Map();
    for (const p of dated) {
      const y = parseBirthYear(p);
      const cLabel = centuryLabel(y);
      const { label: dLabel } = decadeRange(y);
      if (!byCentury.has(cLabel)) byCentury.set(cLabel, new Map());
      const byDecade = byCentury.get(cLabel);
      if (!byDecade.has(dLabel)) byDecade.set(dLabel, []);
      byDecade.get(dLabel).push(p);
    }

    const centuries = Array.from(byCentury.keys()).sort((a, b) => {
      const ca = parseInt(a, 10);
      const cb = parseInt(b, 10);
      return ca - cb;
    });

    return { centuries, byCentury, undated };
  }

  function lineHtml(person) {
    const birthYear = parseBirthYear(person);
    const deathYear = parseDeathYear(person);
    const birth = birthYear === null ? 'b. ?' : `b. ${birthYear}`;
    const death = deathYear === null ? '' : ` · d. ${deathYear}`;
    return `
      <div class="memorial-line" role="button" tabindex="0" data-person-id="${esc(person.id)}">
        <span class="memorial-name">${esc(person.name || 'Unknown')}</span>
        <span class="memorial-birth"> — ${esc(birth + death)}</span>
      </div>`;
  }

  function centuryId(cLabel) {
    return `century-${String(cLabel).replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  function renderWall(people) {
    const host = document.getElementById('memorialWall');
    const { centuries, byCentury, undated } = groupByCenturyAndDecade(people);

    const parts = [];
    for (const cLabel of centuries) {
      const byDecade = byCentury.get(cLabel);
      const decadeKeys = Array.from(byDecade.keys()).sort((a, b) => {
        const sa = parseInt(a.split('–')[0], 10);
        const sb = parseInt(b.split('–')[0], 10);
        return sa - sb;
      });

      const cid = centuryId(cLabel);
      parts.push(`<section class="memorial-century" aria-labelledby="${esc(cid)}">`);
      parts.push(`<h2 class="memorial-century-label" id="${esc(cid)}">${esc(cLabel)}</h2>`);

      for (const dLabel of decadeKeys) {
        const rows = byDecade.get(dLabel) || [];
        parts.push('<div class="memorial-decade">');
        parts.push(`
          <div class="memorial-decade-header">
            <span class="memorial-decade-year">${esc(dLabel)}</span>
            <span class="memorial-decade-line" aria-hidden="true"></span>
            <span class="memorial-decade-count">${rows.length} names</span>
          </div>
          <div class="memorial-columns">${rows.map(lineHtml).join('')}</div>
        </div>`);
      }
      parts.push('</section>');
    }

    if (undated.length) {
      undated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      parts.push(`
        <section class="memorial-undated" aria-labelledby="undated-heading">
          <h3 id="undated-heading">Undated</h3>
          <p class="small text-muted mb-2">Birth year unknown or not parsed.</p>
          <div class="memorial-columns">${undated.map(lineHtml).join('')}</div>
        </section>
      `);
    }

    host.innerHTML = parts.join('');
  }

  async function openModal(personId) {
    const titleEl = document.getElementById('memorialModalTitle');
    const bodyEl = document.getElementById('memorialModalBody');
    titleEl.textContent = 'Loading…';
    bodyEl.innerHTML = '<p class="text-muted mb-0">Fetching profile…</p>';
    $('#memorialModal').modal('show');

    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(personId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.person) {
        titleEl.textContent = 'Not found';
        bodyEl.innerHTML = `<p class="text-warning mb-0">${esc(data.error || 'Person not found.')}</p>`;
        return;
      }

      const p = data.person;
      titleEl.textContent = p.name || 'Profile';
      const places = [p.birthPlace, p.deathPlace, p.born, p.died].filter(Boolean);
      const placeLine = places.length ? `<p><strong>Places:</strong> ${esc(places.join(' · '))}</p>` : '';
      const text = p.text ? `<p class="small" style="white-space: pre-wrap;">${esc(p.text)}</p>` : '';
      const im = p.importMeta;
      const metaSnippet =
        im && typeof im === 'object'
          ? `<p class="small text-muted mb-1"><strong>importMeta:</strong> ${esc(JSON.stringify(im).slice(0, 400))}${JSON.stringify(im).length > 400 ? '…' : ''}</p>`
          : '';

      bodyEl.innerHTML = `
        <dl class="row mb-0">
          <dt class="col-sm-3">Birth</dt><dd class="col-sm-9">${esc(p.birthYear ?? '—')}</dd>
          <dt class="col-sm-3">Death</dt><dd class="col-sm-9">${esc(p.deathYear ?? '—')}</dd>
        </dl>
        ${placeLine}
        ${text}
        ${metaSnippet}
        <p class="mb-0 mt-2"><a href="/family/genealogy.html" class="text-info">Open family tree</a></p>
      `;
    } catch (e) {
      titleEl.textContent = 'Error';
      bodyEl.innerHTML = `<p class="text-danger mb-0">${esc(e.message || String(e))}</p>`;
    }
  }

  function wireClicks() {
    const wall = document.getElementById('memorialWall');
    wall.addEventListener('click', (ev) => {
      const line = ev.target.closest('.memorial-line[data-person-id]');
      if (!line) return;
      openModal(line.dataset.personId);
    });
    wall.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const line = ev.target.closest('.memorial-line[data-person-id]');
      if (!line) return;
      ev.preventDefault();
      openModal(line.dataset.personId);
    });
  }

  async function load() {
    const errBox = document.getElementById('memorialError');
    const stat = document.getElementById('memorialStat');
    errBox.classList.add('d-none');

    try {
      const res = await fetch(`${API_BASE}/people`);
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.people)) {
        throw new Error(data.error || 'Failed to load people');
      }

      let people = data.people;
      const bookOnly = document.getElementById('bookOnly').checked;
      if (bookOnly) {
        people = people.filter(isBookOrOcrSource);
      }

      stat.textContent = `${people.length} shown${bookOnly ? ' (filtered)' : ''} · ${data.count} total in tree`;

      renderWall(people);
    } catch (e) {
      errBox.textContent = e.message || String(e);
      errBox.classList.remove('d-none');
      document.getElementById('memorialWall').innerHTML = '';
      stat.textContent = '';
    }
  }

  document.getElementById('bookOnly').addEventListener('change', load);
  wireClicks();
  load();
})();
