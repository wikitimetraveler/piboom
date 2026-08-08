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

    fillLinkList('gsePoolingLinks', metadata && metadata.poolingExhibitLinks);
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

  let gseAiMode = 'rag';
  const gseChatSessionId = 'gse-loan-program-expert';

  function renderLoanExpertResult(data) {
    const box = $('gseAiResult');
    if (!box) return;
    box.classList.remove('d-none');
    const modeLabel = data.mode || data.expertMode || 'loan expert';
    $('gseAiRecommendationTitle').textContent = `Recommendation (${modeLabel})`;
    $('gseAiRecommendationText').textContent =
      data.recommendation || data.message || data.response || 'No recommendation available.';

    const rationale =
      data.rationale ||
      (data.rules && data.rules.rationale) ||
      (Array.isArray(data.sources)
        ? data.sources.map((s) => `${s.id || ''} ${s.title || ''}`.trim())
        : []);
    const verifications =
      data.requiredVerifications || (data.rules && data.rules.requiredVerifications) || [];
    const overlayRisks = data.overlayRisks || (data.rules && data.rules.overlayRisks) || [];
    const citations =
      data.citations ||
      data.sources ||
      (data.rules && data.rules.citations) ||
      [];

    renderList($('gseAiRationale'), rationale, (x) => String(x));
    renderList($('gseAiVerifications'), verifications, (x) => String(x));
    renderList(
      $('gseAiOverlayRisks'),
      overlayRisks,
      (x) =>
        typeof x === 'string'
          ? x
          : `<strong>${x.investor || 'Investor'}</strong>: ${x.title || ''} (${x.status || ''}) ${
              x.operationsNote ? `— ${x.operationsNote}` : ''
            }`
    );
    renderList($('gseAiCitations'), citations, (x) => {
      if (typeof x === 'string') return x;
      const label = [x.id, x.title].filter(Boolean).join(' · ') || 'Source';
      const meta = [x.retrieval, x.category].filter(Boolean).join(' · ');
      const link = x.url
        ? `<a href="${escapeHtmlAttr(x.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlAttr(label)}</a>`
        : escapeHtmlAttr(label);
      return meta ? `${link} <span class="text-muted">(${escapeHtmlAttr(meta)})</span>` : link;
    });
    box.focus({ preventScroll: false });
  }

  function appendChatBubble(role, text) {
    const thread = $('gseChatThread');
    if (!thread) return;
    thread.classList.remove('d-none');
    const bubble = document.createElement('div');
    bubble.className = `gse-chat-bubble gse-chat-bubble--${role === 'user' ? 'user' : 'assistant'}`;
    bubble.textContent = text;
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  function renderKnowledgeBars(counts = {}) {
    const host = $('gseKnowledgeBars');
    if (!host) return;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      host.innerHTML = '<p class="small text-muted mb-0">No indexed categories yet. Run <code>npm run build:gse-knowledge</code>.</p>';
      return;
    }
    const max = Math.max(...entries.map(([, n]) => n), 1);
    host.innerHTML = entries
      .map(([name, n]) => {
        const pct = Math.max(8, Math.round((n / max) * 100));
        return `<div class="gse-knowledge-bar-row">
          <span>${escapeHtmlAttr(name)}</span>
          <div class="gse-knowledge-bar-track" aria-hidden="true"><div class="gse-knowledge-bar-fill" style="width:${pct}%"></div></div>
          <span>${n}</span>
        </div>`;
      })
      .join('');
  }

  function layoutKnowledgeGraph(nodes = []) {
    const width = 640;
    const height = 320;
    const cx = width / 2;
    const cy = height / 2;
    const positioned = new Map();
    const hubs = nodes.filter((n) => n.kind === 'hub');
    const cats = nodes.filter((n) => n.kind === 'category');
    const docs = nodes.filter((n) => n.kind === 'document');

    hubs.forEach((n) => positioned.set(n.id, { x: cx, y: cy, ...n }));

    cats.forEach((n, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(cats.length, 1) - Math.PI / 2;
      const r = 105;
      positioned.set(n.id, {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        ...n
      });
    });

    docs.forEach((n, i) => {
      const parentCat = String(n.meta?.category || '');
      const parent = positioned.get(`cat:${parentCat}`) || { x: cx, y: cy };
      const siblings = docs.filter((d) => (d.meta?.category || '') === parentCat);
      const idx = siblings.findIndex((d) => d.id === n.id);
      const angle = (Math.PI * 2 * (idx >= 0 ? idx : i)) / Math.max(siblings.length, 1);
      const r = 48;
      positioned.set(n.id, {
        x: parent.x + Math.cos(angle) * r,
        y: parent.y + Math.sin(angle) * r,
        ...n
      });
    });

    return positioned;
  }

  function renderKnowledgeGraph(graph) {
    const svg = $('gseKnowledgeGraph');
    if (!svg) return;
    const nodes = graph?.nodes || [];
    const links = graph?.links || [];
    const positioned = layoutKnowledgeGraph(nodes);

    const linkSvg = links
      .map((link) => {
        const a = positioned.get(link.source);
        const b = positioned.get(link.target);
        if (!a || !b) return '';
        const opacity = link.kind === 'contains' ? 0.45 : 0.28;
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#64748b" stroke-opacity="${opacity}" stroke-width="1.2" />`;
      })
      .join('');

    const nodeSvg = [...positioned.values()]
      .map((n) => {
        const fill =
          n.kind === 'hub' ? '#0f766e' : n.kind === 'category' ? '#2563eb' : '#94a3b8';
        const r = n.kind === 'hub' ? 22 : n.kind === 'category' ? 14 : 7;
        const label =
          n.kind === 'document'
            ? ''
            : `<text x="${n.x}" y="${n.y + r + 12}" text-anchor="middle" font-size="11" fill="#334155">${escapeHtmlAttr(
                String(n.label || '').slice(0, 18)
              )}</text>`;
        const title = escapeHtmlAttr(
          `${n.label || ''}${n.meta?.count != null ? ` (${n.meta.count})` : ''}${
            n.meta?.excerpt ? ` — ${n.meta.excerpt}` : ''
          }`
        );
        return `<g>
          <title>${title}</title>
          <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="2" />
          ${label}
        </g>`;
      })
      .join('');

    svg.innerHTML = `${linkSvg}${nodeSvg}`;
    const caption = $('gseKnowledgeGraphCaption');
    if (caption && graph?.summary) {
      const s = graph.summary;
      caption.textContent = `${s.totalRecords || 0} slips · ${s.vectorCount || 0} vectors · indexed ${
        s.lastIndexed ? new Date(s.lastIndexed).toLocaleString() : 'n/a'
      }`;
    }
  }

  function renderKnowledgeHits(rows = []) {
    const host = $('gseKnowledgeHits');
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = '<li class="text-muted">No matches in the knowledge bank.</li>';
      return;
    }
    host.innerHTML = rows
      .map((row) => {
        const title = escapeHtmlAttr(row.title || 'Untitled');
        const meta = escapeHtmlAttr(
          [row.retrieval, row.category, row.score != null ? `score ${Number(row.score).toFixed(2)}` : '']
            .filter(Boolean)
            .join(' · ')
        );
        const excerpt = escapeHtmlAttr(String(row.content || '').slice(0, 180));
        const link = row.url
          ? `<a href="${escapeHtmlAttr(row.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
          : title;
        return `<li><div><strong>${link}</strong></div><div class="gse-hit-meta">${meta}</div><div>${excerpt}</div></li>`;
      })
      .join('');
  }

  async function loadKnowledgeBank() {
    const badge = $('gseKnowledgeBadge');
    try {
      const [healthRes, graphRes] = await Promise.all([
        fetch('/api/gse-assistant/health'),
        fetch('/api/gse-assistant/graph?limit=3')
      ]);
      const health = await healthRes.json().catch(() => ({}));
      const graph = await graphRes.json().catch(() => ({}));
      const k = health.knowledge || graph.summary || {};
      if (badge) {
        const vectors = k.vectorCount || 0;
        const docs = k.totalRecords || 0;
        const openai = health.openaiConfigured ? 'OpenAI on' : 'OpenAI off';
        badge.textContent = `${docs} docs · ${vectors} vectors · ${openai}`;
        badge.className = `badge rounded-pill border ${
          docs > 0 ? 'text-bg-success' : 'text-bg-warning'
        }`;
      }
      renderKnowledgeBars(k.counts || {});
      if (graph.nodes) renderKnowledgeGraph(graph);
    } catch (_) {
      if (badge) {
        badge.textContent = 'Knowledge unavailable';
        badge.className = 'badge rounded-pill text-bg-warning border';
      }
    }
  }

  async function runKnowledgeSearch(queryText) {
    const q = String(queryText || $('gseKnowledgeSearch')?.value || '').trim();
    if (!q) return;
    try {
      const res = await fetch(`/api/gse-assistant/search?q=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      renderKnowledgeHits(data.data || []);
    } catch (e) {
      renderKnowledgeHits([]);
      setAiStatus(`Knowledge search error: ${e.message || e}`, true);
    }
  }

  async function runRulesExpert(questionText, options = {}) {
    const askBtn = $('btnAskLoanExpert');
    const q = String(questionText || $('gseAiQuestion').value || '').trim();
    if (!q) {
      if (options.voiceFeedback) speak('Enter a question for the AI Loan Program Expert.');
      alert('Enter a question for the AI Loan Program Expert.');
      return;
    }
    setAiStatus('Asking quick-rules expert...', false);
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
      appendChatBubble('user', q);
      appendChatBubble('assistant', data.recommendation || 'No recommendation.');
      renderLoanExpertResult({ ...data, mode: 'rules' });
      setAiStatus(`Rules answer ready • ${data.availableOverlayProfiles || 0} overlay profile(s).`, false);
    } catch (e) {
      const msg = e.message || String(e);
      setAiStatus(`Error: ${msg}`, true);
      if (options.voiceFeedback) speak(msg);
      alert(msg);
    } finally {
      setBusy(askBtn, false);
    }
  }

  async function runRagExpert(questionText, options = {}) {
    const askBtn = $('btnAskLoanExpert');
    const q = String(questionText || $('gseAiQuestion').value || '').trim();
    if (!q) {
      if (options.voiceFeedback) speak('Enter a question for the AI Loan Program Expert.');
      alert('Enter a question for the AI Loan Program Expert.');
      return;
    }
    setAiStatus('Searching knowledge bank + asking RAG expert...', false);
    setBusy(askBtn, true);
    appendChatBubble('user', q);
    try {
      runKnowledgeSearch(q);
      const body = {
        message: q,
        scenario: readScenarioFromForm(),
        sessionId: gseChatSessionId,
        includeRules: true
      };
      const res = await fetch('/api/gse-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        const msg = data.error || data.details || 'RAG expert request failed';
        setAiStatus(`Error: ${msg}`, true);
        appendChatBubble('assistant', msg);
        if (options.voiceFeedback) speak(msg);
        if (data.sources) renderKnowledgeHits(data.context || data.sources);
        return;
      }
      const answer = data.message || data.response || data.recommendation || 'No answer.';
      appendChatBubble('assistant', answer);
      renderLoanExpertResult(data);
      if (Array.isArray(data.context)) renderKnowledgeHits(data.context);
      const srcCount = Array.isArray(data.sources) ? data.sources.length : 0;
      const k = data.knowledge || {};
      setAiStatus(
        `RAG answer ready • ${srcCount} source(s) · ${k.vectorCount || 0} vector(s) · mode ${data.mode || 'rag-chat'}`,
        false
      );
      if (options.voiceFeedback) speak(answer.slice(0, 280));
    } catch (e) {
      const msg = e.message || String(e);
      setAiStatus(`Error: ${msg}`, true);
      appendChatBubble('assistant', msg);
      if (options.voiceFeedback) speak(msg);
    } finally {
      setBusy(askBtn, false);
    }
  }

  async function runLoanExpert(questionText, options = {}) {
    if (gseAiMode === 'rules') return runRulesExpert(questionText, options);
    return runRagExpert(questionText, options);
  }

  async function clearGseChat() {
    try {
      await fetch(
        `/api/gse-assistant/history?sessionId=${encodeURIComponent(gseChatSessionId)}`,
        { method: 'DELETE' }
      );
      const thread = $('gseChatThread');
      if (thread) {
        thread.innerHTML = '';
        thread.classList.add('d-none');
      }
      setAiStatus('Chat memory cleared for this session.', false);
    } catch (e) {
      setAiStatus(`Clear failed: ${e.message || e}`, true);
    }
  }

  function setAiMode(mode) {
    gseAiMode = mode === 'rules' ? 'rules' : 'rag';
    document.querySelectorAll('[data-gse-ai-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-gse-ai-mode') === gseAiMode);
    });
    setAiStatus(
      gseAiMode === 'rules'
        ? 'Quick rules mode → /api/gse/loan-program-expert'
        : 'Knowledge RAG mode → /api/gse-assistant/chat (+ Postgres bank)',
      false
    );
  }

  document.addEventListener('DOMContentLoaded', () => {
    initProductsGrid();
    initSuggestionsGrid();
    loadMeta();
    loadKnowledgeBank();
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
    document.querySelectorAll('[data-gse-ai-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setAiMode(btn.getAttribute('data-gse-ai-mode')));
    });
    const refreshBtn = $('btnRefreshGseKnowledge');
    if (refreshBtn) refreshBtn.addEventListener('click', loadKnowledgeBank);
    const searchBtn = $('btnGseKnowledgeSearch');
    if (searchBtn) searchBtn.addEventListener('click', () => runKnowledgeSearch());
    const searchInput = $('gseKnowledgeSearch');
    if (searchInput) {
      searchInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          runKnowledgeSearch();
        }
      });
    }
    const clearBtn = $('btnClearGseChat');
    if (clearBtn) clearBtn.addEventListener('click', clearGseChat);
    setAiMode('rag');
  });
})();
