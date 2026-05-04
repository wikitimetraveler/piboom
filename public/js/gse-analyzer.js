/* global agGrid */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let productsApi;
  let suggestionsApi;

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
        county: $('county').value.trim()
      },
      risk: {
        dti: Number($('dti').value),
        reservesMonths: Number($('reservesMonths').value)
      }
    };
  }

  function setSummary(summary, warnings) {
    $('gseBestFit').textContent = summary ? summary.bestFit : '—';
    $('gseRisk').textContent = summary ? summary.riskLevel : '—';
    $('gseConf').textContent = summary ? summary.conformingStatus : '—';
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
  }

  async function runAnalyze() {
    const btn = $('btnAnalyze');
    btn.disabled = true;
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
        alert(msg);
        return;
      }
      setSummary(data.summary, data.warnings);
      if (productsApi) productsApi.setGridOption('rowData', data.products || []);
      if (suggestionsApi) {
        suggestionsApi.setGridOption(
          'rowData',
          (data.suggestions || []).map((t) => ({ text: t }))
        );
      }
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      btn.disabled = false;
    }
  }

  async function runLoanLimits() {
    const state = $('state').value.trim();
    const county = $('county').value.trim();
    const units = $('units').value || '1';
    const res = await fetch(`/api/gse/loan-limits?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}&units=${encodeURIComponent(units)}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Lookup failed');
      return;
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
      if (sources.success && sources.data && sources.data.disclaimer && $('gseServerDisclaimer')) {
        $('gseServerDisclaimer').textContent = sources.data.disclaimer;
      }
    } catch (_) {
      /* non-fatal */
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initProductsGrid();
    initSuggestionsGrid();
    loadMeta();
    $('btnAnalyze').addEventListener('click', runAnalyze);
    $('btnLoanLimits').addEventListener('click', runLoanLimits);
  });
})();
