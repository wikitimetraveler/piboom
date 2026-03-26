/**
 * Finds dashboard — list by status, link to discovery/detail.
 */
(function () {
  'use strict';

  const STATUSES = ['researching', 'acquired', 'keeper', 'resale', 'spotted', 'sold'];

  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function cardHtml(f) {
    const thumb =
      f.payload &&
      Array.isArray(f.payload.images) &&
      f.payload.images[0] &&
      (f.payload.images[0].url || f.payload.images[0]);
    const imgUrl = typeof thumb === 'string' ? thumb : thumb?.url;
    const img = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="" style="width:100%;height:120px;object-fit:cover;">`
      : `<div class="bg-light d-flex align-items-center justify-content-center" style="height:120px;"><i class="bi-image text-muted" style="font-size:2rem;"></i></div>`;
    return `
      <div class="col-md-4 mb-3">
        <div class="card h-100 shadow-sm finds-card" data-id="${f.id}" style="cursor:pointer;">
          ${img}
          <div class="card-body py-2">
            <h6 class="card-title mb-1">${escapeHtml(f.title || 'Untitled')}</h6>
            <p class="card-text small text-muted mb-1">${escapeHtml(f.category || '')} · ${escapeHtml(f.status || '')}</p>
            <span class="badge badge-${f.scoreLabel === 'high' ? 'success' : f.scoreLabel === 'medium' ? 'warning' : 'secondary'}">Score ${f.score}</span>
          </div>
        </div>
      </div>`;
  }

  async function load() {
    const el = document.getElementById('findsDashboardRoot');
    const errEl = document.getElementById('findsDashboardError');
    if (!el) return;
    errEl.style.display = 'none';
    el.innerHTML = '<p class="text-muted">Loading…</p>';

    try {
      const data = await window.findsApi.list(200);
      const finds = data.finds || [];
      if (!finds.length) {
        el.innerHTML =
          '<p class="text-muted">No finds yet. <a href="/finds/discovery.html">Add one</a>.</p>';
        return;
      }

      const byStatus = {};
      STATUSES.forEach((s) => {
        byStatus[s] = [];
      });
      finds.forEach((f) => {
        const s = f.status || 'researching';
        if (!byStatus[s]) byStatus[s] = [];
        byStatus[s].push(f);
      });

      let html = '';
      STATUSES.forEach((st) => {
        const list = byStatus[st] || [];
        if (!list.length) return;
        html += `<h5 class="mt-4"><i class="bi-bookmark-star"></i> ${st.charAt(0).toUpperCase() + st.slice(1)} <span class="badge badge-secondary">${list.length}</span></h5>`;
        html += '<div class="row">' + list.map(cardHtml).join('') + '</div>';
      });

      el.innerHTML = html || '<p class="text-muted">No finds.</p>';

      el.querySelectorAll('.finds-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id');
          window.location.href = `/finds/detail.html?id=${encodeURIComponent(id)}`;
        });
      });
    } catch (e) {
      errEl.textContent = e.message || String(e);
      errEl.style.display = 'block';
      el.innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', load);
  window.refreshFindsDashboard = load;
})();
