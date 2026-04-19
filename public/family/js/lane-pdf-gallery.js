function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseIdList(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.split(/[\s,]+/).map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
  return parts.length ? parts : null;
}

/** JPEG exists (pypdf decoded); skip JBIG2 / other failed streams */
function isExtractedPlate(img) {
  if (!img || img.status === 'skipped') return false;
  if (img.status === 'ok') return true;
  return Boolean(img.publicUrl && (img.fileName || /\.jpg$/i.test(String(img.publicUrl))));
}

function renderGallery(images, portraits, container) {
  const portraitByImageId = new Map();
  for (const p of portraits || []) {
    if (p.imageId) portraitByImageId.set(p.imageId, p);
  }

  container.innerHTML = (images || [])
    .map((img) => {
      const isSkipped = img.status === 'skipped';
      const ids = img.candidatePersonIds || [];
      const ambiguous = img.ambiguous;
      const confirmed = img.imageId && portraitByImageId.has(img.imageId);
      const url = img.publicUrl || '#';
      const cardClass = isSkipped ? 'lane-pdf-card lane-pdf-card--skipped' : 'lane-pdf-card';
      const imgTag = isSkipped
        ? `<div class="d-flex align-items-center justify-content-center bg-secondary text-white" style="height:120px">Not extracted</div>`
        : `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.style.opacity=0.35" />`;

      let badge = '';
      if (isSkipped) {
        badge = '<span class="badge lane-pdf-badge-skipped mb-1">Skipped decode</span>';
      } else if (confirmed) {
        badge = '<span class="badge bg-success mb-1">Curated portrait</span>';
      } else if (ambiguous) {
        badge = '<span class="badge lane-pdf-badge-ambiguous mb-1">Ambiguous page</span>';
      } else if (ids.length === 1) {
        badge = '<span class="badge lane-pdf-badge-candidate mb-1">Single candidate</span>';
      } else if (ids.length > 1) {
        badge = '<span class="badge lane-pdf-badge-ambiguous mb-1">Multiple candidates</span>';
      } else {
        badge = '<span class="badge bg-secondary mb-1">No tree match</span>';
      }

      const idLinks = ids
        .slice(0, 12)
        .map(
          (pid) =>
            `<a href="/family/genealogy.html?id=${encodeURIComponent(pid)}" class="mr-2">#${esc(pid)}</a>`
        )
        .join(' ');
      const more = ids.length > 12 ? ` <span class="text-muted">+${ids.length - 12}</span>` : '';

      return `
        <div class="col-md-4 col-sm-6 mb-4">
          <div class="${cardClass}">
            ${imgTag}
            <div class="lane-pdf-card-body">
              ${badge}
              <div><strong>Page</strong> ${esc(img.pdfPage)} · <code>${esc(img.imageId)}</code></div>
              ${!isSkipped && img.width ? `<div class="text-muted">${esc(img.width)}×${esc(img.height)}</div>` : ''}
              ${
                isSkipped && img.reason
                  ? `<div class="small text-danger mt-1">${esc(img.reason)}</div>`
                  : ''
              }
              <div class="mt-1 small"><strong>Candidates:</strong> ${idLinks || '—'}${more}</div>
            </div>
          </div>
        </div>`;
    })
    .join('');
}

function filterImages(images, pageFilter, idFilter) {
  let list = images.slice();
  if (pageFilter != null && pageFilter !== '') {
    const p = parseInt(pageFilter, 10);
    if (!Number.isNaN(p)) list = list.filter((img) => img.pdfPage === p);
  }
  if (idFilter && idFilter.length) {
    list = list.filter((img) => {
      const ids = img.candidatePersonIds || [];
      return idFilter.some((fid) => ids.includes(fid));
    });
  }
  return list;
}

async function initLanePdfGallery() {
  const grid = document.getElementById('lanePdfGrid');
  const errEl = document.getElementById('lanePdfError');
  const statsEl = document.getElementById('lanePdfStats');
  const pageInput = document.getElementById('lanePdfFilterPage');
  const idInput = document.getElementById('lanePdfFilterIds');

  try {
    const res = await fetch('/api/genealogy/lane-pdf/gallery');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Request failed');

    const images = (data.images || []).filter(isExtractedPlate);
    const portraits = data.portraits || [];
    const summary = data.summary || {};
    const skippedHidden =
      typeof summary.skippedCount === 'number' && summary.skippedCount > 0
        ? ` · <span class="text-muted">Skipped decode entries hidden (${esc(summary.skippedCount)})</span>`
        : '';

    statsEl.innerHTML = `
      <div class="lane-pdf-gallery-stats text-muted">
        PDF pages: <strong>${esc(summary.pdfPageCount)}</strong> ·
        Plates in grid: <strong>${esc(images.length)}</strong> (extracted JPEGs only)${skippedHidden} ·
        With ≥1 tree candidate (in grid): <strong>${esc(
          images.filter((i) => (i.candidatePersonIds || []).length > 0).length
        )}</strong> ·
        Curated portraits: <strong>${portraits.length}</strong>
      </div>`;

    function applyFilters() {
      const pageVal = pageInput.value.trim();
      const idFilter = parseIdList(idInput.value.trim());
      const filtered = filterImages(images, pageVal, idFilter);
      renderGallery(filtered, portraits, grid);
    }

    pageInput.addEventListener('input', applyFilters);
    idInput.addEventListener('input', applyFilters);
    applyFilters();
  } catch (e) {
    errEl.textContent = e.message || String(e);
    errEl.classList.remove('d-none');
  }
}

document.addEventListener('DOMContentLoaded', initLanePdfGallery);
