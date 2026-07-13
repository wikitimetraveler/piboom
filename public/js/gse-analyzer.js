/**
 * Development work by David Lane
 */
/* global agGrid */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let productsApi;
  let suggestionsApi;
  let lastProductsAll = [];
  let productFilter = 'all';
  let voiceWidgetInstance;
  let lastSummarySnapshot = null;

  function setBusy(el, busy) {
    if (!el) return;
    el.disabled = !!busy;
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function plainText(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speak(text, options) {
    const message = plainText(text);
    if (!message) return false;
    if (typeof window.speakWithGoogle === 'function') {
      window.speakWithGoogle(message, 'en-US-Standard-D', options || {});
      return true;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = options && options.speakingRate ? options.speakingRate : 1;
        window.speechSynthesis.speak(utterance);
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  function stopSpeechPlayback() {
    if (typeof window.stopSpeech === 'function') {
      window.stopSpeech();
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function encompassFetch(url, options) {
    return (window.encompassApi && window.encompassApi.encompassFetch
      ? window.encompassApi.encompassFetch(url, options)
      : fetch(url, options));
  }

  function fieldMapApi() {
    return globalThis.gseEncompassFieldMap;
  }

  function agencyBucket(agencyStr) {
    const a = String(agencyStr || '').toLowerCase();
    if (a.includes('fannie')) return 'fannie';
    if (a.includes('freddie')) return 'freddie';
    if (a.includes('fha') || a.includes('federal housing')) return 'fha';
    if (a.includes('veterans') || /\bva\b/.test(a)) return 'va';
    if (a.includes('usda') || a.includes('agriculture') || a.includes('rural')) return 'usda';
    return 'other';
  }

  function filterProductsRows(rows) {
    if (productFilter === 'all') return rows || [];
    const list = rows || [];
    return list.filter((r) => {
      const b = agencyBucket(r.agency);
      if (productFilter === 'gse') return b === 'fannie' || b === 'freddie';
      if (productFilter === 'fha') return b === 'fha';
      if (productFilter === 'va') return b === 'va';
      if (productFilter === 'usda') return b === 'usda';
      return true;
    });
  }

  function applyProductFilter() {
    if (!productsApi) return;
    const rows = filterProductsRows(lastProductsAll);
    productsApi.setGridOption('rowData', rows);
    const cnt = $('gseProductRowCount');
    if (cnt) cnt.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
  }

  function setFilterChipActive(id) {
    ['gseFilterAll', 'gseFilterGse', 'gseFilterFha', 'gseFilterVa', 'gseFilterUsda'].forEach((hid) => {
      const el = $(hid);
      if (!el) return;
      el.classList.toggle('active', el.id === id);
    });
  }

  function aggregateByBucket(products) {
    const buckets = {
      fannie: { fit: 0, possible: 0, unlikely: 0, total: 0 },
      freddie: { fit: 0, possible: 0, unlikely: 0, total: 0 },
      fha: { fit: 0, possible: 0, unlikely: 0, total: 0 },
      va: { fit: 0, possible: 0, unlikely: 0, total: 0 },
      usda: { fit: 0, possible: 0, unlikely: 0, total: 0 }
    };
    for (const row of products || []) {
      const b = agencyBucket(row.agency);
      if (!buckets[b]) continue;
      const t = buckets[b];
      t.total++;
      const st = String(row.status || '');
      if (st === 'fit') t.fit++;
      else if (st === 'possible-fit') t.possible++;
      else t.unlikely++;
    }
    return buckets;
  }

  function renderCountDl(dlEl, stats) {
    if (!dlEl || !stats) return;
    const parts = [
      ['Products', stats.total],
      ['Fit', stats.fit],
      ['Possible', stats.possible],
      ['Unlikely', stats.unlikely]
    ];
    dlEl.innerHTML = parts
      .map(
        ([k, v]) =>
          `<dt class="col-6">${k}</dt><dd class="col-6">${typeof v === 'number' ? v : '—'}</dd>`
      )
      .join('');
  }

  const EXHIBIT_LINK_UL_IDS = {
    fannie: 'gseExhibitFannieLinks',
    freddie: 'gseExhibitFreddieLinks',
    fha: 'gseExhibitFhaLinks',
    va: 'gseExhibitVaLinks',
    usda: 'gseExhibitUsdaLinks'
  };

  const EXHIBIT_RUN_IDS = {
    fannie: 'gseExhibitFannieRun',
    freddie: 'gseExhibitFreddieRun',
    fha: 'gseExhibitFhaRun',
    va: 'gseExhibitVaRun',
    usda: 'gseExhibitUsdaRun'
  };

  const EXHIBIT_COUNT_IDS = {
    fannie: 'gseExhibitFannieCounts',
    freddie: 'gseExhibitFreddieCounts',
    fha: 'gseExhibitFhaCounts',
    va: 'gseExhibitVaCounts',
    usda: 'gseExhibitUsdaCounts'
  };

  function escapeHtmlAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildSourceIndex(sourcesArray) {
    const index = new Map();
    for (const row of sourcesArray || []) {
      if (row && row.id) index.set(row.id, { title: row.title || row.id, url: row.url || '' });
    }
    return index;
  }

  function renderExhibitReferenceLinks(metadata) {
    const agencyLinks = metadata && metadata.agencyExhibitLinks;
    const deliveryLinks = metadata && metadata.deliveryExhibitLinks;
    const sourceIndex = buildSourceIndex(metadata && metadata.sources);

    function fillLinkList(ulId, ids) {
      const ul = $(ulId);
      if (!ul) return;
      const items = (Array.isArray(ids) ? ids : [])
        .map((id) => sourceIndex.get(id))
        .filter((ref) => ref && ref.url);
      if (!items.length) {
        ul.innerHTML = '<li class="text-muted">No references configured.</li>';
        return;
      }
      ul.innerHTML = items
        .map(
          (ref) =>
            `<li><a class="gse-exhibit-link" href="${escapeHtmlAttr(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlAttr(ref.title)}<i class="bi bi-box-arrow-up-right gse-exhibit-link-icon" aria-hidden="true"></i></a></li>`
        )
        .join('');
    }

    if (agencyLinks) {
      for (const [agency, ulId] of Object.entries(EXHIBIT_LINK_UL_IDS)) {
        fillLinkList(ulId, agencyLinks[agency]);
      }
    }

    if (deliveryLinks) {
      fillLinkList('gseExhibitGinnieLinks', deliveryLinks.ginnie);
    }
  }

  function resetGinnieDeliveryEvidence() {
    const runEl = $('gseExhibitGinnieRun');
    if (runEl) {
      runEl.textContent =
        'Run Analyze to see whether FHA / VA / USDA product fits suggest possible Ginnie Mae MBS delivery.';
    }
    const dl = $('gseExhibitGinnieCounts');
    if (dl) dl.innerHTML = '';
  }

  function renderGinnieDelivery(products) {
    if (!products || !products.length) {
      resetGinnieDeliveryEvidence();
      return;
    }
    const agg = aggregateByBucket(products);
    const gov = {
      fha: agg.fha,
      va: agg.va,
      usda: agg.usda
    };
    const catalogTotal = gov.fha.total + gov.va.total + gov.usda.total;
    const candidate =
      gov.fha.fit +
      gov.fha.possible +
      gov.va.fit +
      gov.va.possible +
      gov.usda.fit +
      gov.usda.possible;

    const dl = $('gseExhibitGinnieCounts');
    if (dl) {
      dl.innerHTML = [
        ['Gov products', catalogTotal],
        ['Fit / possible', candidate],
        ['FHA fit+poss', gov.fha.fit + gov.fha.possible],
        ['VA fit+poss', gov.va.fit + gov.va.possible],
        ['USDA fit+poss', gov.usda.fit + gov.usda.possible]
      ]
        .map(([k, v]) => `<dt class="col-6">${k}</dt><dd class="col-6">${v}</dd>`)
        .join('');
    }

    const runEl = $('gseExhibitGinnieRun');
    if (!runEl) return;
    if (candidate > 0) {
      runEl.textContent = `Last analysis: ${candidate} FHA/VA/USDA catalog row(s) with fit or possible-fit. Those paths may support Ginnie Mae MBS delivery after program approval and issuer compliance—not underwriting eligibility.`;
    } else {
      runEl.textContent =
        'Last analysis: no FHA/VA/USDA fit or possible-fit rows. Ginnie Mae MBS delivery typically applies only after a government-insured or guaranteed loan is approved.';
    }
  }

  function resetExhibitEvidenceCounts() {
    for (const agency of Object.keys(EXHIBIT_RUN_IDS)) {
      const runEl = $(EXHIBIT_RUN_IDS[agency]);
      if (runEl) runEl.textContent = 'Run Analyze to populate counts.';
      const dl = $(EXHIBIT_COUNT_IDS[agency]);
      if (dl) dl.innerHTML = '';
    }
    resetGinnieDeliveryEvidence();
  }

  function renderExhibits(products) {
    if (!products || !products.length) {
      resetExhibitEvidenceCounts();
      return;
    }
    const agg = aggregateByBucket(products);
    renderCountDl($('gseExhibitFannieCounts'), agg.fannie);
    renderCountDl($('gseExhibitFreddieCounts'), agg.freddie);
    renderCountDl($('gseExhibitFhaCounts'), agg.fha);
    renderCountDl($('gseExhibitVaCounts'), agg.va);
    renderCountDl($('gseExhibitUsdaCounts'), agg.usda);

    const setRun = (id, n) => {
      const el = $(id);
      if (el) el.textContent = `Last analysis: ${n} catalog row(s) in this agency bucket (fit / possible / unlikely in table below).`;
    };
    setRun('gseExhibitFannieRun', agg.fannie.total);
    setRun('gseExhibitFreddieRun', agg.freddie.total);
    setRun('gseExhibitFhaRun', agg.fha.total);
    setRun('gseExhibitVaRun', agg.va.total);
    setRun('gseExhibitUsdaRun', agg.usda.total);
    renderGinnieDelivery(products);
  }

  function initProductsGrid() {
    const el = $('gseProductsGrid');
    if (!el || typeof agGrid === 'undefined' || typeof agGrid.createGrid !== 'function') return;
    const columnDefs = [
      { field: 'agency', headerName: 'Agency', flex: 1, minWidth: 110 },
      { field: 'product', headerName: 'Product', flex: 1.4, minWidth: 160 },
      { field: 'status', headerName: 'Status', flex: 0.8, minWidth: 100 },
      { field: 'score', headerName: 'Score', width: 90 },
      {
        field: 'reasons',
        headerName: 'Reasons',
        flex: 2,
        minWidth: 200,
        valueGetter: (p) => (Array.isArray(p.data.reasons) ? p.data.reasons.join(' ') : '')
      },
      {
        field: 'warnings',
        headerName: 'Warnings',
        flex: 1.5,
        minWidth: 160,
        valueGetter: (p) => (Array.isArray(p.data.warnings) ? p.data.warnings.join(' ') : '')
      }
    ];
    const opts = {
      columnDefs,
      defaultColDef: { sortable: true, resizable: true, filter: true },
      rowData: [],
      animateRows: true
    };
    if (typeof agGrid.createGrid === 'function') {
      productsApi = agGrid.createGrid(el, opts);
    } else {
      new agGrid.Grid(el, opts);
      productsApi = opts.api;
    }
  }

  function initSuggestionsGrid() {
    const el = $('gseSuggestionsGrid');
    if (!el || typeof agGrid === 'undefined' || typeof agGrid.createGrid !== 'function') return;
    const sopts = {
      columnDefs: [{ field: 'text', headerName: 'Suggestions', flex: 1 }],
      defaultColDef: { sortable: false, resizable: true },
      rowData: []
    };
    if (typeof agGrid.createGrid === 'function') {
      suggestionsApi = agGrid.createGrid(el, sopts);
    } else {
      new agGrid.Grid(el, sopts);
      suggestionsApi = sopts.api;
    }
  }

  function readScenarioFromForm() {
    const ami = $('amiPercent').value.trim();
    const usdaRaw = $('usdaEligibleArea').value;
    return {
      borrower: {
        creditScore: Number($('creditScore').value),
        firstTimeHomebuyer: $('firstTimeHomebuyer').value === 'true',
        income: Number($('income').value),
        ...(ami !== '' ? { amiPercent: Number(ami) } : {})
      },
      loan: {
        loanAmount: Number($('loanAmount').value),
        purchasePrice: Number($('purchasePrice').value),
        ltv: Number($('ltv').value),
        cltv: Number($('cltv').value),
        occupancy: $('occupancy').value,
        purpose: $('purpose').value,
        propertyType: $('propertyType').value,
        units: Number($('units').value),
        state: $('state').value.trim().toUpperCase(),
        county: $('county').value.trim(),
        investorName: '',
        channel: '',
        ...(usdaRaw === 'true' ? { usdaEligibleArea: true } : usdaRaw === 'false' ? { usdaEligibleArea: false } : {})
      },
      risk: {
        dti: Number($('dti').value),
        reservesMonths: Number($('reservesMonths').value),
        manualUnderwrite: $('manualUnderwrite').value === 'true'
      }
    };
  }

  function applyScenarioToForm(scenario) {
    if (!scenario) return;
    const b = scenario.borrower || {};
    const l = scenario.loan || {};
    const r = scenario.risk || {};
    $('creditScore').value = String(b.creditScore ?? '');
    $('firstTimeHomebuyer').value = b.firstTimeHomebuyer === true ? 'true' : 'false';
    $('income').value = String(b.income ?? '');
    if (b.amiPercent != null && Number.isFinite(Number(b.amiPercent))) {
      $('amiPercent').value = String(b.amiPercent);
    }
    $('loanAmount').value = String(l.loanAmount ?? '');
    $('purchasePrice').value = String(l.purchasePrice ?? '');
    $('ltv').value = String(l.ltv ?? '');
    $('cltv').value = String(l.cltv ?? '');
    $('occupancy').value = l.occupancy || 'primary';
    $('purpose').value = l.purpose || 'purchase';
    $('propertyType').value = l.propertyType || 'singleFamily';
    $('units').value = String(l.units ?? '1');
    $('state').value = String(l.state ?? '').slice(0, 2).toUpperCase();
    $('county').value = String(l.county ?? '');
    $('dti').value = String(r.dti ?? '');
    $('reservesMonths').value = String(r.reservesMonths ?? '0');
    $('manualUnderwrite').value = r.manualUnderwrite === true ? 'true' : 'false';
    if (l.usdaEligibleArea === true) $('usdaEligibleArea').value = 'true';
    else if (l.usdaEligibleArea === false) $('usdaEligibleArea').value = 'false';
    else $('usdaEligibleArea').value = '';
    $('jsonPaste').value = '';
  }

  function setPipelineStatus(html, isError) {
    const el = $('gsePipelineStatus');
    if (!el) return;
    el.innerHTML = html;
    el.classList.toggle('text-danger', !!isError);
    el.classList.toggle('text-muted', !isError);
  }

  function setAiStatus(msg, isError) {
    const statusEl = $('gseAiStatus');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('text-danger', !!isError);
    statusEl.classList.toggle('text-muted', !isError);
  }

  function setProductFilter(mode) {
    const idMap = {
      all: 'gseFilterAll',
      gse: 'gseFilterGse',
      fha: 'gseFilterFha',
      va: 'gseFilterVa',
      usda: 'gseFilterUsda'
    };
    productFilter = mode;
    setFilterChipActive(idMap[mode] || idMap.all);
    applyProductFilter();
  }

  function buildGseSummarySpeech() {
    const snap = lastSummarySnapshot;
    if (!snap || !snap.summary) {
      return 'Run Analyze first to hear the current GSE summary.';
    }
    const summary = snap.summary;
    const parts = [
      `Best fit: ${summary.bestFit || 'unknown'}.`,
      `Risk: ${summary.riskLevel || 'unknown'}.`,
      `Conforming status: ${summary.conformingStatus || 'unknown'}.`
    ];
    if (summary.loanLimit && Number.isFinite(Number(summary.loanLimit.amount))) {
      parts.push(`Loan limit: ${Number(summary.loanLimit.amount).toLocaleString()} dollars${summary.loanLimit.highCostArea ? ' in a high-cost area' : ''}.`);
    }
    if (summary.failedOverlayCount != null) {
      parts.push(`Overlay issues: ${summary.failedOverlayCount}.`);
    }
    if (snap.warnings && snap.warnings.length) {
      parts.push(`Warning: ${snap.warnings[0]}`);
    }
    return parts.join(' ');
  }

  function speakGseSummary() {
    return speak(buildGseSummarySpeech(), { speakingRate: 0.98 });
  }

  function initializeVoiceWidget() {
    if (typeof initVoiceWidget !== 'function') return;
    voiceWidgetInstance = initVoiceWidget({
      position: 'bottom-right',
      theme: 'blue',
      onCommand: handleVoiceCommand
    });
  }

  function handleVoiceCommand(rawCommand) {
    const command = String(rawCommand || '').toLowerCase().trim();
    const question = $('gseAiQuestion');
    const pipelineInput = $('gsePipelineLoanId');
    if (!command) return;

    if (command.includes('stop speech') || command.includes('stop talking') || command.includes('be quiet')) {
      stopSpeechPlayback();
      return;
    }

    if (command.includes('read summary') || command.includes('speak summary') || command.includes('read results')) {
      speakGseSummary();
      return;
    }

    const pipelineMatch = command.match(/load (?:pipeline )?(?:loan )?#?(\d{1,8})/);
    if (pipelineMatch) {
      if (pipelineInput) pipelineInput.value = pipelineMatch[1];
      speak(`Loading pipeline loan ${pipelineMatch[1]}.`);
      loadFromPipeline({ voiceFeedback: true });
      return;
    }
    if (command.includes('load pipeline')) {
      speak('Say load pipeline loan and then a number.');
      return;
    }

    if (command.includes('analyze')) {
      speak('Analyzing scenario.');
      runAnalyze({ voiceFeedback: true, speakSummary: true });
      return;
    }

    if (command.includes('loan limit') || command.includes('lookup limit')) {
      speak('Looking up loan limits.');
      runLoanLimits({ voiceFeedback: true });
      return;
    }

    if (command.includes('show all')) {
      setProductFilter('all');
      speak('Showing all products.');
      return;
    }
    if (command.includes('show gse') || command.includes('gse only')) {
      setProductFilter('gse');
      speak('Showing GSE products only.');
      return;
    }
    if (command.includes('show fha')) {
      setProductFilter('fha');
      speak('Showing FHA products.');
      return;
    }
    if (command.includes('show va')) {
      setProductFilter('va');
      speak('Showing V A products.');
      return;
    }
    if (command.includes('show usda') || command.includes('show rural')) {
      setProductFilter('usda');
      speak('Showing U S D A products.');
      return;
    }

    if (command.includes('ask expert')) {
      const currentQuestion = question ? String(question.value || '').trim() : '';
      if (!currentQuestion) {
        speak('Enter an expert question first, then say ask expert.');
        return;
      }
      speak('Asking the AI expert.');
      runLoanExpert(undefined, { voiceFeedback: true });
      return;
    }

    speak('Command not recognized for the GSE analyzer. Try analyze scenario, load pipeline loan 42, show FHA, or read summary.');
  }

  async function loadFromPipeline(options = {}) {
    const loadBtn = $('btnLoadPipeline');
    const idRaw = $('gsePipelineLoanId').value.trim();
    const loanId = parseInt(idRaw, 10);
    if (!idRaw || Number.isNaN(loanId) || loanId < 1) {
      setPipelineStatus('Enter a positive pipeline loan id.', true);
      if (options.voiceFeedback) speak('Enter a positive pipeline loan id.');
      return;
    }

    const api = fieldMapApi();
    if (!api || !Array.isArray(api.GSE_ENCOMPASS_FIELD_IDS)) {
      setPipelineStatus('Field map script failed to load. Check console.', true);
      if (options.voiceFeedback) speak('The GSE field map failed to load.');
      return;
    }

    setPipelineStatus(`Loading pipeline loan <strong>#${loanId}</strong>…`, false);
    setBusy(loadBtn, true);
    try {
      const lpRes = await fetch(`/api/loan-pipeline/loans/${loanId}`);
      const lpJson = await lpRes.json().catch(() => ({}));
      if (!lpRes.ok || !lpJson.success) {
        const msg = (lpJson.error && String(lpJson.error)) || `Pipeline request failed (${lpRes.status}).`;
        setPipelineStatus(msg, true);
        if (options.voiceFeedback) speak(msg);
        return;
      }
      const loan = lpJson.data && lpJson.data.loan;
      const guid = loan && loan.encompass_loan_guid ? String(loan.encompass_loan_guid).trim() : '';
      if (!guid) {
        setPipelineStatus(
          'This pipeline row has no <code>encompass_loan_guid</code>. Load is only enabled when the loan is linked to Encompass.',
          true
        );
        if (options.voiceFeedback) speak('This pipeline loan is not linked to Encompass.');
        return;
      }

      const loanNo = loan.loan_number != null ? String(loan.loan_number) : '';
      setPipelineStatus(
        `Reading Encompass fields for loan #${loanNo || loanId} <span class="text-muted">(${guid.slice(0, 8)}…)</span>…`,
        false
      );

      const readerUrl = `/api/encompass-hub/loans/${encodeURIComponent(guid)}/field-reader?invalidFieldBehavior=Include&includeMetadata=true`;
      const ehRes = await encompassFetch(readerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(api.GSE_ENCOMPASS_FIELD_IDS)
      });
      const ehJson = await ehRes.json().catch(() => null);
      if (!ehRes.ok) {
        const msg =
          (ehJson && (ehJson.details || ehJson.error || ehJson.message)) ||
          (typeof ehJson === 'string' ? ehJson : '') ||
          `Encompass field-reader failed (${ehRes.status}).`;
        setPipelineStatus(String(msg), true);
        if (options.voiceFeedback) speak(msg);
        return;
      }

      const mapped = api.mapReaderToScenario(ehJson);
      if (!mapped.ok) {
        setPipelineStatus(
          `<strong>Could not map scenario.</strong><ul class="mb-0 ps-3">${(mapped.errors || [])
            .map((e) => `<li>${String(e)}</li>`)
            .join('')}</ul>`,
          true
        );
        if (options.voiceFeedback) speak((mapped.errors || [])[0] || 'Could not map the scenario.');
        return;
      }

      const validateRes = await fetch('/api/gse/import-loan-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapped.scenario)
      });
      const validateJson = await validateRes.json().catch(() => ({}));
      if (!validateRes.ok || !validateJson.success) {
        const msg = (validateJson.errors && validateJson.errors.join('; ')) || validateJson.error || 'Validation failed';
        setPipelineStatus(`<strong>Scenario validation failed.</strong> ${msg}`, true);
        if (options.voiceFeedback) speak(msg);
        return;
      }

      applyScenarioToForm(validateJson.scenario);
      const warnList = [...(mapped.warnings || []), ...(validateJson.warnings || [])];
      if (warnList.length) {
        const wEl = $('gseInputWarnings');
        if (wEl) {
          wEl.textContent = warnList.join(' ');
          wEl.classList.remove('d-none');
        }
      }
      setPipelineStatus(
        `Loaded scenario from pipeline <strong>#${loanId}</strong>${loanNo ? ` (loan #${loanNo})` : ''}. Review fields, then Analyze.`,
        false
      );
      if (options.voiceFeedback) speak(`Pipeline loan ${loanId} loaded. Review the fields, then analyze.`);
    } catch (e) {
      setPipelineStatus(String(e.message || e), true);
      if (options.voiceFeedback) speak(e.message || String(e));
    } finally {
      setBusy(loadBtn, false);
    }
  }

  function setSummary(summary, warnings) {
    lastSummarySnapshot = {
      summary: summary || null,
      warnings: Array.isArray(warnings) ? [...warnings] : []
    };
    $('gseBestFit').textContent = summary ? summary.bestFit : '—';
    $('gseRisk').textContent = summary ? summary.riskLevel : '—';
    $('gseConf').textContent = summary ? summary.conformingStatus : '—';
    $('gseOverlayIssues').textContent = summary ? String(summary.failedOverlayCount ?? '—') : '—';
    const lim = summary && summary.loanLimit;
    $('gseLimit').textContent = lim ? `$${lim.amount.toLocaleString()} (${lim.year}${lim.highCostArea ? ', high-cost' : ''})` : '—';
    const wEl = $('gseInputWarnings');
    if (warnings && warnings.length) {
      wEl.textContent = warnings.join(' ');
      wEl.classList.remove('d-none');
    } else {
      wEl.textContent = '';
      wEl.classList.add('d-none');
    }
    wEl.setAttribute('role', warnings && warnings.length ? 'alert' : 'status');
  }

  async function runAnalyze(options = {}) {
    const btn = $('btnAnalyze');
    setBusy(btn, true);
    try {
      let body;
      const raw = $('jsonPaste').value.trim();
      if (raw) {
        body = JSON.parse(raw);
      } else {
        body = readScenarioFromForm();
      }
      const res = await fetch('/api/gse/analyze-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = (data.errors && data.errors.join('; ')) || data.error || 'Request failed';
        if (options.voiceFeedback) speak(msg);
        alert(msg);
        return;
      }
      setSummary(data.summary, data.warnings);
      lastProductsAll = data.products || [];
      applyProductFilter();
      renderExhibits(lastProductsAll);
      if (suggestionsApi) {
        const suggestionRows = (data.suggestions || []).map((t) => ({ text: t }));
        suggestionsApi.setGridOption('rowData', suggestionRows);
        const sCnt = $('gseSuggestionCount');
        if (sCnt) sCnt.textContent = `${suggestionRows.length} item${suggestionRows.length === 1 ? '' : 's'}`;
      }
      if (options.speakSummary) {
        speakGseSummary();
      }
    } catch (e) {
      if (options.voiceFeedback) speak(e.message || String(e));
      alert(e.message || String(e));
    } finally {
      setBusy(btn, false);
    }
  }

  async function runLoanLimits(options = {}) {
    const state = $('state').value.trim();
    const county = $('county').value.trim();
    const units = $('units').value || '1';
    const res = await fetch(
      `/api/gse/loan-limits?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}&units=${encodeURIComponent(units)}`
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (options.voiceFeedback) speak(data.error || 'Loan limit lookup failed.');
      alert(data.error || 'Lookup failed');
      return;
    }
    if (options.voiceFeedback) {
      speak(`Conforming limit is ${data.conformingLimit.toLocaleString()} dollars for ${county}, ${state}, ${units} unit${String(units) === '1' ? '' : 's'}.`);
    }
    alert(`Conforming limit (1–4 unit lookup): $${data.conformingLimit.toLocaleString()} (${data.year})`);
  }

  async function loadMeta() {
    try {
      const [pRes, sRes] = await Promise.all([fetch('/api/gse/products'), fetch('/api/gse/sources')]);
      const products = await pRes.json();
      const sources = await sRes.json();
      if (products.success && $('gseProductCount')) {
        $('gseProductCount').textContent = String((products.products || []).length);
      }
      if (sources.success && sources.data) {
        if (sources.data.disclaimer && $('gseServerDisclaimer')) {
          $('gseServerDisclaimer').textContent = sources.data.disclaimer;
        }
        renderExhibitReferenceLinks(sources.data);
      }
    } catch (_) {
      /* non-fatal */
    }
  }

  function renderList(el, rows, mapFn) {
    if (!el) return;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      el.innerHTML = '<li class="text-muted">None</li>';
      return;
    }
    el.innerHTML = list.map((row) => `<li>${mapFn(row)}</li>`).join('');
  }

  function renderLoanExpertResult(data) {
    const box = $('gseAiResult');
    if (!box) return;
    box.classList.remove('d-none');
    $('gseAiRecommendationTitle').textContent = `Recommendation (${data.expertMode || 'loan expert'})`;
    $('gseAiRecommendationText').textContent = data.recommendation || 'No recommendation available.';
    renderList($('gseAiRationale'), data.rationale || [], (x) => String(x));
    renderList($('gseAiVerifications'), data.requiredVerifications || [], (x) => String(x));
    renderList(
      $('gseAiOverlayRisks'),
      data.overlayRisks || [],
      (x) => `<strong>${x.investor}</strong>: ${x.title} (${x.status}) ${x.operationsNote ? `— ${x.operationsNote}` : ''}`
    );
    renderList(
      $('gseAiCitations'),
      data.citations || [],
      (x) => (x.url ? `<a href="${x.url}" target="_blank" rel="noopener noreferrer">${x.title}</a>` : x.title)
    );
    box.focus({ preventScroll: false });
  }

  async function runLoanExpert(questionText, options = {}) {
    const askBtn = $('btnAskLoanExpert');
    const q = String(questionText || $('gseAiQuestion').value || '').trim();
    if (!q) {
      if (options.voiceFeedback) speak('Enter a question for the AI Loan Program Expert.');
      alert('Enter a question for the AI Loan Program Expert.');
      return;
    }
    setAiStatus('Asking AI Loan Program Expert...', false);
    setBusy(askBtn, true);
    try {
      const body = {
        question: q,
        scenario: readScenarioFromForm()
      };
      const res = await fetch('/api/gse/loan-program-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const msg = (data.errors && data.errors.join('; ')) || data.error || 'Loan expert request failed';
        setAiStatus(`Error: ${msg}`, true);
        if (options.voiceFeedback) speak(msg);
        alert(msg);
        return;
      }
      renderLoanExpertResult(data);
      setAiStatus(`Answer ready • ${data.availableOverlayProfiles || 0} overlay profile(s) loaded.`, false);
    } catch (e) {
      const msg = e.message || String(e);
      setAiStatus(`Error: ${msg}`, true);
      if (options.voiceFeedback) speak(msg);
      alert(msg);
    } finally {
      setBusy(askBtn, false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initProductsGrid();
    initSuggestionsGrid();
    loadMeta();
    $('btnAnalyze').addEventListener('click', runAnalyze);
    $('btnLoanLimits').addEventListener('click', runLoanLimits);
    const loadBtn = $('btnLoadPipeline');
    if (loadBtn) loadBtn.addEventListener('click', loadFromPipeline);
    const stateEl = $('state');
    if (stateEl) {
      stateEl.addEventListener('blur', () => {
        stateEl.value = String(stateEl.value || '').trim().toUpperCase();
      });
    }

    const bindFilter = (id, mode) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', () => {
        productFilter = mode;
        setFilterChipActive(id);
        applyProductFilter();
      });
    };
    bindFilter('gseFilterAll', 'all');
    bindFilter('gseFilterGse', 'gse');
    bindFilter('gseFilterFha', 'fha');
    bindFilter('gseFilterVa', 'va');
    bindFilter('gseFilterUsda', 'usda');
    applyProductFilter();
    initializeVoiceWidget();

    const askBtn = $('btnAskLoanExpert');
    if (askBtn) askBtn.addEventListener('click', () => runLoanExpert());
    document.querySelectorAll('.gse-ai-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt') || '';
        $('gseAiQuestion').value = prompt;
        runLoanExpert(prompt);
      });
    });
  });
})();
