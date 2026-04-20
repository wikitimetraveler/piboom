let directStory = null;
let descendantDraft = [];
const DESC_STORAGE_KEY = 'lane.direct.descendants.draft.v1';
const HISTORY_STATE_COPY = {
  loading: 'Loading history records...',
  empty: 'No Lane records available for this view.',
  unavailable: 'History records are unavailable right now.'
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

function loadDescendantDraft() {
  try {
    const raw = window.localStorage.getItem(DESC_STORAGE_KEY);
    descendantDraft = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(descendantDraft)) descendantDraft = [];
  } catch {
    descendantDraft = [];
  }
}

function persistDescendantDraft() {
  try {
    window.localStorage.setItem(DESC_STORAGE_KEY, JSON.stringify(descendantDraft));
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

function renderDescendantDraft() {
  const host = document.getElementById('descendantDraftList');
  if (!host) return;
  if (!descendantDraft.length) {
    host.innerHTML = `<div class="small text-muted">${HISTORY_STATE_COPY.empty}</div>`;
    return;
  }
  host.innerHTML = descendantDraft
    .map(
      (d, idx) => `
      <div class="desc-item">
        <div>
          <strong>${esc(d.name || 'Unknown')}</strong>
          <div class="desc-item-meta">${esc(d.birthYear || '?')} • ${esc(d.relation || 'relation not set')}</div>
        </div>
        <button class="btn btn-sm btn-outline-danger" data-remove-desc="${idx}">Remove</button>
      </div>`
    )
    .join('');
  host.querySelectorAll('[data-remove-desc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-remove-desc'), 10);
      if (!Number.isFinite(idx)) return;
      descendantDraft.splice(idx, 1);
      persistDescendantDraft();
      renderDescendantDraft();
    });
  });
}

function renderStory() {
  const host = document.getElementById('directTimeline');
  if (!host || !directStory) return;
  const entries = Array.isArray(directStory.line) ? directStory.line : [];
  host.innerHTML = entries
    .map((entry, idx) => {
      const occ = (entry.occupations || []).slice(0, 5);
      const wars = (entry.warLinks || []).slice(0, 3);
      const spouseNames = (entry.spouses || []).map((s) => s.name).filter(Boolean);
      const childNames = (entry.children || []).map((c) => c.name).filter(Boolean);
      const anchorId = `ancestor-step-${idx + 1}`;
      const quote = String(entry.narrative || '').split(/[.!?]/)[0].trim();
      return `
      <article class="direct-card ancestor-entry" id="${anchorId}">
        <div class="ancestor-head">
          <h2 class="h5 mb-0">${esc(entry.name || 'Unknown')}</h2>
          <span class="ancestor-years">${esc(entry.birthYear || '?')} - ${esc(entry.deathYear || '?')} • Step ${idx + 1}</span>
        </div>
        <div class="small text-muted mt-1">${esc(entry.born || 'Birthplace not recorded')}</div>
        <div class="ancestor-tags">
          ${occ.map((o) => `<span class="badge badge-secondary">${esc(o)}</span>`).join('')}
          ${wars.map((w) => `<span class="badge badge-warning">${esc(w.warLabel)} (${esc(w.confidence)})</span>`).join('')}
        </div>
        <div class="ancestor-line">${esc(entry.narrative || '')}</div>
        ${quote ? `<blockquote class="ancestor-quote mb-0">"${esc(quote)}."</blockquote>` : ''}
        <div class="family-context">
          <div><strong>Spouses:</strong> ${esc(spouseNames.join(', ') || 'None listed')}</div>
          <div><strong>Children:</strong> ${esc(childNames.join(', ') || 'None listed')}</div>
        </div>
      </article>`;
    })
    .join('');
}

function renderQuickNav() {
  const host = document.getElementById('directQuickNav');
  if (!host || !directStory) return;
  const entries = Array.isArray(directStory.line) ? directStory.line : [];
  if (!entries.length) {
    host.innerHTML = `<span class="small text-muted">${HISTORY_STATE_COPY.empty}</span>`;
    return;
  }
  const checkpoints = [];
  const first = entries[0];
  const middle = entries[Math.floor(entries.length / 2)];
  const latest = entries[entries.length - 1];
  checkpoints.push({ label: 'Origin', id: 'ancestor-step-1', name: first?.name || 'Origin' });
  if (middle && middle !== first && middle !== latest) {
    checkpoints.push({
      label: 'Middle era',
      id: `ancestor-step-${Math.floor(entries.length / 2) + 1}`,
      name: middle.name || 'Middle era'
    });
  }
  checkpoints.push({ label: 'Recent anchor', id: `ancestor-step-${entries.length}`, name: latest?.name || 'Recent anchor' });

  host.innerHTML = checkpoints
    .map((point) => `<a href="#${esc(point.id)}" class="direct-quick-link history-quick-link" title="${esc(point.name)}">${esc(point.label)}</a>`)
    .join('');
}

function renderMeta() {
  if (!directStory) return;
  const meta = document.getElementById('directMeta');
  if (!meta) return;
  const startName = directStory.startPerson?.name || 'Unknown';
  meta.textContent = `Anchor: ${startName} (id ${directStory.startId}) • ${directStory.generations} generations in direct line`;
}

async function boot() {
  directStory = await getJson('/api/genealogy/direct-line-story?startId=112&order=oldest-first');
  renderMeta();
  renderStory();
  renderQuickNav();
  if (typeof window.initHistoryQuickNav === 'function') {
    window.initHistoryQuickNav({ selector: '.history-quick-link[href^="#"]' });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const err = document.getElementById('directError');
    if (err) err.textContent = HISTORY_STATE_COPY.loading;
    loadDescendantDraft();
    await boot();
    if (err) err.textContent = '';
    renderDescendantDraft();
    const form = document.getElementById('descendantForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const nameInput = document.getElementById('descName');
        const yearInput = document.getElementById('descBirthYear');
        const relationInput = document.getElementById('descRelation');
        const name = String(nameInput?.value || '').trim();
        if (!name) return;
        const birthYear = String(yearInput?.value || '').trim();
        const relation = String(relationInput?.value || '').trim();
        descendantDraft.push({ name, birthYear, relation });
        persistDescendantDraft();
        renderDescendantDraft();
        form.reset();
      });
    }
    const clearBtn = document.getElementById('clearDescendantsBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        descendantDraft = [];
        persistDescendantDraft();
        renderDescendantDraft();
      });
    }
  } catch (error) {
    console.error(error);
    const err = document.getElementById('directError');
    if (err) err.textContent = `${HISTORY_STATE_COPY.unavailable} ${error.message}`;
  }
});
