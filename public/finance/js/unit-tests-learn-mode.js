/**
 * Learn Mode for Unit Tests
 * Trains from parser logic + worked examples to produce:
 * 1) Unit-test templates
 * 2) Node parser improvement suggestions
 * 3) Optional VB evaluation notes
 */
(function () {
  const STORAGE_KEY = 'unitTestsLearnModeExamplesV1';
  const STATE_STORAGE_KEY = 'unitTestsLearnModePatternStateV1';
  const PARSER_HINTS_KEY = 'customFieldCalcParserLearnedSetHintsV1';
  const MAX_LIBRARY_ITEMS = 25;

  let lastLearnExample = null;

  function coerceCellValue(raw) {
    const t = String(raw == null ? '' : raw).trim();
    if (!t) return undefined;
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      const n = Number(t);
      if (Number.isFinite(n)) return n;
    }
    return t;
  }

  function scenarioKeysFromRow(row) {
    if (!row || typeof row !== 'object') return [];
    const keys = Object.keys(row);
    const pairs = [];
    for (let k = 0; k < keys.length; k += 1) {
      const key = keys[k];
      const m1 = key.match(/^Test\s*(\d+)$/i);
      const m2 = key.match(/^Scenario\s*(\d+)$/i);
      const mi = m1 || m2;
      if (mi) {
        pairs.push({ key: key, index: Math.max(0, parseInt(mi[1], 10) - 1) });
      }
    }
    pairs.sort(function (a, b) {
      return a.index - b.index;
    });
    return pairs;
  }

  /**
   * Build normalized fieldId -> SET values from unit-test grid rows (Learn Mode right panel).
   * @returns {Record<string, { source: string, valuesByScenarioIndex: Record<string, string|number> }>}
   */
  function distillSetHintsFromCaseRows(caseRows, sourceNote) {
    const hints = {};
    if (!Array.isArray(caseRows) || !window.customFieldCalcParser || typeof window.customFieldCalcParser.normalizeFieldIdForLookup !== 'function') {
      return hints;
    }
    const normFn = window.customFieldCalcParser.normalizeFieldIdForLookup;
    for (let r = 0; r < caseRows.length; r += 1) {
      const row = caseRows[r];
      if (!row) continue;
      const action = String(row.Action || '').trim().toUpperCase();
      if (action !== 'SET') continue;
      const target = String(row.Target || '').trim();
      const bm = target.match(/^\[([^\]]+)\]$/);
      if (!bm) continue;
      const norm = normFn(bm[1]);
      if (!norm) continue;
      const scenPairs = scenarioKeysFromRow(row);
      if (!scenPairs.length) continue;
      if (!hints[norm]) {
        hints[norm] = { source: sourceNote || 'learn-mode', valuesByScenarioIndex: {} };
      }
      for (let s = 0; s < scenPairs.length; s += 1) {
        const co = coerceCellValue(row[scenPairs[s].key]);
        if (co !== undefined) {
          hints[norm].valuesByScenarioIndex[String(scenPairs[s].index)] = co;
        }
      }
      hints[norm].source = sourceNote || hints[norm].source;
    }
    return hints;
  }

  function persistParserSetHintsFromExample(example) {
    try {
      if (!example || !Array.isArray(example.caseRows)) return;
      const distilled = distillSetHintsFromCaseRows(example.caseRows, example.createdAt || 'learn-mode');
      const ids = Object.keys(distilled);
      if (!ids.length) return;
      if (typeof localStorage === 'undefined') return;
      const doc = { version: 1, hints: {}, updatedAt: null };
      try {
        const raw = localStorage.getItem(PARSER_HINTS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && p.hints && typeof p.hints === 'object') {
            doc.hints = Object.assign({}, p.hints);
          }
        }
      } catch (_parse) {}
      for (let i = 0; i < ids.length; i += 1) {
        doc.hints[ids[i]] = distilled[ids[i]];
      }
      doc.updatedAt = new Date().toISOString();
      localStorage.setItem(PARSER_HINTS_KEY, JSON.stringify(doc));
      if (window.customFieldCalcParser && typeof window.customFieldCalcParser.reloadLearnedSetHintsCache === 'function') {
        window.customFieldCalcParser.reloadLearnedSetHintsCache();
      }
    } catch (_e) {}
  }

  const parserLogicInput = document.getElementById('learnModeParserLogicInput');
  const caseTextInput = document.getElementById('learnModeCaseTextInput');
  const excelInput = document.getElementById('learnModeExcelInput');
  const saveToLibraryInput = document.getElementById('learnModeSaveToLibrary');
  const enableVBEvalInput = document.getElementById('learnModeEnableVBEval');
  const runBtn = document.getElementById('learnModeRunBtn');
  const promoteBtn = document.getElementById('learnModePromoteBtn');
  const clearBtn = document.getElementById('learnModeClearBtn');
  const approvalNoteInput = document.getElementById('learnModeApprovalNoteInput');
  const statusEl = document.getElementById('learnModeStatus');
  const libraryListEl = document.getElementById('learnModeLibraryList');
  const templateOutputEl = document.getElementById('learnModeTemplateOutput');
  const parserOutputEl = document.getElementById('learnModeParserOutput');
  const vbOutputEl = document.getElementById('learnModeVBOutput');
  const qualityThresholdInput = document.getElementById('learnModeQualityThresholdInput');
  const minImprovementInput = document.getElementById('learnModeMinImprovementInput');
  const stateOutputEl = document.getElementById('learnModeStateOutput');
  const benchmarkOutputEl = document.getElementById('learnModeBenchmarkOutput');

  if (!parserLogicInput || !caseTextInput || !runBtn) {
    return;
  }

  let sessionExamples = [];
  let lastLifecycle = null;
  let lastConfidence = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.classList.remove('text-muted', 'text-success', 'text-danger', 'text-warning');
    if (tone === 'ok') statusEl.classList.add('text-success');
    else if (tone === 'err') statusEl.classList.add('text-danger');
    else if (tone === 'warn') statusEl.classList.add('text-warning');
    else statusEl.classList.add('text-muted');
    statusEl.textContent = message;
  }

  function getLibraryExamples() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function saveLibraryExamples(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_LIBRARY_ITEMS)));
    } catch (_err) {
      // ignore storage errors
    }
  }

  function getPatternState() {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function savePatternState(state) {
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (_err) {
      // ignore storage errors
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderLibrary() {
    if (!libraryListEl) return;
    const items = getLibraryExamples();
    if (!items.length) {
      libraryListEl.innerHTML = 'No saved examples yet.';
      return;
    }
    const rows = items.map((item, idx) => {
      const stamp = new Date(item.createdAt || Date.now()).toLocaleString();
      const parserSnippet = (item.parserLogic || '').slice(0, 70).replace(/\s+/g, ' ');
      return (
        '<div class="d-flex justify-content-between align-items-start border-bottom py-2 gap-2">' +
          '<div>' +
            '<div class="fw-semibold">Example ' + (idx + 1) + '</div>' +
            '<div class="text-muted"><small>' + escapeHtml(stamp) + '</small></div>' +
            '<div><small class="font-monospace">' + escapeHtml(parserSnippet) + (parserSnippet.length >= 70 ? '...' : '') + '</small></div>' +
          '</div>' +
          '<button type="button" class="btn btn-sm btn-outline-danger learn-mode-remove-btn" data-index="' + idx + '">Remove</button>' +
        '</div>'
      );
    });
    libraryListEl.innerHTML = rows.join('');

    const removeButtons = libraryListEl.querySelectorAll('.learn-mode-remove-btn');
    removeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-index'));
        if (Number.isNaN(idx)) return;
        const next = getLibraryExamples().filter((_, i) => i !== idx);
        saveLibraryExamples(next);
        renderLibrary();
        setStatus('Removed saved example.', 'ok');
      });
    });
  }

  function parseDelimitedRows(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(delimiter).map((c) => c.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h || ('col' + idx)] = cols[idx] || '';
      });
      rows.push(row);
    }
    return rows;
  }

  function normalizeHeaderName(name) {
    const raw = String(name || '').trim();
    const normalized = raw.toLowerCase().replace(/\s+/g, '');
    if (normalized === 'step') return 'Step';
    if (normalized === 'action') return 'Action';
    if (normalized === 'target') return 'Target';
    if (normalized === 'description' || normalized === 'descriptio' || normalized === 'descr') return 'Description';
    if (/^test\d+$/.test(normalized)) return 'Test ' + normalized.replace('test', '');
    if (/^test/.test(normalized)) return raw || 'Test';
    return raw || 'Column';
  }

  function splitGridLine(line, delimiter) {
    if (delimiter === 'tab') return line.split('\t').map((part) => part.trim());
    if (delimiter === 'csv') return line.split(',').map((part) => part.trim());
    return line.split(/\s{2,}/).map((part) => part.trim());
  }

  function parseUnitTestGridRows(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.replace(/\u00a0/g, ' ').trimRight())
      .filter((line) => line.trim().length > 0);
    if (!lines.length) return [];

    const headerIndex = lines.findIndex((line) => /step/i.test(line) && /action/i.test(line) && /target/i.test(line));
    if (headerIndex === -1) return [];

    const headerLine = lines[headerIndex];
    const delimiter = headerLine.includes('\t') ? 'tab' : (headerLine.includes(',') ? 'csv' : 'fixed');
    const headers = splitGridLine(headerLine, delimiter).map(normalizeHeaderName).filter(Boolean);

    const rows = [];
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      const cells = splitGridLine(lines[i], delimiter);
      if (!cells.length) continue;
      const first = String(cells[0] || '').trim();
      const second = String(cells[1] || '').trim().toUpperCase();
      const looksLikeRow = /^\d+$/.test(first) || ['SET', 'GET', 'COMPARE'].includes(second);
      if (!looksLikeRow) continue;

      const row = {};
      headers.forEach((header, idx) => {
        row[header] = String(cells[idx] || '').trim();
      });
      if (!row.Step && /^\d+$/.test(first)) row.Step = first;
      if (!row.Action && second) row.Action = second;
      rows.push(row);
    }
    return rows;
  }

  function extractVBSignals(vbText) {
    const text = String(vbText || '');
    const fieldIds = [];
    const fieldRegex = /\[([A-Za-z0-9._]+)\]/g;
    let m = fieldRegex.exec(text);
    while (m) {
      fieldIds.push(m[1]);
      m = fieldRegex.exec(text);
    }
    const uniqueFields = Array.from(new Set(fieldIds));
    return {
      fieldIds: uniqueFields,
      hasIfThen: /\bIf\b[\s\S]*\bThen\b/i.test(text),
      hasFail: /\bFail\b/i.test(text),
      andAlsoCount: (text.match(/\bAndAlso\b/gi) || []).length,
      orElseCount: (text.match(/\bOrElse\b/gi) || []).length
    };
  }

  function parseCaseRows(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return [];

    const gridRows = parseUnitTestGridRows(trimmed);
    if (gridRows.length) return gridRows;

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
      } catch (_err) {
        // fallback to delimited parse
      }
    }
    return parseDelimitedRows(trimmed);
  }

  async function readExcelAsCsvLikeText(file) {
    if (!file) return '';
    const lower = String(file.name || '').toLowerCase();

    if (lower.endsWith('.csv')) {
      return file.text();
    }

    const ExcelJS = window.ExcelJS;
    if (!ExcelJS) {
      throw new Error('Excel parser is unavailable. Please paste rows or upload CSV.');
    }
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const firstSheet = workbook.worksheets[0];
    if (!firstSheet) return '';

    const rows = [];
    firstSheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values || []).slice(1).map((v) => String(v == null ? '' : v));
      rows.push(values.join(','));
    });
    return rows.join('\n');
  }

  function computeQualityScore(parserLogic, rows) {
    const vbSignals = extractVBSignals(parserLogic);
    let score = 0;
    if (parserLogic.length > 80) score += 30;
    else if (parserLogic.length > 20) score += 20;
    else score += 10;

    if (rows.length >= 10) score += 30;
    else if (rows.length >= 4) score += 20;
    else if (rows.length >= 1) score += 10;

    const rowKeys = rows.length ? Object.keys(rows[0] || {}) : [];
    if (rowKeys.length >= 3) score += 25;
    else if (rowKeys.length >= 1) score += 15;

    if (vbSignals.fieldIds.length >= 2) score += 10;
    if (vbSignals.hasIfThen) score += 5;
    if (vbSignals.hasFail) score += 5;

    const hasEdgeHints = /edge|null|blank|error|invalid|missing/i.test(JSON.stringify(rows).slice(0, 3000));
    if (hasEdgeHints) score += 15;
    return Math.min(100, score);
  }

  function getThresholds() {
    const qualityThreshold = clamp(Number(qualityThresholdInput?.value || 60), 0, 100);
    const minImprovement = clamp(Number(minImprovementInput?.value || 0), 0, 100);
    return { qualityThreshold, minImprovement };
  }

  function deriveExampleStats(example) {
    const rows = example.caseRows || [];
    let missingRows = 0;
    let edgeRows = 0;
    let expectedRows = 0;
    let normalizedRows = 0;
    rows.forEach((row) => {
      const values = Object.values(row || {});
      const keyString = Object.keys(row || {}).join(' ').toLowerCase();
      const rowText = values.join(' ').toLowerCase();
      const hasMissing = values.some((value) => {
        const s = String(value || '').trim().toLowerCase();
        return s === '' || s === 'null' || s === 'undefined' || s === 'missing';
      });
      if (hasMissing) missingRows += 1;
      if (/edge|invalid|error|blank|null|missing/.test(rowText + ' ' + keyString)) edgeRows += 1;
      if (/expected|assert|result|output/.test(keyString)) expectedRows += 1;
      if (/normalized|coerce|trim|fallback/.test(rowText + ' ' + keyString)) normalizedRows += 1;
    });
    return { totalRows: rows.length, missingRows, edgeRows, expectedRows, normalizedRows };
  }

  function runBenchmarkSuite(candidateExample, baselineState) {
    const stats = deriveExampleStats(candidateExample);
    const qualityNormalized = candidateExample.qualityScore / 100;
    const rowCoverage = Math.min(1, stats.totalRows / 12);
    const edgeCoverage = stats.totalRows ? Math.min(1, stats.edgeRows / stats.totalRows) : 0;
    const expectedCoverage = stats.totalRows ? Math.min(1, stats.expectedRows / stats.totalRows) : 0;
    const missingPenalty = stats.totalRows ? Math.min(0.35, (stats.missingRows / stats.totalRows) * 0.35) : 0;

    const easyPassRate = clamp(Math.round((0.45 + qualityNormalized * 0.45 + rowCoverage * 0.1) * 100), 0, 100);
    const mediumPassRate = clamp(Math.round((0.35 + qualityNormalized * 0.4 + edgeCoverage * 0.15 + expectedCoverage * 0.1 - missingPenalty) * 100), 0, 100);
    const hardPassRate = clamp(Math.round((0.25 + qualityNormalized * 0.35 + edgeCoverage * 0.2 + expectedCoverage * 0.15 - missingPenalty * 1.2) * 100), 0, 100);
    const edgePassRate = clamp(Math.round((0.2 + qualityNormalized * 0.25 + edgeCoverage * 0.35 + expectedCoverage * 0.1 - missingPenalty) * 100), 0, 100);

    const benchmarkPassRate = Math.round((easyPassRate * 0.25) + (mediumPassRate * 0.3) + (hardPassRate * 0.25) + (edgePassRate * 0.2));
    const baselinePassRate = baselineState?.approved?.benchmarkPassRate || baselineState?.validated?.benchmarkPassRate || 70;
    const regressionDelta = benchmarkPassRate - baselinePassRate;
    const criticalMisparseRate = clamp(
      Math.round(((stats.totalRows ? stats.missingRows / stats.totalRows : 0) * 50) + ((1 - expectedCoverage) * 20)),
      0,
      100
    );
    const baselineCritical = baselineState?.approved?.criticalMisparseRate || baselineState?.validated?.criticalMisparseRate || 15;
    const criticalRegression = criticalMisparseRate - baselineCritical;

    return {
      easyPassRate,
      mediumPassRate,
      hardPassRate,
      edgePassRate,
      benchmarkPassRate,
      baselinePassRate,
      regressionDelta,
      criticalMisparseRate,
      baselineCritical,
      criticalRegression
    };
  }

  function computeConfidence(candidateExample, benchmark) {
    const supportCount = sessionExamples.length + getLibraryExamples().length;
    const supportScore = Math.min(1, supportCount / 8);
    const qualityScore = candidateExample.qualityScore / 100;
    const stabilityScore = benchmark.benchmarkPassRate / 100;
    const agreementScore = clamp(
      ((benchmark.easyPassRate + benchmark.mediumPassRate + benchmark.hardPassRate + benchmark.edgePassRate) / 4) / 100,
      0,
      1
    );
    const confidenceScore = Math.round((supportScore * 0.2 + qualityScore * 0.35 + stabilityScore * 0.3 + agreementScore * 0.15) * 100);
    const label = confidenceScore >= 80 ? 'high' : confidenceScore >= 60 ? 'medium' : 'low';
    return {
      confidenceScore,
      confidenceLabel: label,
      factors: { supportScore, qualityScore, stabilityScore, agreementScore, supportCount }
    };
  }

  function evaluateGate(candidateExample, benchmark, confidence) {
    const { qualityThreshold, minImprovement } = getThresholds();
    const qualityPass = candidateExample.qualityScore >= qualityThreshold;
    const regressionPass = benchmark.regressionDelta >= minImprovement;
    const criticalPass = benchmark.criticalRegression <= 0;
    const gatePass = qualityPass && regressionPass && criticalPass;
    return {
      qualityThreshold,
      minImprovement,
      qualityPass,
      regressionPass,
      criticalPass,
      gatePass,
      reason: gatePass
        ? 'Candidate passed quality and regression gates.'
        : [
            qualityPass ? null : 'Quality below threshold',
            regressionPass ? null : 'Benchmark did not beat baseline by required margin',
            criticalPass ? null : 'Critical misparse regression detected'
          ].filter(Boolean).join('; '),
      confidenceLabel: confidence.confidenceLabel
    };
  }

  function buildLifecycleState(candidateExample, benchmark, gate, confidence) {
    const now = new Date().toISOString();
    if (!gate.qualityPass) {
      return {
        phase: 'candidate',
        reason: gate.reason,
        evaluatedAt: now,
        qualityScore: candidateExample.qualityScore,
        benchmarkPassRate: benchmark.benchmarkPassRate,
        criticalMisparseRate: benchmark.criticalMisparseRate,
        confidenceScore: confidence.confidenceScore,
        confidenceLabel: confidence.confidenceLabel
      };
    }
    if (gate.gatePass && confidence.confidenceScore >= 70) {
      return {
        phase: 'approved',
        reason: 'Passed all gates and confidence is strong enough for default adoption.',
        evaluatedAt: now,
        qualityScore: candidateExample.qualityScore,
        benchmarkPassRate: benchmark.benchmarkPassRate,
        criticalMisparseRate: benchmark.criticalMisparseRate,
        confidenceScore: confidence.confidenceScore,
        confidenceLabel: confidence.confidenceLabel
      };
    }
    return {
      phase: 'validated',
      reason: gate.gatePass
        ? 'Passed hard gates but confidence is not yet high enough for auto-approval.'
        : gate.reason,
      evaluatedAt: now,
      qualityScore: candidateExample.qualityScore,
      benchmarkPassRate: benchmark.benchmarkPassRate,
      criticalMisparseRate: benchmark.criticalMisparseRate,
      confidenceScore: confidence.confidenceScore,
      confidenceLabel: confidence.confidenceLabel
    };
  }

  function buildTemplateOutput(allExamples) {
    const latest = allExamples[0] || { parserLogic: '', caseRows: [] };
    const vbSignals = extractVBSignals(latest.parserLogic);
    const rows = latest.caseRows || [];
    const existingTargets = new Set(rows.map((r) => String(r.Target || '').replace(/[\[\]]/g, '')).filter(Boolean));
    const missingFields = vbSignals.fieldIds.filter((id) => !existingTargets.has(id.replace(/^\[|\]$/g, '')));

    const correctedRows = [];
    let nextStep = rows.reduce((max, row) => Math.max(max, Number(row.Step || 0)), 0) + 1;
    const firstScenarioCol = (function () {
      const preferred = ['Test 1', 'Test1', 'Scenario 1', 'Scenario1'];
      const sample = rows[0] || {};
      for (let i = 0; i < preferred.length; i += 1) {
        if (Object.prototype.hasOwnProperty.call(sample, preferred[i])) return preferred[i];
      }
      const dynamic = Object.keys(sample).find((key) => /^test\s*\d+$/i.test(key) || /^scenario\s*\d+$/i.test(key));
      return dynamic || 'Test 1';
    })();

    function mkRow(step, action, target, description, testVal) {
      const row = {
        Step: String(step),
        Action: action,
        Target: target,
        Description: description
      };
      row[firstScenarioCol] = testVal || '';
      return row;
    }

    // House order: SET rows first, then GET rows
    missingFields.forEach((fieldId) => {
      correctedRows.push(mkRow(nextStep++, 'SET', '[' + fieldId + ']', 'Auto-added from VB field', 'TODO'));
    });
    missingFields.forEach((fieldId) => {
      correctedRows.push(mkRow(nextStep++, 'GET', '[' + fieldId + ']', 'Auto-added validation read', ''));
    });

    const hasActualResultRow = rows.some((row) => /actual\s*result/i.test(String(row.Description || ''))) ||
      rows.some((row) => /actual\s*res/i.test(String(row.Target || '')));
    const hasOverallTestRow = rows.some((row) => /overall\s*test\s*result/i.test(String(row.Description || ''))) ||
      rows.some((row) => /overall\s*te/i.test(String(row.Target || '')));
    const compareRows = rows.filter((row) => String(row.Action || '').toUpperCase() === 'COMPARE').length;

    const summaryRows = [];
    if (!compareRows) {
      summaryRows.push(mkRow(nextStep++, 'COMPARE', '[RESULT]', 'Actual Result', 'EXPECTED'));
    } else if (!hasActualResultRow) {
      summaryRows.push(mkRow(nextStep++, 'COMPARE', '[RESULT]', 'Actual Result', 'EXPECTED'));
    }
    if (!hasOverallTestRow) {
      summaryRows.push(mkRow(nextStep++, 'COMPARE', '[OVERALL.TEST.RESULT]', 'Overall Test Result', 'PASS'));
    }

    const generated = correctedRows.concat(summaryRows);
    if (!generated.length) {
      return [
        'No missing fields detected between VB and test grid.',
        'Your pasted unit-test rows already cover the VB-referenced fields.',
        '',
        'Tip: include edge rows with null/blank/invalid values to strengthen training.'
      ].join('\n');
    }

    const cols = ['Step', 'Action', 'Target', 'Description', firstScenarioCol];
    const csvLines = [cols.join(',')].concat(
      generated.map((row) => cols.map((col) => '"' + String(row[col] || '').replace(/"/g, '""') + '"').join(','))
    );

    return [
      'Generated ' + generated.length + ' house-format row(s) from VB + pasted unit-test grid.',
      'Order applied: SET -> GET -> Actual Result -> Overall Test Result',
      '',
      'CSV rows (copy/paste into your test sheet):',
      csvLines.join('\n')
    ].join('\n');
  }

  function buildParserSuggestions(allExamples, lifecycle, confidence) {
    const latest = allExamples[0] || { parserLogic: '', caseRows: [] };
    const vbSignals = extractVBSignals(latest.parserLogic);
    const totalRows = allExamples.reduce((sum, ex) => sum + ex.caseRows.length, 0);
    const avgQuality = allExamples.length
      ? Math.round(allExamples.reduce((sum, ex) => sum + ex.qualityScore, 0) / allExamples.length)
      : 0;
    return [
      'Node parser recommendation summary',
      '- Evidence: ' + allExamples.length + ' examples, ' + totalRows + ' rows, avg quality ' + avgQuality + '/100',
      '- VB signals: ' + vbSignals.fieldIds.length + ' fields, AndAlso=' + vbSignals.andAlsoCount + ', OrElse=' + vbSignals.orElseCount,
      '- Confidence: ' + confidence.confidenceLabel.toUpperCase() + ' (' + confidence.confidenceScore + '/100)',
      '- Lifecycle state: ' + lifecycle.phase.toUpperCase(),
      '',
      '1) Normalize inputs once at parser boundary',
      '- Trim strings, unify null/blank handling, and coerce known numeric/date fields early.',
      '',
      '2) Apply deterministic rule ordering',
      '- Run validation rules before enrichment rules to avoid cascading misparse behavior.',
      '',
      '3) Add schema-aware fallback paths',
      '- When a field is missing, assign safe defaults and emit structured diagnostics.',
      '',
      '4) Track parse confidence tags',
      '- Emit per-row confidence metadata for downstream review (high/medium/low).'
    ].join('\n');
  }

  function buildBenchmarkOutput(benchmark, gate) {
    return [
      'Benchmark set results',
      '- easy: ' + benchmark.easyPassRate + '%',
      '- medium: ' + benchmark.mediumPassRate + '%',
      '- hard: ' + benchmark.hardPassRate + '%',
      '- edge: ' + benchmark.edgePassRate + '%',
      '',
      'Regression gate',
      '- baseline pass rate: ' + benchmark.baselinePassRate + '%',
      '- candidate pass rate: ' + benchmark.benchmarkPassRate + '%',
      '- delta: ' + benchmark.regressionDelta + '% (required: +' + gate.minImprovement + '%)',
      '- baseline critical misparse: ' + benchmark.baselineCritical + '%',
      '- candidate critical misparse: ' + benchmark.criticalMisparseRate + '%',
      '- critical delta: ' + benchmark.criticalRegression + '%',
      '- gate: ' + (gate.gatePass ? 'PASS' : 'BLOCK') + ' (' + gate.reason + ')'
    ].join('\n');
  }

  function buildStateOutput(lifecycle, confidence) {
    const noteLine = lifecycle.approvalNote ? ('- approval note: ' + lifecycle.approvalNote) : null;
    return [
      'Pattern lifecycle state: ' + lifecycle.phase.toUpperCase(),
      '- reason: ' + lifecycle.reason,
      '- confidence: ' + confidence.confidenceLabel.toUpperCase() + ' (' + confidence.confidenceScore + '/100)',
      '- evaluated: ' + new Date(lifecycle.evaluatedAt).toLocaleString(),
      noteLine
    ].filter(Boolean).join('\n');
  }

  function toHistoryEntry(lifecycle, action, actor) {
    return {
      phase: lifecycle.phase,
      reason: lifecycle.reason,
      evaluatedAt: lifecycle.evaluatedAt,
      qualityScore: lifecycle.qualityScore,
      benchmarkPassRate: lifecycle.benchmarkPassRate,
      criticalMisparseRate: lifecycle.criticalMisparseRate,
      confidenceScore: lifecycle.confidenceScore,
      confidenceLabel: lifecycle.confidenceLabel,
      action: action || 'auto-evaluate',
      actor: actor || 'system',
      approvalNote: lifecycle.approvalNote || null
    };
  }

  function saveLifecycleState(priorState, lifecycle, action, actor) {
    const nextState = {
      candidate: lifecycle,
      validated: lifecycle.phase === 'validated' || lifecycle.phase === 'approved' ? lifecycle : (priorState.validated || null),
      approved: lifecycle.phase === 'approved' ? lifecycle : (priorState.approved || null),
      history: [toHistoryEntry(lifecycle, action, actor)]
        .concat(Array.isArray(priorState.history) ? priorState.history : [])
        .slice(0, 30)
    };
    savePatternState(nextState);
    return nextState;
  }

  function onPromoteApproved() {
    const note = String(approvalNoteInput?.value || '').trim();
    if (!note) {
      setStatus('Manual promote requires an approval note.', 'err');
      approvalNoteInput?.focus();
      return;
    }
    if (!lastLifecycle) {
      setStatus('Run Learn from Example first so there is a candidate to promote.', 'err');
      return;
    }

    const priorState = getPatternState() || {};
    const promoted = {
      phase: 'approved',
      reason: 'Manually approved by user override.',
      evaluatedAt: new Date().toISOString(),
      qualityScore: lastLifecycle.qualityScore || 0,
      benchmarkPassRate: lastLifecycle.benchmarkPassRate || 0,
      criticalMisparseRate: lastLifecycle.criticalMisparseRate || 0,
      confidenceScore: lastLifecycle.confidenceScore || 0,
      confidenceLabel: lastLifecycle.confidenceLabel || 'low',
      approvalNote: note
    };
    saveLifecycleState(priorState, promoted, 'manual-promote', 'user');

    const confidence = lastConfidence || {
      confidenceScore: promoted.confidenceScore,
      confidenceLabel: promoted.confidenceLabel
    };
    if (stateOutputEl) stateOutputEl.textContent = buildStateOutput(promoted, confidence);
    lastLifecycle = promoted;
    lastConfidence = confidence;
    setStatus('Candidate manually promoted to APPROVED with audit note saved.', 'ok');
    const ex = lastLearnExample || (sessionExamples.length ? sessionExamples[sessionExamples.length - 1] : null);
    if (ex) {
      persistParserSetHintsFromExample(ex);
    }
  }

  function buildVBEvaluation(parserLogic, enabled) {
    if (!enabled) return 'Disabled.';
    const looksLikeVB = /\bIf\b|\bThen\b|\bAndAlso\b|\bOrElse\b/i.test(parserLogic);
    if (!looksLikeVB) {
      return 'VB evaluation enabled, but parser logic does not look VB-specific. No VB risks detected.';
    }
    return [
      'VB evaluation notes',
      '- VB style conditional syntax detected.',
      '- Ensure Node parser keeps equivalent precedence for AndAlso/OrElse branches.',
      '- Verify bracketed field references map to the same canonical field IDs.'
    ].join('\n');
  }

  function toggleRunButton() {
    const hasParser = parserLogicInput.value.trim().length > 0;
    const hasCase = caseTextInput.value.trim().length > 0;
    runBtn.disabled = !(hasParser && hasCase);
    if (runBtn.disabled) {
      setStatus('Add parser logic and a worked case to enable Learn Mode.');
    } else {
      setStatus('Ready to learn from this example.');
    }
  }

  async function onExcelSelected() {
    const file = excelInput?.files?.[0];
    if (!file) return;
    setStatus('Reading uploaded case file...', 'warn');
    try {
      const text = await readExcelAsCsvLikeText(file);
      if (!text.trim()) {
        setStatus('Uploaded file had no readable rows.', 'err');
        return;
      }
      caseTextInput.value = text;
      toggleRunButton();
      setStatus('Loaded case rows from file.', 'ok');
    } catch (err) {
      setStatus(err.message || 'Failed to read uploaded file.', 'err');
    }
  }

  function onRunLearnMode() {
    const parserLogic = parserLogicInput.value.trim();
    const caseRows = parseCaseRows(caseTextInput.value);
    if (!parserLogic || !caseRows.length) {
      setStatus('Parser logic and valid case rows are required.', 'err');
      return;
    }
    const hasCoreColumns = caseRows.some((row) => row.Step || row.Action || row.Target);
    if (!hasCoreColumns) {
      setStatus('Right panel must contain Step/Action/Target unit-test rows.', 'err');
      return;
    }

    const example = {
      parserLogic,
      caseRows,
      qualityScore: computeQualityScore(parserLogic, caseRows),
      createdAt: new Date().toISOString()
    };
    const { qualityThreshold } = getThresholds();
    if (example.qualityScore < qualityThreshold) {
      setStatus(
        'Example scored ' + example.qualityScore + '/100, below quality threshold ' + qualityThreshold + '. Stored as candidate only.',
        'warn'
      );
    } else {
      setStatus('Learned candidate scored ' + example.qualityScore + '/100. Running guardrails...', 'warn');
    }

    sessionExamples.push(example);

    if (saveToLibraryInput && saveToLibraryInput.checked) {
      const existing = getLibraryExamples();
      const merged = [example].concat(existing).slice(0, MAX_LIBRARY_ITEMS);
      saveLibraryExamples(merged);
      renderLibrary();
    }

    const allExamples = sessionExamples.concat(getLibraryExamples());
    const priorState = getPatternState() || {};
    const benchmark = runBenchmarkSuite(example, priorState);
    const confidence = computeConfidence(example, benchmark);
    const gate = evaluateGate(example, benchmark, confidence);
    const lifecycle = buildLifecycleState(example, benchmark, gate, confidence);

    saveLifecycleState(priorState, lifecycle, 'auto-evaluate', 'system');
    lastLifecycle = lifecycle;
    lastConfidence = confidence;
    lastLearnExample = example;
    if (lifecycle.phase === 'approved') {
      persistParserSetHintsFromExample(example);
    }

    templateOutputEl.textContent = buildTemplateOutput(allExamples);
    parserOutputEl.textContent = buildParserSuggestions(allExamples, lifecycle, confidence);
    if (benchmarkOutputEl) benchmarkOutputEl.textContent = buildBenchmarkOutput(benchmark, gate);
    if (stateOutputEl) stateOutputEl.textContent = buildStateOutput(lifecycle, confidence);
    vbOutputEl.textContent = buildVBEvaluation(parserLogic, !!enableVBEvalInput?.checked);

    setStatus(
      'Learned from 1 example. State: ' + lifecycle.phase.toUpperCase() + ', confidence: ' + confidence.confidenceLabel.toUpperCase() + '.',
      gate.gatePass ? 'ok' : 'warn'
    );
  }

  function onClear() {
    parserLogicInput.value = '';
    caseTextInput.value = '';
    lastLearnExample = null;
    if (excelInput) excelInput.value = '';
    if (saveToLibraryInput) saveToLibraryInput.checked = false;
    if (enableVBEvalInput) enableVBEvalInput.checked = false;
    if (approvalNoteInput) approvalNoteInput.value = '';
    templateOutputEl.textContent = 'No output yet.';
    parserOutputEl.textContent = 'No output yet.';
    if (benchmarkOutputEl) benchmarkOutputEl.textContent = 'No benchmark run yet.';
    if (stateOutputEl) stateOutputEl.textContent = 'No evaluation yet.';
    vbOutputEl.textContent = 'Disabled.';
    toggleRunButton();
  }

  parserLogicInput.addEventListener('input', toggleRunButton);
  caseTextInput.addEventListener('input', toggleRunButton);
  excelInput?.addEventListener('change', onExcelSelected);
  runBtn.addEventListener('click', onRunLearnMode);
  promoteBtn?.addEventListener('click', onPromoteApproved);
  clearBtn?.addEventListener('click', onClear);
  qualityThresholdInput?.addEventListener('input', toggleRunButton);
  minImprovementInput?.addEventListener('input', toggleRunButton);

  toggleRunButton();
  renderLibrary();

  const existingState = getPatternState();
  if (existingState && existingState.candidate && stateOutputEl) {
    const lifecycle = existingState.candidate;
    const confidence = {
      confidenceScore: lifecycle.confidenceScore || 0,
      confidenceLabel: lifecycle.confidenceLabel || 'low'
    };
    lastLifecycle = lifecycle;
    lastConfidence = confidence;
    stateOutputEl.textContent = buildStateOutput(lifecycle, confidence);
    if (benchmarkOutputEl) {
      benchmarkOutputEl.textContent = [
        'Last evaluated candidate',
        '- benchmark pass rate: ' + (lifecycle.benchmarkPassRate || 0) + '%',
        '- critical misparse rate: ' + (lifecycle.criticalMisparseRate || 0) + '%',
        '- quality: ' + (lifecycle.qualityScore || 0) + '/100'
      ].join('\n');
    }
  }
})();
