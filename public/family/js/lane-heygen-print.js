/**
 * Lane × HeyGen print kit — legacy poster + QR composited for print shop.
 * Development work by David Lane
 */
(function () {
  const DATA_URL = '/data/lane-heygen-lines.json';
  const DEFAULT_PUBLIC_ORIGIN = 'https://www.thelanefamily.us';
  const QR_SIZE_POSTER = 104;
  const QR_SIZE_SHIRT = 104;
  const QR_SIZE_CARD = 88;
  let catalog = null;
  let person = null;
  let avatarDataUrl = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function publicOrigin() {
    if (typeof window.lanePublicOrigin === 'function') {
      return window.lanePublicOrigin(catalog?.brand?.publicSiteUrl);
    }
    const base = catalog?.brand?.publicSiteUrl || DEFAULT_PUBLIC_ORIGIN;
    return String(base).replace(/\/$/, '');
  }

  function qrDestinationUrl(slug) {
    const personEntry = catalog?.people?.[slug];
    if (personEntry?.qrLandingPath) {
      const path = personEntry.qrLandingPath.startsWith('/')
        ? personEntry.qrLandingPath
        : `/${personEntry.qrLandingPath}`;
      return new URL(path, publicOrigin()).href;
    }
    const params = new URLSearchParams({ person: slug });
    if (personEntry?.popupShort) params.set('short', '1');
    return new URL(`/family/lane-heygen-line.html?${params}`, publicOrigin()).href;
  }

  /** @deprecated use qrDestinationUrl */
  function lineLandingUrl(slug) {
    return qrDestinationUrl(slug);
  }

  function posterSrc() {
    return person?.posterUrl || person?.portraitUrl || '';
  }

  function quartetPosterSrc(entry) {
    return entry?.posterUrl || entry?.portraitUrl || '';
  }

  function generateQrNode(url, size) {
    if (!window.QRCode || !url) return null;
    const node = document.createElement('div');
    node.style.cssText = `width:${size}px;height:${size}px;`;
    const opts = { text: url, width: size, height: size, colorDark: '#000000', colorLight: '#ffffff' };
    if (window.QRCode.CorrectLevel) opts.correctLevel = window.QRCode.CorrectLevel.H;
    new window.QRCode(node, opts);
    return node;
  }

  function mountQr(host, url, size) {
    if (!host) return;
    host.innerHTML = '';
    host.classList.add('lhp-qr-frame');
    const node = generateQrNode(url, size);
    if (node) host.appendChild(node);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load image: ${src}`));
      img.src = src;
    });
  }

  function brandDevLabel() {
    return catalog?.brand?.developmentLabel || 'Development by David E Lane';
  }

  function brandHeygenHtml() {
    const url = catalog?.brand?.attributionUrl || 'https://www.heygen.com';
    const text = catalog?.brand?.attribution || 'Avatar narration powered by HeyGen';
    return `${esc(text)} · <a href="${esc(url)}" target="_blank" rel="noopener">HeyGen</a>`;
  }

  function posterCreditLine() {
    const dev = brandDevLabel();
    const heygen = catalog?.brand?.attributionShort || 'HeyGen';
    return `${dev} · Avatar narration by ${heygen}`;
  }

  function drawPosterCreditStrip(ctx, width, height) {
    const stripH = Math.max(28, Math.round(height * 0.028));
    const fontPx = Math.max(11, Math.round(stripH * 0.42));
    const y = height - stripH;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, y, width, stripH);
    ctx.fillStyle = '#d4af37';
    ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(posterCreditLine(), Math.round(width * 0.02), y + stripH / 2);
  }

  function renderPoster() {
    const host = $('lhpPosterArt');
    if (!host || !person) return;
    const src = posterSrc();
    const qrUrl = lineLandingUrl(person.slug);
    host.innerHTML = `
      <img class="lhp-poster-img" src="${esc(src)}" alt="${esc(person.name)} — Lane Legacy Museum poster" crossorigin="anonymous" />
      <div class="lhp-poster-credit-strip" aria-label="Credits">${esc(posterCreditLine())}</div>
      <div class="lhp-poster-qr-stack" aria-label="QR code to HeyGen line">
        <div id="lhpPosterQr"></div>
        <span class="lhp-poster-qr-label">Scan · hear the line</span>
        <span class="lhp-poster-qr-heygen">${esc(catalog?.brand?.attributionShort || 'HeyGen')}</span>
      </div>`;
    mountQr($('lhpPosterQr'), qrUrl, QR_SIZE_POSTER);
  }

  function renderShirt() {
    const host = $('lhpShirtArt');
    if (!host || !person) return;
    const qrUrl = lineLandingUrl(person.slug);
    host.innerHTML = `
      <div class="lhp-shirt-inner">
        <div class="lhp-shirt-portraits">
          <img src="${esc(person.portraitUrl)}" alt="${esc(person.name)} — legacy portrait" crossorigin="anonymous" />
          <div class="lhp-avatar-slot" id="lhpAvatarSlot">
            ${
              avatarDataUrl
                ? `<img src="${avatarDataUrl}" alt="HeyGen avatar frame" />`
                : `<span class="lhp-avatar-slot-hint">HeyGen avatar<br/>upload frame →</span>`
            }
          </div>
        </div>
        <div>
          <h2 class="lhp-shirt-name">${esc(person.name)}</h2>
          <p class="lhp-shirt-tagline">${esc(person.tagline)}</p>
        </div>
        <div class="lhp-shirt-footer">
          <div class="lhp-heygen-badge">
            <strong>Scan · Hear the line</strong>
            ${esc(catalog?.brand?.attributionShort || 'HeyGen')} avatar
          </div>
          <div class="lhp-shirt-qr" id="lhpShirtQr"></div>
        </div>
      </div>`;
    mountQr($('lhpShirtQr'), qrUrl, QR_SIZE_SHIRT);
  }

  function renderCard() {
    const host = $('lhpCardArt');
    if (!host || !person) return;
    const qrUrl = lineLandingUrl(person.slug);
    host.innerHTML = `
      <div class="lhp-card-face">
        <span class="lhp-card-tier">${esc(person.cardTier || 'Legendary')}</span>
        <div class="lhp-card-portrait-wrap">
          <img src="${esc(person.portraitUrl)}" alt="${esc(person.name)}" crossorigin="anonymous" />
        </div>
        <h2 class="lhp-card-name">${esc(person.name)}</h2>
        <p class="lhp-card-years">${esc(person.years)}</p>
      </div>
      <div class="lhp-card-foot">
        <div class="lhp-card-foot-qr" id="lhpCardQr"></div>
        <div class="lhp-card-scan">
          <strong>Scan for HeyGen line</strong>
          ${esc(person.cardScanHint || person.tagline || '')}
        </div>
      </div>`;
    mountQr($('lhpCardQr'), qrUrl, QR_SIZE_CARD);
  }

  function renderMeta() {
    const qrUrl = lineLandingUrl(person.slug);
    $('lhpQrUrl').textContent = qrUrl;
    const preview = $('lhpQrPreview');
    if (preview) preview.href = qrUrl;
    $('lhpScriptBox').textContent =
      Array.isArray(person.heygenScriptScenes) && person.heygenScriptScenes.length
        ? person.heygenScriptScenes.join('\n\n')
        : person.heygenScript || '';
    $('lhpAttribution').innerHTML = `
      <strong>Credits (include on packaging or shirt insert):</strong><br />
      ${esc(brandDevLabel())}<br />
      ${brandHeygenHtml()}`;
    const creditsLine = $('lhpCreditsLine');
    if (creditsLine) {
      creditsLine.innerHTML = `${esc(brandDevLabel())} · ${brandHeygenHtml()}`;
    }
  }

  async function exportPosterWithQr() {
    const src = posterSrc();
    const qrUrl = lineLandingUrl(person.slug);
    if (!src || !window.posterUtils) {
      $('lhpError').hidden = false;
      $('lhpError').textContent = 'Poster image or export utilities unavailable.';
      return;
    }
    try {
      const poster = await loadImage(src);
      const qrNode = generateQrNode(qrUrl, 512);
      const qrCanvas = qrNode?.querySelector('canvas');
      if (!qrCanvas) throw new Error('QR generation failed.');

      const canvas = document.createElement('canvas');
      canvas.width = poster.naturalWidth || poster.width;
      canvas.height = poster.naturalHeight || poster.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(poster, 0, 0, canvas.width, canvas.height);

      const qrSize = Math.round(canvas.width * 0.17);
      const pad = Math.round(canvas.width * 0.03);
      const labelH = Math.round(qrSize * 0.28);
      const boxW = qrSize + pad * 2;
      const boxH = qrSize + pad * 2 + labelH;
      const x = canvas.width - boxW - pad * 2;
      const y = canvas.height - boxH - pad * 2 - Math.max(28, Math.round(canvas.height * 0.028));
      const borderW = Math.max(4, Math.round(canvas.width * 0.004));

      drawPosterCreditStrip(ctx, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, pad);
      ctx.fill();

      ctx.strokeStyle = '#1a1410';
      ctx.lineWidth = borderW;
      ctx.stroke();

      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = Math.max(2, Math.round(borderW * 0.55));
      ctx.beginPath();
      ctx.roundRect(x + borderW * 0.6, y + borderW * 0.6, boxW - borderW * 1.2, boxH - borderW * 1.2, pad);
      ctx.stroke();

      ctx.drawImage(qrCanvas, x + pad, y + pad, qrSize, qrSize);

      const fontPx = Math.max(12, Math.round(qrSize * 0.11));
      ctx.fillStyle = '#1a1410';
      ctx.font = `800 ${fontPx}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SCAN · HEAR THE LINE', x + boxW / 2, y + pad + qrSize + fontPx * 0.85);

      ctx.fillStyle = '#4f46e5';
      ctx.font = `700 ${Math.max(10, Math.round(fontPx * 0.85))}px Inter, system-ui, sans-serif`;
      ctx.fillText('HEYGEN', x + boxW / 2, y + pad + qrSize + fontPx * 1.65);

      window.posterUtils.downloadDataUrl(
        window.posterUtils.canvasToDataUrl(canvas),
        `lane-heygen-poster-qr-${person.slug}.png`
      );
    } catch (err) {
      $('lhpError').hidden = false;
      $('lhpError').textContent = err.message || 'Poster export failed.';
    }
  }

  async function exportArt(selector, filename) {
    const el = document.querySelector(selector);
    if (!el || !window.posterUtils) {
      $('lhpError').hidden = false;
      $('lhpError').textContent = 'Export utilities not loaded.';
      return;
    }
    try {
      const canvas = await window.posterUtils.renderPosterCanvas(el, { scale: 2, backgroundColor: null });
      window.posterUtils.downloadDataUrl(window.posterUtils.canvasToDataUrl(canvas), filename);
    } catch (err) {
      $('lhpError').hidden = false;
      $('lhpError').textContent = err.message || 'Export failed.';
    }
  }

  function exportQrCanvas(qrCanvas, size = 512) {
    const quiet = Math.round(size * 0.12);
    const border = Math.max(6, Math.round(size * 0.015));
    const total = size + quiet * 2 + border * 2;
    const out = document.createElement('canvas');
    out.width = total;
    out.height = total;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, total, total);
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, total - border, total - border);
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = Math.max(2, Math.round(border * 0.6));
    ctx.strokeRect(border + 2, border + 2, total - border * 2 - 4, total - border * 2 - 4);
    ctx.drawImage(qrCanvas, border + quiet, border + quiet, size, size);
    return out;
  }

  async function exportQrOnly() {
    const qrUrl = lineLandingUrl(person.slug);
    const node = generateQrNode(qrUrl, 512);
    if (!node) return;
    const canvas = node.querySelector('canvas');
    if (!canvas || !window.posterUtils) return;
    const framed = exportQrCanvas(canvas, 512);
    window.posterUtils.downloadDataUrl(window.posterUtils.canvasToDataUrl(framed), `lane-heygen-qr-${person.slug}.png`);
  }

  function bindEvents() {
    $('lhpExportPosterPng')?.addEventListener('click', exportPosterWithQr);
    $('lhpExportShirtPng')?.addEventListener('click', () =>
      exportArt('#lhpShirtArt', `lane-heygen-shirt-${person.slug}.png`)
    );
    $('lhpExportCardPng')?.addEventListener('click', () =>
      exportArt('#lhpCardArt', `lane-heygen-card-${person.slug}.png`)
    );
    $('lhpExportQrPng')?.addEventListener('click', exportQrOnly);
    $('lhpExportQuartetPng')?.addEventListener('click', () =>
      exportArt('#lhpQuartetArt', 'lane-heygen-shirt-quartet-4up.png')
    );
    $('lhpPrintBtn')?.addEventListener('click', () => window.print());
    $('lhpAvatarUpload')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        avatarDataUrl = reader.result;
        renderShirt();
      };
      reader.readAsDataURL(file);
    });
    $('lhpPersonSelect')?.addEventListener('change', () => {
      try {
        setActivePerson($('lhpPersonSelect').value);
      } catch (err) {
        $('lhpError').hidden = false;
        $('lhpError').textContent = err.message || 'Could not switch subject.';
      }
    });
  }

  function quartetSlugs() {
    const slugs = catalog?.shirtQuartet;
    if (!Array.isArray(slugs) || !slugs.length) return [];
    return slugs.filter((slug) => catalog?.people?.[slug]);
  }

  function renderQuartet() {
    const host = $('lhpQuartetArt');
    if (!host) return;
    const slugs = quartetSlugs();
    if (!slugs.length) {
      host.innerHTML = '<p class="small text-muted mb-0">No shirt quartet configured.</p>';
      return;
    }
    host.innerHTML = `<div class="lhp-quartet-grid">${slugs
      .map((slug, index) => {
        const p = catalog.people[slug];
        const qrUrl = qrDestinationUrl(slug);
        const order = index + 1;
        return `<div class="lhp-quartet-cell" data-slug="${esc(slug)}">
          <span class="lhp-quartet-order">${order}</span>
          <div class="lhp-quartet-art">
            <img src="${esc(quartetPosterSrc(p))}" alt="${esc(p.name)}" crossorigin="anonymous" />
          </div>
          <h3 class="lhp-quartet-name">${esc(p.name)}</h3>
          <p class="lhp-quartet-years">${esc(p.years || '')}</p>
          <p class="lhp-quartet-tagline">${esc(p.tagline || '')}</p>
          <p class="lhp-quartet-bio">${esc(p.shirtBio || p.tagline || '')}</p>
          <div class="lhp-quartet-qr" id="lhpQuartetQr-${esc(slug)}"></div>
          <span class="lhp-quartet-scan">Scan · story ${order}/4</span>
        </div>`;
      })
      .join('')}</div>`;
    slugs.forEach((slug) => {
      mountQr($(`lhpQuartetQr-${slug}`), qrDestinationUrl(slug), 88);
    });
  }

  function populatePersonSelect() {
    const select = $('lhpPersonSelect');
    if (!select || !catalog?.people) return;
    const quartet = new Set(quartetSlugs());
    const entries = Object.values(catalog.people).sort((a, b) => {
      const aq = quartet.has(a.slug) ? quartetSlugs().indexOf(a.slug) : 99;
      const bq = quartet.has(b.slug) ? quartetSlugs().indexOf(b.slug) : 99;
      if (aq !== bq) return aq - bq;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    select.innerHTML = entries
      .map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`)
      .join('');
    const fromUrl = new URLSearchParams(window.location.search).get('person');
    if (fromUrl && catalog.people[fromUrl]) {
      select.value = fromUrl;
    }
  }

  function setActivePerson(slug) {
    person = catalog?.people?.[slug];
    if (!person) throw new Error(`Unknown Lane HeyGen line: ${slug}`);
    renderPoster();
    renderShirt();
    renderCard();
    renderMeta();
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL);
      catalog = await res.json();
      populatePersonSelect();
      const slug = $('lhpPersonSelect')?.value || 'jonathan-homer-lane';
      setActivePerson(slug);
      renderQuartet();
      bindEvents();
    } catch (err) {
      $('lhpError').hidden = false;
      $('lhpError').textContent = err.message || 'Could not load print kit.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
