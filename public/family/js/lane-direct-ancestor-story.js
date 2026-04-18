let directStory = null;
let descendantDraft = [];
const DESC_STORAGE_KEY = 'lane.direct.descendants.draft.v1';

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
    host.innerHTML = '<div class="small text-muted">No draft descendants added yet.</div>';
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
  const lineOnly = document.getElementById('lineOnlyToggle')?.checked !== false;
  const entries = Array.isArray(directStory.line) ? directStory.line : [];
  host.innerHTML = entries
    .map((entry, idx) => {
      const occ = (entry.occupations || []).slice(0, 5);
      const wars = (entry.warLinks || []).slice(0, 3);
      const spouseNames = (entry.spouses || []).map((s) => s.name).filter(Boolean);
      const childNames = (entry.children || []).map((c) => c.name).filter(Boolean);
      return `
      <article class="direct-card ancestor-entry">
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
        ${
          lineOnly
            ? ''
            : `<div class="family-context">
                <div><strong>Spouses:</strong> ${esc(spouseNames.join(', ') || 'None listed')}</div>
                <div><strong>Children:</strong> ${esc(childNames.join(', ') || 'None listed')}</div>
              </div>`
        }
      </article>`;
    })
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
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    loadDescendantDraft();
    await boot();
    renderDescendantDraft();
    const toggle = document.getElementById('lineOnlyToggle');
    if (toggle) {
      toggle.addEventListener('change', () => renderStory());
    }
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
    if (err) err.textContent = `Direct ancestor story failed to load: ${error.message}`;
  }
});
