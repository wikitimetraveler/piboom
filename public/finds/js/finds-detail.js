/**
 * Development work by David Lane
 */
/**
 * Find detail — load, edit, voice note, TTS summary.
 */
(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  let findId = null;
  let current = null;

  function buildPayloadFromForm() {
    const p = current?.payload || {};
    const priceRaw = $('pricePaid').value.trim();
    const pricePaid = priceRaw === '' ? null : Number(priceRaw);
    return {
      images: Array.isArray(p.images) ? p.images : [],
      acquisition: {
        source: $('acqSource').value.trim(),
        location: $('acqLocation').value.trim(),
        pricePaid: Number.isFinite(pricePaid) ? pricePaid : null,
        date: $('acqDate').value.trim(),
      },
      identification: {
        maker: $('idMaker').value.trim(),
        probableMaker: $('idProbable').value.trim(),
        signed: $('idSigned').checked,
        numbered: $('idNumbered').checked,
        edition: $('idEdition').value.trim(),
        medium: $('idMedium').value.trim(),
        visibleText: $('idVisibleText').value.trim(),
        confidence: parseFloat($('idConfidence').value) || 0,
      },
      condition: {
        overall: $('condOverall').value.trim(),
        framed: $('condFramed').checked,
        notes: $('condNotes').value.trim(),
      },
      valuation: {
        listingLow: numOrNull($('valListLow').value),
        listingHigh: numOrNull($('valListHigh').value),
        realisticLow: numOrNull($('valRealLow').value),
        realisticHigh: numOrNull($('valRealHigh').value),
        confidence: $('valConf').value.trim(),
        notes: $('valNotes').value.trim(),
      },
      notes: $('findNotes').value.trim(),
      tags: $('findTags')
        .value.split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      subcategory: $('subcategory').value.trim(),
      aiAnalysis: p.aiAnalysis || { raw: null, summaryText: '', generatedAt: '' },
      voiceNotes: p.voiceNotes || [],
      voiceSummary: p.voiceSummary || { text: '', audioUrl: '', generatedAt: '' },
    };
  }

  function numOrNull(s) {
    const n = Number(String(s).trim());
    return Number.isFinite(n) ? n : null;
  }

  function fillForm(f) {
    $('findTitle').value = f.title || '';
    $('findCategory').value = f.category || 'unknown';
    $('findStatus').value = f.status || 'researching';
    $('scoreDisplay').textContent = `${f.score} (${f.scoreLabel})`;
    const p = f.payload || {};
    const a = p.acquisition || {};
    $('acqSource').value = a.source || '';
    $('acqLocation').value = a.location || '';
    $('acqDate').value = a.date || '';
    $('pricePaid').value = a.pricePaid != null ? a.pricePaid : '';
    const id = p.identification || {};
    $('idMaker').value = id.maker || '';
    $('idProbable').value = id.probableMaker || '';
    $('idSigned').checked = !!id.signed;
    $('idNumbered').checked = !!id.numbered;
    $('idEdition').value = id.edition || '';
    $('idMedium').value = id.medium || '';
    $('idVisibleText').value = id.visibleText || '';
    $('idConfidence').value = id.confidence != null ? id.confidence : '0';
    const c = p.condition || {};
    $('condOverall').value = c.overall || '';
    $('condFramed').checked = !!c.framed;
    $('condNotes').value = c.notes || '';
    const v = p.valuation || {};
    $('valListLow').value = v.listingLow != null ? v.listingLow : '';
    $('valListHigh').value = v.listingHigh != null ? v.listingHigh : '';
    $('valRealLow').value = v.realisticLow != null ? v.realisticLow : '';
    $('valRealHigh').value = v.realisticHigh != null ? v.realisticHigh : '';
    $('valConf').value = v.confidence || '';
    $('valNotes').value = v.notes || '';
    $('findNotes').value = p.notes || '';
    $('subcategory').value = p.subcategory || '';
    $('findTags').value = Array.isArray(p.tags) ? p.tags.join(', ') : '';
    const gal = $('imageGallery');
    const imgs = Array.isArray(p.images) ? p.images : [];
    gal.innerHTML = imgs
      .map((im) => {
        const u = typeof im === 'string' ? im : im.url;
        return `<img src="${escapeHtml(u)}" class="img-thumbnail m-1" style="max-width:140px;max-height:140px;object-fit:cover;" alt="">`;
      })
      .join('') || '<span class="text-muted">No images</span>';

    const vn = $('voiceNotesList');
    const notes = Array.isArray(p.voiceNotes) ? p.voiceNotes : [];
    vn.innerHTML = notes
      .map(
        (n) =>
          `<div class="border rounded p-2 mb-2 small"><span class="text-muted">${escapeHtml(
            n.createdAt || ''
          )}</span> [${escapeHtml(n.type || 'note')}] ${escapeHtml(n.transcript || '')}</div>`
      )
      .join('') || '<span class="text-muted">No voice notes</span>';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    findId = params().get('id');
    if (!findId) {
      $('detailRoot').innerHTML = '<p class="text-danger">Missing id.</p>';
      return;
    }

    try {
      const data = await window.findsApi.get(findId);
      current = data.find;
      fillForm(current);
    } catch (e) {
      $('detailRoot').innerHTML = `<p class="text-danger">${escapeHtml(e.message)}</p>`;
      return;
    }

    $('btnSave')?.addEventListener('click', async () => {
      try {
        const payload = buildPayloadFromForm();
        const data = await window.findsApi.update(findId, {
          title: $('findTitle').value.trim(),
          category: $('findCategory').value,
          status: $('findStatus').value,
          payload,
        });
        current = data.find;
        fillForm(current);
        $('saveStatus').textContent = 'Saved.';
        setTimeout(() => {
          $('saveStatus').textContent = '';
        }, 2000);
      } catch (e) {
        alert(e.message || String(e));
      }
    });

    $('btnDelete')?.addEventListener('click', async () => {
      if (!confirm('Delete this find?')) return;
      try {
        await window.findsApi.remove(findId);
        window.location.href = '/finds/index.html';
      } catch (e) {
        alert(e.message || String(e));
      }
    });

    $('btnReadSummary')?.addEventListener('click', async () => {
      $('ttsStatus').textContent = 'Loading…';
      try {
        const { text } = await window.findsApi.summaryText(findId);
        const syn = await window.findsApi.synthesize(text);
        if (syn.audio) {
          await window.findsApi.playBase64Mp3(syn.audio);
          $('ttsStatus').textContent = '';
        } else {
          $('ttsStatus').textContent = syn.message || 'TTS unavailable';
        }
      } catch (e) {
        $('ttsStatus').textContent = e.message || String(e);
      }
    });

    $('btnVoiceNote')?.addEventListener('click', () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Speech recognition not supported in this browser.');
        return;
      }
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new Rec();
      rec.lang = 'en-US';
      rec.onresult = async (ev) => {
        const text = ev.results[0][0].transcript;
        $('voiceStatus').textContent = 'Saving…';
        try {
          await window.findsApi.appendVoiceNote(findId, text, 'note', '');
          const data = await window.findsApi.get(findId);
          current = data.find;
          fillForm(current);
          $('voiceStatus').textContent = 'Saved note.';
        } catch (e) {
          $('voiceStatus').textContent = e.message || String(e);
        }
      };
      rec.onerror = () => {
        $('voiceStatus').textContent = 'Mic error';
      };
      $('voiceStatus').textContent = 'Listening…';
      rec.start();
    });
  });
})();
