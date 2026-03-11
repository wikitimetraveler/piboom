/**
 * CSS poster templates for non-AI poster generation.
 * Receives: { imageUrl, artist, album, title, subtitle, venue, date, fontFamily, qrDataUrl?, frame? }
 */
(function (global) {
  'use strict';

  const TEMPLATES = {
    single: {
      id: 'single',
      name: 'Single Image',
      desc: 'Full bleed album cover',
      render: (data) => {
        const title = data.title || data.album;
        const subtitle = data.subtitle || data.artist;
        const font = data.fontFamily || 'Georgia, serif';
        const qrHtml = data.qrDataUrl ? `<div style="position: absolute; bottom: 12px; right: 12px; width: 64px; height: 64px; background: #fff; padding: 4px;"><img src="${escapeAttr(data.qrDataUrl)}" alt="QR" style="width: 100%; height: 100%;"></div>` : '';
        return `
          <div class="poster-template single" style="width: 400px; height: 560px; overflow: hidden; position: relative; font-family: ${font};">
            <img src="${escapeAttr(data.imageUrl)}" alt="" style="width: 100%; height: 100%; object-fit: cover;">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 24px; color: #fff;">
              <div style="font-size: 1.5rem; font-weight: 700; letter-spacing: 2px;">${escapeHtml(title)}</div>
              <div style="font-size: 1rem; opacity: 0.9; margin-top: 4px;">${escapeHtml(subtitle)}</div>
              ${data.venue ? `<div style="font-size: 0.85rem; margin-top: 8px;">${escapeHtml(data.venue)}</div>` : ''}
              ${data.date ? `<div style="font-size: 0.85rem;">${escapeHtml(data.date)}</div>` : ''}
            </div>
            ${qrHtml}
          </div>`;
      }
    },
    vintage: {
      id: 'vintage',
      name: 'Vintage',
      desc: 'Ornate frame, letterpress feel',
      render: (data) => {
        const title = data.title || data.album;
        const subtitle = data.subtitle || data.artist;
        const font = data.fontFamily || 'Georgia, serif';
        const qrHtml = data.qrDataUrl ? `<div style="position: absolute; bottom: 20px; right: 20px; width: 56px; height: 56px; background: #fff; padding: 4px;"><img src="${escapeAttr(data.qrDataUrl)}" alt="QR" style="width: 100%; height: 100%;"></div>` : '';
        return `
          <div class="poster-template vintage" style="width: 400px; height: 560px; padding: 20px; background: #f5e6d3; border: 8px double #8b6914; box-shadow: inset 0 0 30px rgba(0,0,0,0.1); font-family: ${font}; position: relative;">
            <div style="position: absolute; top: 12px; left: 12px; right: 12px; bottom: 12px; border: 1px solid #8b6914; opacity: 0.5;"></div>
            <img src="${escapeAttr(data.imageUrl)}" alt="" style="width: 100%; height: 320px; object-fit: cover; border: 2px solid #8b6914;">
            <div style="margin-top: 20px; text-align: center; color: #3d2c0d;">
              <div style="font-size: 1.4rem; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">${escapeHtml(title)}</div>
              <div style="font-size: 1rem; margin-top: 6px; font-style: italic;">${escapeHtml(subtitle)}</div>
              ${data.venue || data.date ? `<div style="font-size: 0.8rem; margin-top: 12px; color: #5c4a2a;">${[data.venue, data.date].filter(Boolean).join(' • ')}</div>` : ''}
            </div>
            ${qrHtml}
          </div>`;
      }
    },
    split: {
      id: 'split',
      name: 'Split',
      desc: 'Image left, text right',
      render: (data) => {
        const title = data.title || data.album;
        const subtitle = data.subtitle || data.artist;
        const font = data.fontFamily || 'Georgia, serif';
        const qrHtml = data.qrDataUrl ? `<div style="position: absolute; bottom: 12px; right: 12px; width: 56px; height: 56px; background: #fff; padding: 4px;"><img src="${escapeAttr(data.qrDataUrl)}" alt="QR" style="width: 100%; height: 100%;"></div>` : '';
        return `
          <div class="poster-template split" style="width: 400px; height: 560px; display: flex; font-family: ${font}; position: relative;">
            <div style="flex: 0 0 50%; height: 100%; overflow: hidden;">
              <img src="${escapeAttr(data.imageUrl)}" alt="" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="flex: 1; padding: 24px; display: flex; flex-direction: column; justify-content: center; background: #1a1a1a; color: #d4af37;">
              <div style="font-size: 1.3rem; font-weight: 700; letter-spacing: 2px;">${escapeHtml(title)}</div>
              <div style="font-size: 0.95rem; margin-top: 8px; color: #b0b0b0;">${escapeHtml(subtitle)}</div>
              ${data.venue ? `<div style="font-size: 0.8rem; margin-top: 16px;">${escapeHtml(data.venue)}</div>` : ''}
              ${data.date ? `<div style="font-size: 0.8rem;">${escapeHtml(data.date)}</div>` : ''}
            </div>
            ${qrHtml}
          </div>`;
      }
    },
    grid: {
      id: 'grid',
      name: 'Grid',
      desc: '2x2 collage',
      render: (data) => {
        const title = data.title || data.album;
        const subtitle = data.subtitle || data.artist;
        const font = data.fontFamily || 'Georgia, serif';
        const img = escapeAttr(data.imageUrl);
        const qrHtml = data.qrDataUrl ? `<div style="position: absolute; bottom: 8px; right: 8px; width: 48px; height: 48px; background: #fff; padding: 3px;"><img src="${escapeAttr(data.qrDataUrl)}" alt="QR" style="width: 100%; height: 100%;"></div>` : '';
        return `
          <div class="poster-template grid" style="width: 400px; height: 560px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; font-family: ${font}; position: relative;">
            <div style="overflow: hidden;"><img src="${img}" alt="" style="width: 100%; height: 100%; object-fit: cover;"></div>
            <div style="overflow: hidden;"><img src="${img}" alt="" style="width: 100%; height: 100%; object-fit: cover; filter: sepia(0.3);"></div>
            <div style="overflow: hidden;"><img src="${img}" alt="" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(0.8);"></div>
            <div style="padding: 16px; display: flex; flex-direction: column; justify-content: center; background: #0d0d0d; color: #d4af37;">
              <div style="font-size: 1.1rem; font-weight: 700;">${escapeHtml(title)}</div>
              <div style="font-size: 0.85rem; margin-top: 4px; color: #b0b0b0;">${escapeHtml(subtitle)}</div>
              ${data.venue || data.date ? `<div style="font-size: 0.75rem; margin-top: 8px;">${[data.venue, data.date].filter(Boolean).join(' • ')}</div>` : ''}
            </div>
            ${qrHtml}
          </div>`;
      }
    }
  };

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getFrameStyles(frame) {
    const frames = {
      none: '',
      thin_gold: 'border: 2px solid #d4af37;',
      thick_vintage: 'border: 8px double #8b6914; box-shadow: inset 0 0 20px rgba(0,0,0,0.1);',
      neon_glow: 'box-shadow: 0 0 20px #ff00ff, 0 0 40px #00ffff, inset 0 0 20px rgba(255,0,255,0.1); border: 2px solid #ff00ff;'
    };
    return frames[frame] || frames.none;
  }

  function wrapWithFrame(html, frame) {
    const frameStyle = getFrameStyles(frame);
    if (!frameStyle) return html;
    return `<div class="poster-frame" style="display: inline-block; padding: 0; ${frameStyle}">${html}</div>`;
  }

  function renderTemplate(templateId, data) {
    const t = TEMPLATES[templateId] || TEMPLATES.single;
    let html = t.render(data);
    if (data.frame && data.frame !== 'none') {
      html = wrapWithFrame(html, data.frame);
    }
    return html;
  }

  function getTemplateList() {
    return Object.values(TEMPLATES).map((t) => ({ id: t.id, name: t.name, desc: t.desc }));
  }

  global.posterTemplates = {
    render: renderTemplate,
    list: getTemplateList,
    TEMPLATES
  };
})(typeof window !== 'undefined' ? window : globalThis);
