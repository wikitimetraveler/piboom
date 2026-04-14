const statusChip = document.getElementById('statusChip');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadArea = document.getElementById('uploadArea');
const unitTestsGrid = document.getElementById('unitTestsGrid');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const scanSetFieldsBtn = document.getElementById('scanSetFieldsBtn');
const clearAndReloadBtn = document.getElementById('clearAndReloadBtn');
const runTestsBtn = document.getElementById('runTestsBtn');
const clearBtn = document.getElementById('clearBtn');
const fillEmptyTestNullBtn = document.getElementById('fillEmptyTestNullBtn');
const searchInput = document.getElementById('searchInput');
const resultsMeta = document.getElementById('resultsMeta');
const fileInfo = document.getElementById('fileInfo');
const testResultsContainer = document.getElementById('testResultsContainer');
const testResultsList = document.getElementById('testResultsList');
const testResultsSummary = document.getElementById('testResultsSummary');
const closeResultsBtn = document.getElementById('closeResultsBtn');
const voiceHelpPanel = document.getElementById('voiceHelp');
const voiceHelpToggle = document.getElementById('toggleVoiceHelp');
const voiceHelpClose = document.getElementById('closeVoiceHelp');
const stickyActionBar = document.getElementById('stickyActionBar');
const loanGuidInput = document.getElementById('loanGuidInput');
const clearLoanGuidBtn = document.getElementById('clearLoanGuidBtn');
const loanGuidChip = document.getElementById('loanGuidChip');
const recentRunsSelect = document.getElementById('recentRunsSelect');
const failFirstBtn = document.getElementById('failFirstBtn');
const runSummaryCard = document.getElementById('runSummaryCard');
const runSummaryTime = document.getElementById('runSummaryTime');
const runSummaryCounts = document.getElementById('runSummaryCounts');
const runSummaryPassBar = document.getElementById('runSummaryPassBar');
const runSummarySkipBar = document.getElementById('runSummarySkipBar');
const runSummaryFailBar = document.getElementById('runSummaryFailBar');
const uploadToLibraryBtn = document.getElementById('uploadToLibraryBtn');
const libraryFileInput = document.getElementById('libraryFileInput');
const testLibraryList = document.getElementById('testLibraryList');
const fieldIdSearchInput = document.getElementById('fieldIdSearchInput');
const fieldIdSearchBtn = document.getElementById('fieldIdSearchBtn');
const fieldSearchResults = document.getElementById('fieldSearchResults');
const fieldSearchTerm = document.getElementById('fieldSearchTerm');
const fieldSearchResultsList = document.getElementById('fieldSearchResultsList');
const uploadBrRuleLibraryBtn = document.getElementById('uploadBrRuleLibraryBtn');
const brRuleLibraryFileInput = document.getElementById('brRuleLibraryFileInput');
const brRuleLibraryList = document.getElementById('brRuleLibraryList');

/** Hero toolbar: export / clear / scan live under Load / Tools dropdowns */
function setHeroPostLoadActionsVisible(visible) {
  ['heroExportCsvLi', 'heroExportExcelLi', 'heroClearReloadLi', 'heroScanSetLi'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('d-none', !visible);
  });
}

function setUnitTestsWelcomeVisible(visible) {
  const el = document.getElementById('unitTestsWelcomeCard');
  if (el) el.classList.toggle('d-none', !visible);
}

let gridApi;
let allData = [];
let columnDefs = [];
let testDescriptionsData = []; // Store test descriptions (scenario metadata)
let currentFileName = ''; // Store current file name for database operations
let voiceWidgetInstance = null;
let currentLoanGuid = '';
let lastRunResults = [];
let lastRunSummary = null;
let lastRunCellResults = {}; // { 'rowIndex-field': 'pass'|'fail' } for cell shading

const RECENT_RUNS_KEY = 'unitTestsRecentRuns';

/** Short-lived cache so BR generate + grid metadata share one hub fetch */
let _hubFieldListsCache = null;
let _hubFieldListsCacheAt = 0;
const HUB_FIELD_LISTS_TTL_MS = 30000;

/**
 * @returns {Promise<{ customList: object[], nativeList: object[] }>}
 */
async function fetchHubFieldListsCached() {
  const now = Date.now();
  if (_hubFieldListsCache && now - _hubFieldListsCacheAt < HUB_FIELD_LISTS_TTL_MS) {
    return _hubFieldListsCache;
  }
  const [customRes, nativeRes] = await Promise.all([
    (window.encompassApi?.encompassFetch || fetch)('/api/encompass-hub/custom-fields'),
    (window.encompassApi?.encompassFetch || fetch)('/api/encompass-hub/native-fields'),
  ]);
  const customItems = customRes.ok ? (await customRes.json()) : [];
  const customList = Array.isArray(customItems) ? customItems : customItems.items || customItems.fields || [];
  const nativeItems = nativeRes.ok ? (await nativeRes.json()) : [];
  const nativeList = Array.isArray(nativeItems) ? nativeItems : nativeItems.items || nativeItems.fields || nativeItems.standardFields || [];
  _hubFieldListsCache = { customList, nativeList };
  _hubFieldListsCacheAt = now;
  return _hubFieldListsCache;
}

/**
 * Full metadata lookup for descriptions + grid editors (same shape as custom-field generator).
 * @returns {Promise<Record<string, object>>}
 */
async function buildEncompassFieldMetadataLookupForUnitTests() {
  const { customList, nativeList } = await fetchHubFieldListsCached();
  if (!window.customFieldCalcParser?.buildFieldMetadataLookup) return {};
  return window.customFieldCalcParser.buildFieldMetadataLookup(customList, nativeList);
}

const extractFieldId = window.unitTestsUtils?.extractFieldId || function(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/\[([^\]]+)\]/);
  if (!match) return null;
  let id = match[1].trim();
  id = id.replace(/^[@#]+/, '');
  return id || null;
};
const hasFieldId = window.unitTestsUtils?.hasFieldId || function(value) { return extractFieldId(value) !== null; };
const getRawFieldIdFromTarget = window.unitTestsUtils?.getRawFieldIdFromTarget || function(target) {
  if (!target) return null;
  const match = String(target).trim().match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
};

/** Bootstrap 5 modals (jQuery .modal() is not available with BS5+jQuery slim). */
function showBsModal(modalEl) {
  if (!modalEl) return;
  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } else if (typeof window.$ !== 'undefined' && window.$.fn && window.$.fn.modal) {
    window.$(modalEl).modal('show');
  } else {
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
  }
}

function hideBsModal(modalEl) {
  if (!modalEl) return;
  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  } else if (typeof window.$ !== 'undefined' && window.$.fn && window.$.fn.modal) {
    window.$(modalEl).modal('hide');
  } else {
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
  }
}

function bsCollapseShow(el) {
  if (!el) return;
  if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
    bootstrap.Collapse.getOrCreateInstance(el, { toggle: false }).show();
  } else if (window.$ && window.$.fn && window.$.fn.collapse) {
    window.$(el).collapse('show');
  } else {
    el.classList.add('show');
  }
}

function bsCollapseHide(el, onHidden) {
  if (!el) return;
  if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
    if (typeof onHidden === 'function') {
      const handler = function () {
        el.removeEventListener('hidden.bs.collapse', handler);
        onHidden();
      };
      el.addEventListener('hidden.bs.collapse', handler);
    }
    bootstrap.Collapse.getOrCreateInstance(el, { toggle: false }).hide();
  } else if (window.$ && window.$.fn && window.$.fn.collapse) {
    if (onHidden) window.$(el).one('hidden.bs.collapse', onHidden);
    window.$(el).collapse('hide');
  } else {
    el.classList.remove('show');
    if (onHidden) onHidden();
  }
}

/**
 * Custom date picker cell editor - uses HTML5 date/time inputs for reliable date picker.
 * AG Grid's agDateStringCellEditor can be unreliable; this ensures date picker always works.
 */
function DatePickerCellEditor() {}
DatePickerCellEditor.prototype.init = function(params) {
  this.params = params;
  const cp = params.cellEditorParams || params;
  this.includeTime = !!(cp.includeTime);
  const val = params.value;
  let datePart = '';
  let timePart = '00:00';
  if (val && String(val).trim()) {
    const s = String(val).trim();
    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
    const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const tmMatch = s.match(/T(\d{2}:\d{2}(?::\d{2})?)/) || s.match(/\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (isoMatch) datePart = isoMatch[1];
    else if (usMatch) datePart = usMatch[3] + '-' + usMatch[1].padStart(2, '0') + '-' + usMatch[2].padStart(2, '0');
    timePart = tmMatch ? tmMatch[1] : '00:00';
  }
  this.gui = document.createElement('div');
  this.gui.className = 'ag-cell-edit-input date-picker-cell-editor';
  this.gui.style.display = 'flex';
  this.gui.style.gap = '4px';
  this.gui.style.alignItems = 'center';
  this.gui.style.padding = '2px';
  this.gui.style.minWidth = '140px';
  this.dateInput = document.createElement('input');
  this.dateInput.type = 'date';
  this.dateInput.value = datePart;
  this.dateInput.style.flex = '1';
  this.dateInput.min = cp.min || '1900-01-01';
  this.dateInput.max = cp.max || '2100-12-31';
  this.gui.appendChild(this.dateInput);
  if (this.includeTime) {
    this.timeInput = document.createElement('input');
    this.timeInput.type = 'time';
    this.timeInput.value = timePart;
    this.timeInput.step = '1';
    this.timeInput.style.width = '90px';
    this.gui.appendChild(this.timeInput);
  }
};
DatePickerCellEditor.prototype.getGui = function() { return this.gui; };
DatePickerCellEditor.prototype.getValue = function() {
  const d = this.dateInput.value;
  if (!d) return '';
  return this.includeTime && this.timeInput
    ? d + 'T' + (this.timeInput.value || '00:00:00')
    : d;
};
DatePickerCellEditor.prototype.afterGuiAttached = function() {
  this.dateInput.focus();
};
DatePickerCellEditor.prototype.destroy = function() {};

function setStatus(text, status = 'info', icon = 'bi-info-circle') {
  statusChip.className = `status-chip ${status}`;
  statusChip.innerHTML = `<i class="bi ${icon}"></i> ${text}`;
}

function detectColumnType(columnData) {
  if (!columnData || columnData.length === 0) return 'text';
  
  const nonEmptyValues = columnData.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmptyValues.length === 0) return 'text';
  
  // Check if all values are numbers
  const allNumbers = nonEmptyValues.every(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      return trimmed !== '' && !isNaN(trimmed) && !isNaN(parseFloat(trimmed));
    }
    return false;
  });
  
  if (allNumbers) return 'number';
  
  // Check if all values are dates
  const allDates = nonEmptyValues.every(v => {
    if (v instanceof Date) return true;
    if (typeof v === 'string') {
      const date = new Date(v);
      return !isNaN(date.getTime());
    }
    return false;
  });
  
  if (allDates) return 'date';
  
  return 'text';
}

function normalizeHeader(header) {
  if (!header) return '';
  return String(header).trim();
}

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return String(value).trim();
}

const isBlankForTest = window.unitTestsUtils?.isBlankForTest || function(val) {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'undefined' || s === 'nothing';
};

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async function(e) {
      try {
        const ExcelJS = window.ExcelJS;
        if (!ExcelJS) {
          reject(new Error('ExcelJS library not loaded'));
          return;
        }
        const buffer = e.target.result;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          reject(new Error('Excel file is empty'));
          return;
        }
        // ExcelJS row.values truncates trailing empty cells (issue #1456); read via getCell to preserve all columns
        const jsonData = [];
        const COL_LIMIT = 150;
        function safeCellValue(row, col) {
          try {
            const cell = row.getCell(col);
            const v = cell && cell.value;
            return v == null ? '' : v;
          } catch (_) {
            return '';
          }
        }
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          const rowData = [];
          for (let c = 1; c <= COL_LIMIT; c++) {
            rowData.push(safeCellValue(row, c));
          }
          jsonData.push(rowData);
        });
        // Trim all rows to last non-empty column (avoid 150 empty cols)
        let lastUsedCol = 0;
        jsonData.forEach((r) => {
          for (let i = r.length - 1; i >= 0; i--) {
            if (String(r[i] || '').trim() !== '') {
              if (i > lastUsedCol) lastUsedCol = i;
              break;
            }
          }
        });
        if (lastUsedCol > 0) {
          for (let i = 0; i < jsonData.length; i++) {
            jsonData[i] = jsonData[i].slice(0, lastUsedCol + 1);
          }
        }

        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }
        
        // Find the row that contains "Step" as a header (skip notes/comment rows before it)
        // These note rows should NEVER appear in the grid
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          // Check if this row contains "Step" in the first column (case-insensitive)
          const firstCell = String(row[0] || '').toLowerCase().trim();
          const rowString = row.map(cell => String(cell).toLowerCase().trim()).join(' ');
          
          // Look for "Step" as the first column header or anywhere in the row
          if (firstCell === 'step' || rowString.includes('step')) {
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          // If no "Step" row found, use first row as header (fallback)
          headerRowIndex = 0;
        }
        
        // Extract test descriptions from rows before Step header
        // Look for Test # and Test Plan columns (may be in cols 0,1 or elsewhere)
        const testDescriptions = [];
        const rowsBeforeStep = jsonData.slice(0, headerRowIndex);
        let testNumCol = 0;
        let testPlanCol = 1;
        if (rowsBeforeStep.length > 0) {
          const firstRow = rowsBeforeStep[0];
          const firstLower = firstRow.map((c) => String(c || '').toLowerCase().trim());
          const numIdx = firstLower.findIndex((c) => c.includes('test') && (c.includes('#') || c.includes('number')));
          const planIdx = firstLower.findIndex((c) => c.includes('test') && c.includes('plan'));
          if (numIdx >= 0 && planIdx >= 0 && numIdx !== planIdx) {
            testNumCol = numIdx;
            testPlanCol = planIdx;
          } else if (numIdx >= 0 && planIdx < 0 && numIdx + 1 < firstRow.length) {
            testNumCol = numIdx;
            testPlanCol = numIdx + 1;
          }
        }
        for (let rowIdx = 0; rowIdx < rowsBeforeStep.length; rowIdx++) {
          const row = rowsBeforeStep[rowIdx];
          const col1 = normalizeValue(row[testNumCol]);
          const col2 = normalizeValue(row[testPlanCol]);
          if (col1 && col2 && /^\d+$/.test(String(col1)) && parseInt(col1, 10) >= 1 && parseInt(col1, 10) <= 30) {
            const desc = String(col2).trim();
            if (desc.length > 0 && desc.toLowerCase() !== 'null') {
              testDescriptions.push({ testNumber: String(col1), description: desc });
            }
          }
        }
        
        // Extract headers from the Step row; ensure unique keys so each column has its own field
        const rawHeaders = jsonData[headerRowIndex].map(normalizeHeader);
        const seen = {};
        const headers = rawHeaders.map((h, idx) => {
          const base = h && String(h).trim() ? h : `Col_${idx + 1}`;
          if (seen[base]) {
            const unique = `${base}_${idx}`;
            seen[unique] = true;
            return unique;
          }
          seen[base] = true;
          return base;
        });

        // IMPORTANT: Skip ALL rows before the Step row - these are notes/comments
        // Only process rows AFTER the header row as data
        const dataRows = jsonData.slice(headerRowIndex + 1);
        
        // Convert data rows to objects and filter out empty rows
        const rows = dataRows
          .map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = normalizeValue(row[index]);
            });
            return obj;
          })
          .filter(row => {
            // Filter out completely empty rows and rows that are all empty strings
            const hasData = Object.values(row).some(val => {
              const str = String(val || '').trim();
              return str !== '' && str !== null && str !== undefined;
            });
            return hasData;
          });
        
        // Final validation: ensure no note/comment rows are in the grid
        // All rows before the Step header row are excluded, and empty rows are filtered
        resolve({ headers, rows, fileName: file.name, testDescriptions });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = function() {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * True if header is a scenario column: Reset or Test 1, Test 2, ... Test N.
 * Blank or other names (e.g. Scenario_N, Column_N, Notes) = not a scenario = end.
 */
function isScenarioColumnHeader(header) {
  const h = String(header || '').trim().toLowerCase();
  if (!h) return false;
  if (h === 'reset' || /^reset_\d+$/.test(h)) return true;
  return /^test\s*#?\s*\d+(_\d+)?$/.test(h) || /^test\d+(_\d+)?$/.test(h); // Test 1, Test 2_6, Test#3, etc.
}

/**
 * Check if header looks like Name+Number (e.g. Jim1). Returns { prefix, num } or null.
 * Excludes auto-named blanks: Scenario_N, Col_N — not real test scenario columns.
 */
function parseScenarioStyleHeader(header) {
  const h = String(header || '').trim();
  if (!h) return null;
  const m = h.match(/^([a-zA-Z_]+)(\d+)(_\d+)?$/);
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  if (prefix === 'scenario' || prefix === 'col') return null; // auto-named blanks, stop
  return { prefix, num: parseInt(m[2], 10) };
}

/**
 * True if header is an auto-generated extra column (Col_N, Scenario_N, Column N) — never include these.
 */
function isExtraColumn(header) {
  const h = String(header || '').trim().toLowerCase();
  return /^col_?\d+$/.test(h) || /^scenario_?\d+$/.test(h) || /^column\s+\d+$/.test(h);
}

/**
 * Last column index that is a scenario. Stop after last Test N, or after last consecutive Name+Number.
 * Never include Col_N, Scenario_N, or other auto-generated junk columns.
 */
function getLastScenarioIndex(headers, descriptionIndex) {
  const startIndex = descriptionIndex >= 0
    ? descriptionIndex + 1
    : Math.max(0, headers.findIndex((h) => /^target$/i.test(String(h || '').trim())) + 1);
  let last = startIndex - 1;
  let prevPrefix = null;
  let prevNum = 0;

  for (let i = startIndex; i < headers.length; i++) {
    const h = headers[i];
    if (isExtraColumn(h)) break; // never include Col_17, Scenario_12, etc.
    if (isScenarioColumnHeader(h)) {
      last = i;
      prevPrefix = null; // reset for next style
    } else {
      const parsed = parseScenarioStyleHeader(h);
      if (parsed) {
        const isConsecutive = prevPrefix === parsed.prefix && parsed.num === prevNum + 1;
        const isFirst = prevPrefix === null;
        if (isFirst || isConsecutive) {
          last = i;
          prevPrefix = parsed.prefix;
          prevNum = parsed.num;
        } else break; // different prefix or non-consecutive — stop
      } else break; // not Test N and not Name+Number — stop
    }
  }
  return last;
}

function generateColumnDefs(headers, rows) {
  const defs = [];
  
  const descriptionIndex = headers.findIndex((h) => String(h || '').toLowerCase().trim() === 'description');
  const lastScenarioIndex = getLastScenarioIndex(headers, descriptionIndex);

  // Only include columns up to and including the last Test # — never include Col_N, Scenario_N, etc.
  let maxColumnIndex = lastScenarioIndex >= 0 ? lastScenarioIndex : -1;
  if (maxColumnIndex < 0) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (!isExtraColumn(headers[i])) {
        maxColumnIndex = i;
        break;
      }
    }
    if (maxColumnIndex < 0) maxColumnIndex = headers.length - 1;
  }
  const headersToUse = headers.slice(0, maxColumnIndex + 1).filter((h) => !isExtraColumn(h));

  // No pinning - all columns scroll together to avoid header/body alignment issues at pinned boundary
  const pinnedColumns = [];

  headersToUse.forEach((header, index) => {
    if (!header || header.trim() === '') {
      header = `Column ${index + 1}`;
    }
    
    // Get column data for type detection
    const columnData = rows.map(row => row[header]);
    const columnType = detectColumnType(columnData);
    
    const headerLower = header.toLowerCase().trim();
    const isTestColumn = descriptionIndex >= 0 && index > descriptionIndex && index <= lastScenarioIndex;
    const isPinnedColumn = pinnedColumns.some(p => headerLower.includes(p.toLowerCase()));
    
    // Strict 1:1 — one header per column, explicit colId for ag-Grid
    const colDef = {
      colId: `col_${index}`,
      headerName: header,
      field: header,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 90,
      width: 120,
    };
    
    // Pin important columns to the left
    if (isPinnedColumn) {
      colDef.pinned = 'left';
      colDef.lockPinned = true;
    }
    
    // Set filter type based on column type
    if (columnType === 'number') {
      colDef.filter = 'agNumberColumnFilter';
      colDef.type = 'numericColumn';
    } else if (columnType === 'date') {
      colDef.filter = 'agDateColumnFilter';
      colDef.type = 'dateColumn';
    } else {
      colDef.filter = 'agTextColumnFilter';
    }
    
    // Special handling for Step column (first column)
    if (headerLower === 'step' || index === 0) {
      colDef.minWidth = 60;
      colDef.width = 70;
      colDef.editable = true;
      colDef.cellClass = 'step-cell';
      colDef.headerClass = 'step-header';
      // If it's numeric, treat as step number
      if (columnType === 'number') {
        colDef.filter = 'agNumberColumnFilter';
        colDef.type = 'numericColumn';
        colDef.cellRenderer = (params) => {
          if (params.value === '' || params.value === null || params.value === undefined) {
            return '';
          }
          return params.value;
        };
      }
    }
    
    // Special handling for Target column (column 3) - contains field IDs in brackets
    // These values can be populated via API
    if (headerLower.includes('target')) {
      colDef.minWidth = 220;
      colDef.width = 280;
      colDef.wrapText = true;
      colDef.autoHeight = true;
      colDef.cellStyle = { whiteSpace: 'normal', lineHeight: '1.4' };
      colDef.editable = true;
      colDef.headerClass = 'target-header';
      colDef.cellClass = 'target-cell';
      // Extract and highlight field IDs in brackets
      colDef.cellRenderer = (params) => {
        if (!params.value) return '<span class="text-muted">—</span>';
        const value = String(params.value).trim();
        // Check if value contains brackets (field ID format like [LOCKRATE.2866], [1401], etc.)
        if (hasFieldId(value)) {
          const fieldId = extractFieldId(value);
          // Highlight the field ID in brackets
          const displayValue = value.replace(
            `[${fieldId}]`, 
            `<span class="field-id-badge" title="Field ID: ${fieldId}">[${fieldId}]</span>`
          );
          return displayValue;
        }
        return value;
      };
      // Add tooltip to show full field ID and indicate API source
      colDef.tooltipValueGetter = (params) => {
        if (!params.value) return '';
        const value = String(params.value).trim();
        const fieldId = extractFieldId(value);
        if (fieldId) {
          return `Field ID: ${fieldId}\nFull Value: ${value}\n\n(Can be populated via API)`;
        }
        return `${value}\n\n(Can be populated via API)`;
      };
      // Make it searchable by field ID
      colDef.getQuickFilterText = (params) => {
        const value = String(params.value || '').trim();
        const fieldId = extractFieldId(value);
        // Include both full value and extracted field ID in search
        return fieldId ? `${value} ${fieldId}` : value;
      };
    }
    
    // Special handling for Description column (column 4)
    if (headerLower.includes('description')) {
      colDef.minWidth = 250;
      colDef.width = 300;
      colDef.headerClass = 'description-header';
      colDef.cellClass = 'description-cell';
      colDef.wrapText = true;
      colDef.autoHeight = true;
      colDef.cellStyle = { whiteSpace: 'normal', lineHeight: '1.5' };
    }
    
    // Special handling for Test columns - all cells editable; type-aware editors from row metadata
    if (isTestColumn) {
      colDef.minWidth = 90;
      colDef.width = 110;
      colDef.headerClass = 'test-scenario-column';
      colDef.editable = true;
      // Type-aware cell editors based on row metadata (from Encompass field definitions)
      colDef.cellEditorSelector = (params) => {
        let meta = params.data && params.data._fieldMetadata;
        if (!meta && params.data && params.data.Target && typeof currentFieldMetadata === 'object') {
          const fieldId = extractFieldId(params.data.Target);
          meta = fieldId ? (currentFieldMetadata[fieldId] || currentFieldMetadata[params.data.Target]) : null;
        }
        // Infer from field ID suffix (.DT, .date, .dttm) when no API metadata
        if (!meta && params.data && params.data.Target) {
          const fieldId = extractFieldId(params.data.Target);
          const inferred = fieldId && window.customFieldCalcParser?.inferDateTypeFromFieldId?.(fieldId);
          if (inferred) meta = inferred;
        }
        // Infer from @ notation in Target (e.g. [@748] = date/DateTime) - Excel rows lack _fieldMetadata
        if (!meta && params.data && params.data.Target && window.customFieldCalcParser?.isDateFieldByNotation) {
          const rawId = getRawFieldIdFromTarget(params.data.Target);
          if (rawId && window.customFieldCalcParser.isDateFieldByNotation(rawId)) {
            const desc = String(params.data.Description || '').toLowerCase();
            meta = desc.includes('(datetime)')
              ? { dataType: 'DateTime', format: '', description: 'DateTime (from @)' }
              : { dataType: 'Date', format: '', description: 'Date (from @)' };
          }
        }
        // Fallback: only explicit (Date) / (DateTime) tags in Description — avoid matching the word "date"
        // elsewhere (misleading) which forced DatePicker and cleared non-date text input.
        if (!meta && params.data && params.data.Description) {
          const desc = String(params.data.Description || '').toLowerCase();
          if (desc.includes('(datetime)')) meta = { dataType: 'DateTime', format: '', description: 'DateTime (from Description)' };
          else if (desc.includes('(date)')) meta = { dataType: 'Date', format: '', description: 'Date (from Description)' };
        }
        const dt = (meta && meta.dataType) ? String(meta.dataType).toLowerCase() : '';
        if (meta && Array.isArray(meta.options) && meta.options.length > 0) {
          return { component: 'agSelectCellEditor', params: { values: meta.options } };
        }
        if (/integer/i.test(dt)) {
          return { component: 'agNumberCellEditor', params: { precision: 0, step: 1 } };
        }
        // Number editor only when dataType says numeric — not from format strings (too many false positives).
        if (/decimal|number/i.test(dt)) {
          return { component: 'agNumberCellEditor', params: { precision: 2 } };
        }
        // Date editor only from explicit dataType or @ / field-id inference above — not from loose format match.
        if (/date|datetime/i.test(dt)) {
          const isDateTime = /datetime/i.test(dt);
          return {
            component: 'DatePickerCellEditor',
            params: {
              min: '1900-01-01',
              max: '2100-12-31',
              includeTime: !!isDateTime,
            },
          };
        }
        if (/boolean|yesno/i.test(dt)) {
          return { component: 'agSelectCellEditor', params: { values: ['Y', 'N'] } };
        }
        return null; // default text editor
      };
      colDef.cellClass = (params) => {
        let cls = 'test-scenario-cell';
        const rowId = params.data?.__rowIndex ?? params.node?.id ?? params.rowIndex;
        const key = `${rowId}-${params.colDef?.field || ''}`;
        const result = lastRunCellResults[key];
        if (result === 'pass') cls += ' cell-pass';
        else if (result === 'fail') cls += ' cell-fail';
        return cls;
      };
      
      // Show values plainly — no green/red Y/N badges (misleading vs pass/fail cell shading).
      colDef.cellRenderer = (params) => {
        if (!params.value || params.value === '' || params.value === null || params.value === undefined) {
          return '<span class="text-muted">—</span>';
        }
        
        const value = String(params.value).trim();
        const esc = escapeHtml(value);
        
        // Numeric values (like IDs) — subtle monospace; Y/N use same neutral text as other strings
        if (/^\d+$/.test(value)) {
          return `<span class="test-value-numeric" title="Numeric: ${esc}">${esc}</span>`;
        }
        
        return `<span class="test-value-text" title="Test value">${esc}</span>`;
      };

      // If the editor returns undefined (cancel / invalid), keep prior value; null clears to empty string.
      colDef.valueSetter = (params) => {
        const field = params.colDef.field;
        if (params.newValue === undefined) return false;
        params.data[field] = params.newValue === null ? '' : params.newValue;
        return true;
      };
      
      // Tooltip to indicate these are test values (all editable; Target column is overwritten by API)
      colDef.tooltipValueGetter = (params) => {
        if (!params.value) return 'Empty - Click to edit';
        return `Test Value: ${params.value}\n\nAll cells editable. Target column values are overwritten by API.`;
      };
      
      // Make test columns searchable
      colDef.getQuickFilterText = (params) => {
        return String(params.value || '');
      };
    }
    
    // Action column styling - handles Get, Set, Compare
    if (headerLower === 'action') {
      colDef.minWidth = 90;
      colDef.width = 100;
      colDef.editable = true;
      colDef.cellEditor = 'agSelectCellEditor';
      colDef.cellEditorParams = { values: ['GET', 'SET', 'COMPARE'] };
      colDef.cellClass = 'action-cell';
      colDef.headerClass = 'action-header';
      // Add cell renderer to style different action types
      colDef.cellRenderer = (params) => {
        if (!params.value) return '';
        const action = String(params.value).trim().toLowerCase();
        let badgeClass = 'action-badge';
        if (action === 'set') {
          badgeClass += ' action-set';
        } else if (action === 'get') {
          badgeClass += ' action-get';
        } else if (action === 'compare') {
          badgeClass += ' action-compare';
        }
        return `<span class="${badgeClass}">${params.value}</span>`;
      };
      // Add filter options for action types
      colDef.filterParams = {
        filterOptions: ['equals', 'notEqual'],
        defaultOption: 'equals',
        suppressAndOrCondition: true,
      };
    }
    
    defs.push(colDef);
  });
  
  return defs;
}

function initializeGrid() {
  if (!unitTestsGrid || gridApi) return;
  
  const gridOptions = {
    columnDefs: columnDefs,
    rowData: [],
    getRowId: (params) => String(params.data?.__rowIndex ?? params.rowIndex ?? ''),
    components: { DatePickerCellEditor: DatePickerCellEditor },
    theme: 'legacy',
    singleClickEdit: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      minWidth: 90,
      width: 120,
    },
    columnTypes: {
      dateColumn: {},
    },
    rowSelection: {
      mode: 'singleRow',
      enableClickSelection: true,
    },
    animateRows: true,
    overlayNoRowsTemplate: '<span class="text-muted">No data available. Upload an Excel file to get started.</span>',
    onFirstDataRendered: () => safeSizeColumnsToFit(),
    getRowClass: (params) => {
      const desc = String(params.data?.Description || params.data?.description || '').trim();
      if (desc === 'Actual Results' || desc === 'Overall Test Results') return 'placeholder-section-row';
      return '';
    },
  };
  
  if (typeof agGrid.createGrid === 'function') {
    gridApi = agGrid.createGrid(unitTestsGrid, gridOptions);
  } else {
    new agGrid.Grid(unitTestsGrid, gridOptions);
    gridApi = gridOptions.api;
  }

  const testGridCollapse = document.getElementById('collapseTestGrid');
  if (testGridCollapse) {
    testGridCollapse.addEventListener('shown.bs.collapse', () => {
      safeSizeColumnsToFit();
    });
  }
}

function setGridRows(rows) {
  if (!gridApi) return;
  
  if (typeof gridApi.setGridOption === 'function') {
    gridApi.setGridOption('rowData', rows);
  } else if (typeof gridApi.setRowData === 'function') {
    gridApi.setRowData(rows);
  }
  
  // Update column definitions if needed
  if (typeof gridApi.setGridOption === 'function') {
    gridApi.setGridOption('columnDefs', columnDefs);
  } else if (typeof gridApi.setColumnDefs === 'function') {
    gridApi.setColumnDefs(columnDefs);
  }
  
  // Auto-size columns
  safeSizeColumnsToFit();
}

function safeSizeColumnsToFit() {
  if (!gridApi || typeof gridApi.sizeColumnsToFit !== 'function') return;
  if (!unitTestsGrid || unitTestsGrid.offsetWidth === 0) return;
  const run = () => {
    if (unitTestsGrid.offsetWidth > 0) {
      gridApi.sizeColumnsToFit();
      // Second pass after layout settles - helps header/body alignment
      setTimeout(() => gridApi.sizeColumnsToFit?.(), 250);
    }
  };
  setTimeout(run, 100);
}

function updateResultsMeta() {
  if (!gridApi) {
    resultsMeta.textContent = '0 rows';
    return;
  }
  
  const displayedCount = gridApi.getDisplayedRowCount ? gridApi.getDisplayedRowCount() : allData.length;
  const totalCount = allData.length;
  
  if (displayedCount === totalCount) {
    resultsMeta.textContent = `${totalCount} row${totalCount !== 1 ? 's' : ''}`;
  } else {
    resultsMeta.textContent = `${displayedCount} of ${totalCount} rows`;
  }
}

function applySearch() {
  if (!gridApi) return;
  
  const searchTerm = searchInput.value.trim();
  
  if (typeof gridApi.setQuickFilter === 'function') {
    gridApi.setQuickFilter(searchTerm);
  } else if (typeof gridApi.setGridOption === 'function') {
    gridApi.setGridOption('quickFilterText', searchTerm);
  }
  
  updateResultsMeta();
}

function extractTestNumberFromKey(key) {
  if (!key) return null;
  const str = String(key).trim();
  const testMatch = str.match(/test\s*#?\s*(\d+)/i);
  if (testMatch) return testMatch[1];
  const numMatch = str.match(/(\d+)$/);
  return numMatch ? numMatch[1] : null;
}

function getActiveTestNumber() {
  const activeCard = document.querySelector('.test-description-card.test-scenario-active');
  if (!activeCard) return null;
  return activeCard.getAttribute('data-test-number');
}

function findTestColumnByNumber(testNumber) {
  if (!Array.isArray(columnDefs)) return null;
  const ordered = getOrderedTestColumns();
  if (testNumber) {
    const match = ordered.find((c) => c.testNumber === String(testNumber));
    return match || null;
  }
  const resetCol = ordered.find((c) => c.testNumber === 'RESET');
  return resetCol || null;
}

function findFallbackTestColumn() {
  if (!Array.isArray(columnDefs)) return null;
  const resetCol = columnDefs.find((colDef) => {
    const header = String(colDef.headerName || colDef.field || '').trim().toLowerCase();
    return header === 'reset';
  });
  if (resetCol?.field) {
    return { field: resetCol.field, testNumber: 'RESET' };
  }
  const match = columnDefs.find((colDef) => {
    const header = String(colDef.headerName || colDef.field || '').trim();
    return header.toLowerCase().startsWith('test');
  });
  if (!match) return null;
  return { field: match.field, testNumber: extractTestNumberFromKey(match.headerName || match.field) };
}

function getOrderedTestColumns() {
  if (!Array.isArray(columnDefs)) return [];
  const descriptionIndex = columnDefs.findIndex((colDef) => {
    const header = String(colDef.headerName || colDef.field || '').trim().toLowerCase();
    return header === 'description';
  });
  const startIndex = descriptionIndex >= 0 ? descriptionIndex + 1 : 0;
  const result = [];
  for (let i = startIndex; i < columnDefs.length; i++) {
    const colDef = columnDefs[i];
    const raw = String(colDef.headerName || colDef.field || '').trim();
    if (!isScenarioColumnHeader(raw)) break; // blank or non-Test = end, do not add more
    const testNum = extractTestNumberFromKey(raw) || (raw.toLowerCase() === 'reset' ? 'RESET' : String(result.length + 1));
    result.push({ field: colDef.field, testNumber: testNum });
  }
  return result;
}

function getNonTestColumnFields() {
  if (!Array.isArray(columnDefs)) return [];
  const testFields = new Set(getOrderedTestColumns().map((c) => c.field));
  return columnDefs
    .filter((col) => {
      const field = col.field || col.colId;
      return field && !testFields.has(field);
    })
    .map((col) => col.field || col.colId);
}

function hideNonTestColumns() {
  if (!gridApi || typeof gridApi.setColumnVisible !== 'function') return;
  const testCols = getOrderedTestColumns();
  if (testCols.length === 0) return;
  const nonTestFields = getNonTestColumnFields();
  nonTestFields.forEach((field) => {
    if (field) gridApi.setColumnVisible(field, false);
  });
}

function showAllColumns() {
  if (!gridApi || typeof gridApi.setColumnVisible !== 'function') return;
  if (!Array.isArray(columnDefs)) return;
  columnDefs.forEach((col) => {
    const field = col.field || col.colId;
    if (field) gridApi.setColumnVisible(field, true);
  });
}

function pickTestColumnForRow(row) {
  const testColumns = getOrderedTestColumns();
  if (!testColumns.length) return null;
  const nonEmpty = testColumns.find((col) => {
    const value = row[col.field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
  return nonEmpty || testColumns[0];
}

/**
 * Copy one scenario column's values to the next column (e.g. Test #1 → Test #2).
 * @param {string} testNumber - Source test number (e.g. "1")
 * @returns {boolean} true if copy succeeded
 */
function copyColumnToNext(testNumber) {
  if (!allData || allData.length === 0) return false;
  const ordered = getOrderedTestColumns().filter((c) => c.testNumber && c.testNumber !== 'RESET');
  const idx = ordered.findIndex((c) => c.testNumber === String(testNumber));
  if (idx < 0 || idx >= ordered.length - 1) return false;
  const srcCol = ordered[idx];
  const dstCol = ordered[idx + 1];
  if (!srcCol?.field || !dstCol?.field) return false;
  allData.forEach((row) => {
    const val = row[srcCol.field];
    row[dstCol.field] = val !== undefined && val !== null ? val : '';
  });
  setGridRows(allData);
  return true;
}

function isCellEmptyForNullFill(val) {
  return val === null || val === undefined || String(val).trim() === '';
}

/**
 * Inserts the literal text "null" in empty scenario cells (Test # / Reset after Description).
 * SET then clears the loan field; COMPARE treats it as an expected blank (see isBlankForTest).
 */
function fillEmptyScenarioCellsWithNull() {
  const ordered = getOrderedTestColumns();
  if (!ordered.length) {
    showToast('No scenario columns found. Use a layout with Description and Test # columns.', 'warning');
    return;
  }
  if (!allData || !allData.length) {
    showToast('No rows to update', 'warning');
    return;
  }
  const token = 'null';
  let n = 0;
  allData.forEach((row) => {
    ordered.forEach(({ field }) => {
      if (!field || !isCellEmptyForNullFill(row[field])) return;
      row[field] = token;
      n += 1;
    });
  });
  if (n && gridApi) {
    setGridRows(allData);
  }
  showToast(n ? `Filled ${n} empty cell(s) with null` : 'No empty scenario cells to fill', n ? 'ok' : 'info');
}

function pickTestValue(testValues) {
  const entries = Object.entries(testValues);
  for (const [key, value] of entries) {
    if (value !== '' && value !== null && value !== undefined) {
      return {
        value,
        key,
        testNumber: extractTestNumberFromKey(key)
      };
    }
  }
  return null;
}

/**
 * Extract field value from Encompass field-reader API response.
 * Handles array of LoanFieldDataContract, PascalCase (FieldId/Value), loose id matching, wrapped responses.
 */
function extractFieldValueFromReaderResponse(data, fieldId) {
  if (!data) return null;
  const fid = String(fieldId || '').trim();
  const sameId = (item, key) => {
    const v = item?.[key];
    return v !== undefined && v !== null && String(v).trim() === fid;
  };
  const getValue = (item) => {
    if (item == null) return null;
    const v = item.value ?? item.Value ?? item.fieldValue ?? item.field_value ?? item.stringValue ?? item.StringValue;
    if (v !== undefined && v !== null) return v;
    const arr = item.values ?? item.Values;
    if (Array.isArray(arr) && arr.length) return arr[0];
    return null;
  };

  if (Array.isArray(data)) {
    const match =
      data.find((item) => typeof item === 'object' && (sameId(item, 'id') || sameId(item, 'fieldId') || sameId(item, 'FieldId'))) ||
      (data.length === 1 && typeof data[0] === 'object' ? data[0] : null);
    if (match) return getValue(match);
    if (data.length === 1 && (typeof data[0] === 'string' || typeof data[0] === 'number')) return data[0];
    return null;
  }
  if (typeof data === 'object') {
    const arr = data.fields ?? data.items ?? data.data ?? data.results;
    if (Array.isArray(arr)) return extractFieldValueFromReaderResponse(arr, fieldId);
    const direct = data[fid] ?? data[fid?.toUpperCase?.()] ?? data[fid?.toLowerCase?.()];
    if (direct !== undefined && direct !== null) {
      return typeof direct === 'object' ? (direct.value ?? direct.Value ?? direct) : direct;
    }
    return null;
  }
  return null;
}

/**
 * Extract field metadata (Description, Type, Format) from field-reader API response.
 * @param {Array|object} data - API response
 * @param {string} fieldId
 * @returns {{ description?: string, type?: string, format?: string }|null}
 */
function extractFieldMetadataFromReaderResponse(data, fieldId) {
  if (!data) return null;
  const fid = String(fieldId || '').trim();
  const sameId = (item, key) => {
    const v = item?.[key];
    return v !== undefined && v !== null && String(v).trim() === fid;
  };
  let match = null;
  if (Array.isArray(data)) {
    match = data.find((item) => typeof item === 'object' && (sameId(item, 'id') || sameId(item, 'fieldId') || sameId(item, 'FieldId')));
  } else if (typeof data === 'object') {
    const arr = data.fields ?? data.items ?? data.data ?? data.results;
    if (Array.isArray(arr)) return extractFieldMetadataFromReaderResponse(arr, fieldId);
  }
  if (!match || typeof match !== 'object') return null;
  const desc = match.description ?? match.Description ?? match.longDescription ?? match.shortDescription ?? '';
  const type = match.type ?? match.Type ?? match.dataType ?? match.dataTypeName ?? match.valueType ?? '';
  const format = match.format ?? match.Format ?? match.formatType ?? match.displayFormat ?? '';
  if (!desc && !type && !format) return null;
  return { description: desc, type: type, format: format };
}

/**
 * If row.Description matches "Field X" and API has metadata, update the row with API description.
 * @param {object} row - grid row
 * @param {string} fieldId
 * @param {Array|object} apiData - field-reader response
 * @param {object} gridApi - AG Grid api
 * @param {number} rowIndex
 */
function maybeUpdateDescriptionFromApi(row, fieldId, apiData, gridApi, rowIndex) {
  const desc = String(row.Description || row.description || '').trim();
  if (!/^Field\s+.+$/i.test(desc)) return;
  const meta = extractFieldMetadataFromReaderResponse(apiData, fieldId);
  if (!meta || (!meta.description && !meta.type)) return;
  const parts = [];
  if (meta.description) parts.push(meta.description);
  if (meta.type) parts.push('(' + meta.type + ')');
  const newDesc = parts.length ? parts.join(' ') : desc;
  row.Description = newDesc;
  row.description = newDesc;
  const descCol = columnDefs.find((c) => (c.headerName || c.field || '').toLowerCase() === 'description');
  if (gridApi && descCol?.field && rowIndex != null) {
    const rowNode = gridApi.getDisplayedRowAtIndex(rowIndex);
    if (rowNode) rowNode.setDataValue(descCol.field, newDesc);
  }
}

function buildFieldWriterPayload(fieldId, value, row) {
  const payload = [{ id: fieldId, value }];
  const lockValue = row.Lock ?? row.lock ?? row.Locked ?? row.locked;
  if (lockValue !== undefined && lockValue !== '') {
    const lockNormalized = String(lockValue).toLowerCase().trim();
    if (['true', 'yes', 'y', '1'].includes(lockNormalized)) {
      payload[0].lock = true;
    }
  }
  return payload;
}

function escapeCsvCell(val) {
  const v = val === null || val === undefined ? '' : String(val);
  return v.includes(',') || v.includes('"') || v.includes('\n') ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/**
 * Build export rows in the standard format: scenarios at top, buffer lines, header, data grouped by action.
 * Returns { aoa: number[][] for Excel, headers: string[] }.
 */
function buildExportRowsInFormat() {
  const headers = columnDefs.filter((col) => col.field).map((col) => col.field);
  if (headers.length === 0 && allData && allData[0]) {
    headers.push(...Object.keys(allData[0]));
  }
  const numCols = Math.max(headers.length, 1);

  const emptyRow = () => Array(numCols).fill('');
  const rowFromObj = (obj) => headers.map((h) => {
    const v = obj[h];
    return v === null || v === undefined ? '' : String(v);
  });

  const aoa = [];

  // 1. Scenario rows at top (one per test scenario) - count matches loaded scenarios
  let scenarios = testDescriptionsData && testDescriptionsData.length > 0 ? testDescriptionsData : [];
  if (scenarios.length === 0) {
    const testHeaders = headers.filter((h) => /^test\s*#?\s*\d+$/i.test(h) || /^test\d+$/i.test(h));
    scenarios = testHeaders.map((h) => {
      const m = String(h).match(/^test\s*#?\s*(\d+)$/i) || String(h).match(/^test(\d+)$/i);
      return { testNumber: m ? m[1] : '', description: '' };
    }).filter((s) => s.testNumber);
  }
  if (scenarios.length > 0) {
    scenarios.forEach((s) => {
      const r = emptyRow();
      r[0] = `Scenario ${s.testNumber}`;
      aoa.push(r);
    });
  }

  // 2. Buffer rows (2 empty lines)
  aoa.push(emptyRow());
  aoa.push(emptyRow());

  // 3. Header row
  aoa.push([...headers]);

  // 4. Partition data rows by action
  const setRows = [];
  const getRows = [];
  const compareRows = [];
  const otherRows = [];
  (allData || []).forEach((r) => {
    const action = String(r.Action || r.action || '').trim().toUpperCase();
    const step = String(r.Step || r.step || '').trim().toUpperCase();
    if (step === 'X' || step === '') {
      otherRows.push(r);
    } else if (action === 'SET') {
      setRows.push(r);
    } else if (action === 'GET') {
      getRows.push(r);
    } else if (action === 'COMPARE') {
      compareRows.push(r);
    } else {
      otherRows.push(r);
    }
  });

  // 5. SET rows
  setRows.forEach((r) => aoa.push(rowFromObj(r)));

  // 6. Buffer (2 lines) between SET and GET
  aoa.push(emptyRow());
  aoa.push(emptyRow());

  // 7. GET rows
  getRows.forEach((r) => aoa.push(rowFromObj(r)));

  // 8. Buffer + "Actual Results" section (if we have COMPARE rows)
  if (compareRows.length > 0) {
    aoa.push(emptyRow());
    const actualHeader = emptyRow();
    actualHeader[0] = 'Actual Results';
    aoa.push(actualHeader);
    compareRows.forEach((r) => aoa.push(rowFromObj(r)));
  }

  // 8b. Export-only: GET [364] loan number audit (so the file shows which loan was tested) — skip if already present
  const allPartitioned = [...setRows, ...getRows, ...compareRows, ...otherRows];
  const alreadyHas364Get = allPartitioned.some((r) => {
    const id = extractFieldId(r.Target || r.target || '');
    return id === '364';
  });
  if (!alreadyHas364Get && headers.length > 0) {
    const loanAudit = {};
    headers.forEach((h) => {
      loanAudit[h] = '';
    });
    const setByHeader = (name, val) => {
      const h = headers.find((x) => x && String(x).toLowerCase() === String(name).toLowerCase());
      if (h) loanAudit[h] = val;
    };
    setByHeader('Action', 'GET');
    setByHeader('Target', '[364]');
    setByHeader('Description', 'Loan number (which loan was tested)');
    aoa.push(rowFromObj(loanAudit));
  }

  // 9. Buffer + "Overall Test Results" section
  aoa.push(emptyRow());
  aoa.push(emptyRow());
  const overallHeader = emptyRow();
  overallHeader[0] = 'Overall Test Results';
  aoa.push(overallHeader);

  // 10. Other rows (e.g. loan GET, Test Results)
  otherRows.forEach((r) => aoa.push(rowFromObj(r)));

  return { aoa, headers };
}

function exportToCSV() {
  if (!allData || allData.length === 0) {
    console.warn('No data to export');
    return;
  }
  const { aoa, headers } = buildExportRowsInFormat();
  const lines = aoa.map((row) => row.map(escapeCsvCell).join(','));
  const csv = lines.join('\n') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = ((currentFileName || 'unit-tests').replace(/\.(xlsx|xls)$/i, '') + '-export.csv');
  link.click();
  URL.revokeObjectURL(link.href);
}

async function exportToExcel() {
  const ExcelJS = window.ExcelJS;
  if (!allData || allData.length === 0 || !ExcelJS) {
    console.warn('Excel export unavailable');
    setStatus('No data to export or ExcelJS library not loaded', 'err', 'bi-exclamation-octagon');
    return;
  }
  try {
    const { aoa } = buildExportRowsInFormat();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test Cases');
    worksheet.addRows(aoa);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ((currentFileName || 'unit-tests').replace(/\.(xlsx|xls)$/i, '') + '-export.xlsx');
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported to ${link.download}`, 'ok', 'bi-check-circle');
  } catch (err) {
    setStatus('Export failed: ' + (err.message || 'Unknown error'), 'err', 'bi-exclamation-octagon');
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function displayTestDescriptions(testDescriptions) {
  const container = document.getElementById('testDescriptionsContainer');
  const accordionContainer = document.getElementById('accordionContainer');
  const testScenariosCount = document.getElementById('testScenariosCount');
  
  if (!container || !accordionContainer) return;
  
  container.innerHTML = '';
  accordionContainer.style.display = 'block';
  
  // Update test scenarios count badge
  if (testScenariosCount) {
    testScenariosCount.textContent = testDescriptions.length;
  }
  
  testDescriptions.forEach(test => {
    const cardElement = document.createElement('div');
    cardElement.className = 'test-description-card';
    cardElement.setAttribute('data-test-number', test.testNumber);

    cardElement.innerHTML = `
      <div class="scenario-card-inner">
        <div class="scenario-card-face scenario-card-front">
          <div class="scenario-card-header">
            <div class="test-number-badge">${escapeHtml(String(test.testNumber))}</div>
            <div class="test-description-text">${escapeHtml(test.description || '')}</div>
            <button type="button" class="btn btn-sm scenario-edit-toggle ml-auto" title="Edit scenario"><i class="bi-pencil mr-1"></i>Edit</button>
          </div>
          <div class="scenario-card-actions">
            <button type="button" class="btn btn-sm btn-outline-secondary scenario-copy-to-next-btn" data-copy-from="${test.testNumber}" title="Copy this column to next scenario">
              <i class="bi-arrow-right-circle"></i> Copy to Next
            </button>
            <button type="button" class="scenario-run-btn" data-run-scenario="${test.testNumber}">
              <i class="bi-play-fill"></i> Run
            </button>
          </div>
        </div>
        <div class="scenario-card-face scenario-card-back">
          <div class="scenario-card-back-header">
            <label class="text-muted small mb-0">Edit scenario</label>
            <button type="button" class="scenario-flip-back-btn scenario-edit-cancel" title="Back to front"><i class="bi-arrow-left"></i> Back</button>
          </div>
          <textarea class="scenario-edit-input" rows="2" placeholder="Scenario description...">${escapeHtml(test.description || '')}</textarea>
          <div class="scenario-card-back-actions">
            <button type="button" class="btn btn-outline-secondary btn-sm scenario-edit-cancel">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm scenario-edit-save">Save</button>
          </div>
        </div>
      </div>
    `;

    const frontFace = cardElement.querySelector('.scenario-card-front');
    const editInput = cardElement.querySelector('.scenario-edit-input');
    const runBtn = cardElement.querySelector('.scenario-run-btn');
    const saveBtn = cardElement.querySelector('.scenario-edit-save');

    function flipToBack() {
      cardElement.classList.add('flipped');
      setTimeout(() => editInput?.focus(), 100);
    }

    function flipToFront() {
      cardElement.classList.remove('flipped');
    }

    frontFace.addEventListener('click', (e) => {
      if (e.target.closest('.scenario-run-btn') || e.target.closest('.scenario-edit-toggle') || e.target.closest('.scenario-copy-to-next-btn')) return;
      document.querySelectorAll('.test-description-card').forEach(card => {
        card.classList.remove('test-scenario-active');
      });
      cardElement.classList.add('test-scenario-active');
      highlightTestColumn(test.testNumber);
    });

    runBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runTests(test.testNumber);
    });

    const copyToNextBtn = cardElement.querySelector('.scenario-copy-to-next-btn');
    if (copyToNextBtn) {
      copyToNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (copyColumnToNext(test.testNumber)) {
          showToast(`Copied Test ${test.testNumber} to next column`, 'success');
        } else {
          showToast('No next column to copy to', 'warning');
        }
      });
    }

    const editIcon = cardElement.querySelector('.scenario-edit-toggle');
    editIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      flipToBack();
    });

    saveBtn.addEventListener('click', () => {
      const newDesc = (editInput?.value || '').trim();
      const idx = testDescriptionsData.findIndex(t => t.testNumber === test.testNumber);
      if (idx >= 0) testDescriptionsData[idx].description = newDesc;
      const textEl = cardElement.querySelector('.test-description-text');
      if (textEl) textEl.textContent = newDesc || '(No description)';
      flipToFront();
    });

    cardElement.querySelectorAll('.scenario-edit-cancel').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        editInput.value = test.description || '';
        flipToFront();
      });
    });

    container.appendChild(cardElement);
  });
}

function hideScenarioContextMenu() {
  document.querySelectorAll('.scenario-context-menu').forEach((m) => m.remove());
}

function updateLoanGuidChipDisplay(value) {
  if (!loanGuidChip) return;
  const displayValue = value ? value : 'No Loan GUID';
  loanGuidChip.textContent = displayValue;
  loanGuidChip.title = value || '';
}

function updateRunSummary(passed, failed, skipped, total) {
  if (!runSummaryCard) return;
  const timestamp = new Date();
  runSummaryCard.style.display = 'block';
  if (runSummaryTime) {
    runSummaryTime.textContent = `Last run ${timestamp.toLocaleString()}`;
  }
  if (runSummaryCounts) {
    runSummaryCounts.textContent = `${total} scenarios • ${passed} passed • ${failed} failed`;
  }

  const passPercent = total ? Math.round((passed / total) * 100) : 0;
  const skipPercent = total ? Math.round((skipped / total) * 100) : 0;
  const failPercent = total ? Math.max(0, 100 - passPercent - skipPercent) : 0;

  if (runSummaryPassBar) runSummaryPassBar.style.width = `${passPercent}%`;
  if (runSummarySkipBar) runSummarySkipBar.style.width = `${skipPercent}%`;
  if (runSummaryFailBar) runSummaryFailBar.style.width = `${failPercent}%`;

  lastRunSummary = {
    timestamp: timestamp.toISOString(),
    passed,
    failed,
    skipped,
    total
  };
}

function getRecentRuns() {
  try {
    const stored = localStorage.getItem(RECENT_RUNS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to read recent runs', error);
    return [];
  }
}

function saveRecentRun() {
  if (!currentLoanGuid || !lastRunSummary) return;
  try {
    const runs = getRecentRuns().filter(run => run.loanGuid !== currentLoanGuid);
    runs.unshift({
      loanGuid: currentLoanGuid,
      ...lastRunSummary
    });
    const trimmed = runs.slice(0, 5);
    localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(trimmed));
    renderRecentRunsSelect(trimmed);
  } catch (error) {
    console.warn('Unable to save recent run', error);
  }
}

function renderRecentRunsSelect(runs = getRecentRuns()) {
  if (!recentRunsSelect) return;
  recentRunsSelect.innerHTML = '<option value="">Recent runs…</option>';
  runs.forEach(run => {
    const option = document.createElement('option');
    option.value = run.loanGuid;
    const stamp = run.timestamp ? new Date(run.timestamp).toLocaleString() : 'Unknown time';
    const summary = `${run.passed}/${run.total} passed`;
    option.textContent = `${run.loanGuid} • ${stamp} • ${summary}`;
    recentRunsSelect.appendChild(option);
  });
}

function summarizeStatus(bucket) {
  if (!bucket || bucket.total === 0) return 'empty';
  if (bucket.failed > 0) return 'fail';
  if (bucket.passed > 0 && bucket.skipped === 0) return 'success';
  if (bucket.passed > 0 || bucket.skipped > 0) return 'warn';
  return 'empty';
}

function buildBadge(action, status) {
  const labelMap = {
    success: `${action} OK`,
    warn: `${action} WARN`,
    fail: `${action} FAIL`,
    empty: `${action} N/A`
  };
  return `<span class="scenario-status-badge ${status}">${labelMap[status]}</span>`;
}

function updateScenarioBadges(results = []) {
  const perTest = {};
  const global = {
    SET: { passed: 0, failed: 0, skipped: 0, total: 0 },
    GET: { passed: 0, failed: 0, skipped: 0, total: 0 }
  };

  results.forEach(result => {
    const action = (result.action || '').toUpperCase();
    if (!global[action]) return;
    const bucketKey = result.status === 'info' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    global[action][bucketKey] += 1;
    global[action].total += 1;

    if (result.testNumber) {
      if (!perTest[result.testNumber]) {
        perTest[result.testNumber] = { SET: { passed: 0, failed: 0, skipped: 0, total: 0 }, GET: { passed: 0, failed: 0, skipped: 0, total: 0 } };
      }
      if (perTest[result.testNumber][action]) {
        perTest[result.testNumber][action][bucketKey] += 1;
        perTest[result.testNumber][action].total += 1;
      }
    }
  });

  document.querySelectorAll('.scenario-status-badges').forEach(container => {
    const testNumber = container.getAttribute('data-test-number');
    const setBucket = (perTest[testNumber] && perTest[testNumber].SET) ? perTest[testNumber].SET : global.SET;
    const getBucket = (perTest[testNumber] && perTest[testNumber].GET) ? perTest[testNumber].GET : global.GET;
    const setStatus = summarizeStatus(setBucket);
    const getStatus = summarizeStatus(getBucket);
    container.innerHTML = `${buildBadge('SET', setStatus)}${buildBadge('GET', getStatus)}`;
  });
}

function focusFirstFailedStep() {
  if (!gridApi || !lastRunResults.length) return;
  const failed = lastRunResults.find(result => result.status === 'err');
  if (!failed || failed.rowIndex === undefined) {
    setStatus('No failed steps found', 'ok', 'bi-check-circle');
    return;
  }
  showAccordionSection('collapseTestGrid');
  if (typeof gridApi.ensureIndexVisible === 'function') {
    gridApi.ensureIndexVisible(failed.rowIndex, 'middle');
  }
  if (typeof gridApi.getDisplayedRowAtIndex === 'function') {
    const rowNode = gridApi.getDisplayedRowAtIndex(failed.rowIndex);
    rowNode?.setSelected(true);
  }
}

function highlightTestColumn(testNumber) {
  if (!gridApi) return;
  
  // Remove existing highlights
  removeColumnHighlight();
  
  // Find the column that matches this test number
  // Test columns are typically named "Test 1", "Test1", "Test #1", etc.
  const testColumnPatterns = [
    `Test ${testNumber}`,
    `Test${testNumber}`,
    `Test #${testNumber}`,
    `Test#${testNumber}`,
    `Test-${testNumber}`,
    `Test_${testNumber}`
  ];
  
  let columnIdToHighlight = null;
  
  // Try to find matching column in columnDefs first
  for (const colDef of columnDefs) {
    const headerName = colDef.headerName || colDef.field || '';
    const field = colDef.field || '';
    
    // Check if this column matches any pattern
    const matches = testColumnPatterns.some(pattern => {
      const patternLower = pattern.toLowerCase();
      const headerLower = String(headerName || '').toLowerCase();
      const fieldLower = String(field || '').toLowerCase();
      return headerLower.includes(patternLower) || fieldLower.includes(patternLower);
    });
    
    if (matches) {
      columnIdToHighlight = colDef.field;
      break;
    }
  }
  
  // If no exact match, try to find by test number in column header
  if (!columnIdToHighlight) {
    for (const colDef of columnDefs) {
      const headerName = String(colDef.headerName || colDef.field || '').toLowerCase();
      
      // Check if header contains the test number
      if (headerName.includes('test') && headerName.includes(testNumber)) {
        columnIdToHighlight = colDef.field;
        break;
      }
    }
  }
  
  if (columnIdToHighlight) {
    // Ensure column is visible
    if (typeof gridApi.setColumnVisible === 'function') {
      gridApi.setColumnVisible(columnIdToHighlight, true);
    }
    
    // Scroll to column
    if (typeof gridApi.ensureColumnVisible === 'function') {
      gridApi.ensureColumnVisible(columnIdToHighlight);
    }
    
    // Add CSS class for highlighting using ag-grid's column API
    setTimeout(() => {
      // Find header element by col-id attribute
      const headerElements = document.querySelectorAll(`[col-id="${columnIdToHighlight}"]`);
      
      if (headerElements.length > 0) {
        headerElements.forEach(element => {
          element.classList.add('column-highlighted');
        });
      } else {
        // Fallback: find by header text or field name
        const allHeaders = document.querySelectorAll('.ag-header-cell');
        allHeaders.forEach(header => {
          const headerText = header.textContent || '';
          const headerLower = headerText.toLowerCase();
          const colId = header.getAttribute('col-id') || '';
          
          // Check if this header matches our column
          if (colId === columnIdToHighlight || 
              (headerLower.includes('test') && headerLower.includes(testNumber))) {
            header.classList.add('column-highlighted');
            
            // Find and highlight all cells in this column
            const colIndex = header.getAttribute('aria-colindex');
            if (colIndex) {
              const cells = document.querySelectorAll(`[aria-colindex="${colIndex}"]`);
              cells.forEach(cell => cell.classList.add('column-highlighted'));
            }
            
            // Also try by col-id on cells
            const cellsByColId = document.querySelectorAll(`[col-id="${columnIdToHighlight}"]`);
            cellsByColId.forEach(cell => cell.classList.add('column-highlighted'));
          }
        });
      }
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        removeColumnHighlight();
      }, 3000);
    }, 100);
  } else {
    // If column not found, show a brief message
    const originalStatus = statusChip.textContent;
    setStatus(`Test ${testNumber} column not found`, 'info', 'bi-info-circle');
    setTimeout(() => {
      setStatus(originalStatus, 'ok', 'bi-check-circle');
    }, 2000);
  }
}

function removeColumnHighlight() {
  const highlightedElements = document.querySelectorAll('.column-highlighted');
  highlightedElements.forEach(el => {
    el.classList.remove('column-highlighted');
  });
}

/**
 * Save test execution to database
 * @returns {Promise<{execution?: {tested_at: string}}|null>} Result on success, null on failure
 */
async function saveTestExecutionToDatabase(fileName, testNumber, testedBy) {
  try {
    const response = await fetch('/api/unit-tests/executions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        testNumber,
        testedBy
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to save test execution:', error);
      return null;
    }

    const result = await response.json();
    console.log('Test execution saved:', result);

    return result;
  } catch (error) {
    console.error('Error saving test execution:', error);
    return null;
  }
}

/**
 * Load test executions from database.
 * Returns { executions, dbUnavailable } - dbUnavailable true when DB was unreachable.
 */
async function loadTestExecutionsFromDatabase(fileName) {
  if (!fileName) return { executions: {}, dbUnavailable: false };

  try {
    const response = await fetch(`/api/unit-tests/executions?fileName=${encodeURIComponent(fileName)}`);

    if (!response.ok) {
      console.warn('Test executions unavailable, using empty state');
      return { executions: {}, dbUnavailable: true };
    }

    const result = await response.json();
    return {
      executions: result.executions || {},
      dbUnavailable: !!result.dbUnavailable
    };
  } catch (error) {
    console.warn('Error loading test executions:', error);
    return { executions: {}, dbUnavailable: true };
  }
}

/** Tester options for Overall Sign-off (file-level) */
const OVERALL_SIGNOFF_TESTERS = [
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'UAT TESTER', label: 'UAT Tester' },
  { value: 'POST RELEASE TESTER', label: 'Post Release Tester' }
];

/**
 * Display Overall Test Sign-off section (file-level, one sign-off per tester with timestamp)
 * @param {object} executions - { overall: { DEVELOPER: { testedAt }, ... } }
 * @param {boolean} [dbUnavailable] - when true, show hint that DB was unreachable
 */
function displayOverallSignOff(executions, dbUnavailable) {
  const container = document.getElementById('overallSignOffContainer');
  if (!container) return;

  const overall = (executions && executions['overall']) || {};

  container.innerHTML = '';

  if (dbUnavailable) {
    const hint = document.createElement('div');
    hint.className = 'text-muted small mb-2';
    hint.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Database temporarily unavailable — sign-off status may be outdated';
    container.appendChild(hint);
  }

  OVERALL_SIGNOFF_TESTERS.forEach(({ value, label }) => {
    const exec = overall[value];
    const testedAt = exec && exec.testedAt ? exec.testedAt : null;

    const row = document.createElement('div');
    row.className = 'overall-signoff-row' + (testedAt ? ' confirmed' : '');
    row.setAttribute('data-tester', value);

    const labelEl = document.createElement('span');
    labelEl.className = 'tester-label';
    labelEl.textContent = label;

    const right = document.createElement('div');
    right.className = 'd-flex align-items-center gap-2';

    if (testedAt) {
      const date = new Date(testedAt);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const ts = document.createElement('span');
      ts.className = 'tester-timestamp';
      ts.textContent = `Confirmed ${dateStr} ${timeStr}`;
      ts.title = date.toLocaleString();
      right.appendChild(ts);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-primary btn-confirm';
      btn.innerHTML = '<i class="bi-check2"></i> Confirm';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Saving...';
        const result = await saveTestExecutionToDatabase(currentFileName, 'overall', value);
        if (result && result.execution) {
          displayOverallSignOff({ ...(executions || {}), overall: { ...(overall || {}), [value]: { testedAt: result.execution.tested_at } } }, false);
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi-check2"></i> Confirm';
        }
      });
      right.appendChild(btn);
    }

    row.appendChild(labelEl);
    row.appendChild(right);
    container.appendChild(row);
  });

  // Update sign-off complete badge on accordion header
  const confirmedCount = OVERALL_SIGNOFF_TESTERS.filter(({ value }) => overall[value]?.testedAt).length;
  const badgeEl = document.getElementById('signOffCompleteBadge');
  if (badgeEl) {
    badgeEl.style.display = confirmedCount >= 3 ? 'inline-block' : 'none';
  }
}

function hideTestDescriptions() {
  const container = document.getElementById('testDescriptionsContainer');
  const testScenariosCount = document.getElementById('testScenariosCount');
  if (container) {
    container.innerHTML = '<div class="text-muted"><small>No test scenario descriptions found in this file.</small></div>';
  }
  if (testScenariosCount) {
    testScenariosCount.textContent = '0';
  }
}

async function runTests(singleTestNumber) {
  if (!allData || allData.length === 0) {
    setStatus('No test data loaded', 'err', 'bi-exclamation-octagon');
    return;
  }

  const isSingleRun = !!singleTestNumber;

  try {
    setStatus('Running tests...', 'info', 'bi-clock-history');
    runTestsBtn.disabled = true;
    hideNonTestColumns();
    if (!isSingleRun) {
      testResultsContainer.style.display = 'block';
      testResultsList.innerHTML = '<div class="text-center p-4"><i class="bi-hourglass-split" style="font-size: 2rem;"></i><p class="mt-2">Running tests...</p></div>';
      const scrollToTopBtnEl = document.getElementById('scrollToTopBtn');
      if (scrollToTopBtnEl) scrollToTopBtnEl.style.display = 'none';
    }

    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Run per scenario (Test 1, Test 2, ...); if singleTestNumber provided, run only that one
    let columnsToRun;
    if (isSingleRun) {
      const col = findTestColumnByNumber(String(singleTestNumber));
      if (!col) {
        showToast(`Scenario ${singleTestNumber} not found`, 'warning');
        runTestsBtn.disabled = false;
        return;
      }
      columnsToRun = [col];
    } else {
      const scenarioColumns = getOrderedTestColumns().filter((c) => c.testNumber && c.testNumber !== 'RESET');
      columnsToRun = scenarioColumns.length > 0 ? scenarioColumns : [null];
    }

    const getCache = {}; // key: `${scenario}-${rowIndex}-${fieldId}` — loan state differs per scenario (each runs its own SETs)
    lastRunCellResults = {}; // Clear previous run; build incrementally as each scenario completes

    for (const testColumn of columnsToRun) {
      for (let i = 0; i < allData.length; i++) {
        const row = allData[i];
        const step = row.Step || row.step || (i + 1);
        const action = row.Action || row.action || '';
        const target = row.Target || row.target || '';
        const description = row.Description || row.description || '';

        // Skip EOF marker row (X in Step column)
        if (String(step).trim().toUpperCase() === 'X') continue;

        // Skip display-only placeholder rows (Actual Results, Overall Test Results)
        if (!action || String(action).trim() === '') continue;

        const fieldId = extractFieldId(target);

        if (!fieldId) {
          skipped++;
          results.push({
            step,
            action,
            target,
            description,
            status: 'skipped',
            message: 'No field ID found in Target',
            rowIndex: i,
            testNumber: testColumn ? testColumn.testNumber : null
          });
          continue;
        }

        const testValues = {};
        Object.keys(row).forEach(key => {
          if (key.toLowerCase().startsWith('test')) {
            testValues[key] = row[key];
          }
        });

        const result = {
          step,
          action: String(action || '').trim().toUpperCase(),
          target: fieldId,
          description,
          status: 'pending',
          message: '',
          rowIndex: i,
          testNumber: testColumn ? testColumn.testNumber : null
        };

        const actionNorm = String(action || '').trim().toLowerCase();
        const currentCol = testColumn || pickTestColumnForRow(row);

        if (actionNorm === 'set') {
          if (!currentLoanGuid) {
            result.status = 'skipped';
            result.message = 'Missing Loan GUID for Set call';
          } else {
            if (typeof console !== 'undefined' && console.debug) {
              console.debug(`[UnitTest SET] Step ${step} | ${fieldId} | Test ${result.testNumber || 'N/A'}`);
            }
            const rawSetValue = currentCol ? row[currentCol.field] : null;
            const hasValue = rawSetValue !== null && rawSetValue !== undefined && String(rawSetValue).trim() !== '';
            const setValue = hasValue && isBlankForTest(rawSetValue) ? '' : rawSetValue;
            if (!currentCol || !hasValue) {
              result.status = 'skipped';
              result.message = 'Skipped (no value to set — field left as-is)';
            } else {
            try {
              // If description is "Field X", do a read first to enrich from API (we need metadata anyway)
              const desc = String(row.Description || row.description || '').trim();
              if (/^Field\s+.+$/i.test(desc)) {
                try {
                  const readResp = await (window.encompassApi?.encompassFetch || fetch)(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-reader?invalidFieldBehavior=Include&includeMetadata=true`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([fieldId])
                  });
                  if (readResp.ok) {
                    const readData = await readResp.json();
                    maybeUpdateDescriptionFromApi(row, fieldId, readData, gridApi, i);
                  }
                } catch (_) { /* ignore read failure */ }
              }
              const body = buildFieldWriterPayload(fieldId, setValue, row);
              const response = await (window.encompassApi?.encompassFetch || fetch)(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-writer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              if (!response.ok) {
                let errMsg = '';
                let isReadOnlyField = false;
                try {
                  const errJson = await response.json();
                  const errors = errJson.upstream?.errors || errJson.errors || [];
                  const detailsStr = [errJson.details, errJson.summary]
                    .concat(errors.map((e) => e && (e.details || e.message || e.detail || e.error)))
                    .filter(Boolean)
                    .join(' ');
                  if (/can not be updated|Calculated field|read.?only|cannot be (written|updated)/i.test(detailsStr)) {
                    isReadOnlyField = true;
                  }
                  if (!isReadOnlyField) {
                    const parts = [errJson.details, errJson.summary];
                    if (Array.isArray(errors) && errors.length) {
                      parts.push(errors.map((e) => (e && (e.details || e.message || e.detail || e.error)) || JSON.stringify(e)).join('; '));
                    }
                    errMsg = parts.filter(Boolean).join(' — ');
                  }
                } catch (_) {
                  errMsg = await response.text();
                }
                if (isReadOnlyField) {
                  result.status = 'skipped';
                  result.message = `Skipped: calculated/read-only field — cannot be set by API`;
                } else {
                  result.status = 'err';
                  result.message = `Set failed (${response.status}): ${errMsg || 'Unknown error'}`;
                }
              } else {
                result.status = 'info';
                result.message = `SET ${fieldId} succeeded • Value: ${JSON.stringify(setValue)}`;
              }
            } catch (error) {
              result.status = 'err';
              result.message = `Set error: ${error.message}`;
            }
          }
        }
      } else if (actionNorm === 'get') {
        if (!currentLoanGuid) {
          result.status = 'skipped';
          result.message = 'Missing Loan GUID for Get call';
        } else {
          const scenarioKey = testColumn ? testColumn.testNumber : 'single';
          const getCacheKey = `${scenarioKey}-${i}-${fieldId}`;
          if (!getCache[getCacheKey]) {
            try {
              const response = await (window.encompassApi?.encompassFetch || fetch)(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-reader?invalidFieldBehavior=Include&includeMetadata=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([fieldId])
              });
              let value = null;
              if (!response.ok) {
                const errorText = await response.text();
                getCache[getCacheKey] = { status: 'err', message: `Get failed (${response.status}): ${errorText || 'Unknown error'}` };
              } else {
                const data = await response.json();
                value = extractFieldValueFromReaderResponse(data, fieldId);
                const displayValue = value === null || value === undefined ? 'No value returned' : JSON.stringify(value);
                getCache[getCacheKey] = { status: 'info', message: `GET ${fieldId}: ${displayValue}`, value };
                maybeUpdateDescriptionFromApi(row, fieldId, data, gridApi, i);
                if (value !== null && value !== undefined && currentCol) {
                  row[currentCol.field] = value;
                  if (gridApi?.getDisplayedRowAtIndex) {
                    const rowNode = gridApi.getDisplayedRowAtIndex(i);
                    if (rowNode) rowNode.setDataValue(currentCol.field, value);
                  }
                }
              }
            } catch (error) {
              getCache[getCacheKey] = { status: 'err', message: `Get error: ${error.message}` };
            }
          }
          const cached = getCache[getCacheKey];
          result.status = cached.status;
          result.message = cached.message;
          if (typeof console !== 'undefined' && console.debug) {
            console.debug(`[UnitTest GET] Step ${step} | ${fieldId} | Test ${result.testNumber || 'N/A'} | ${cached.status}`);
          }
          if (cached.value !== null && cached.value !== undefined && currentCol) {
            row[currentCol.field] = cached.value;
            if (gridApi?.getDisplayedRowAtIndex) {
              const rowNode = gridApi.getDisplayedRowAtIndex(i);
              if (rowNode) rowNode.setDataValue(currentCol.field, cached.value);
            }
          }
        }
      } else if (actionNorm === 'compare') {
        if (!currentLoanGuid) {
          result.status = 'skipped';
          result.message = 'Missing Loan GUID for Compare';
        } else if (!currentCol) {
          result.status = 'skipped';
          result.message = 'No test column for Compare';
        } else {
          const expectedValue = row[currentCol.field];
          const hasExpected = expectedValue !== null && expectedValue !== undefined && String(expectedValue).trim() !== '';
          if (!hasExpected) {
            result.status = 'skipped';
            result.message = 'No expected value in column for Compare';
          } else {
            try {
              const response = await (window.encompassApi?.encompassFetch || fetch)(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-reader?invalidFieldBehavior=Include&includeMetadata=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([fieldId])
              });
              if (!response.ok) {
                const errorText = await response.text();
                result.status = 'err';
                result.message = `Compare GET failed (${response.status}): ${errorText || 'Unknown error'}`;
              } else {
                const data = await response.json();
                maybeUpdateDescriptionFromApi(row, fieldId, data, gridApi, i);
                const actualValue = extractFieldValueFromReaderResponse(data, fieldId);
                const expectedStr = String(expectedValue).trim();
                const actualStr = actualValue === null || actualValue === undefined ? '' : String(actualValue).trim();
                const expectedBlank = isBlankForTest(expectedStr);
                const actualBlank = isBlankForTest(actualStr);
                const numExpected = Number(expectedStr);
                const numActual = Number(actualStr);
                const bothNumeric = actualStr !== '' && expectedStr !== '' && !Number.isNaN(numExpected) && !Number.isNaN(numActual);
                const same = expectedStr === actualStr
                  || (expectedBlank && actualBlank)
                  || (bothNumeric && numExpected === numActual)
                  || (expectedStr.toLowerCase() === actualStr.toLowerCase());
                if (same) {
                  result.status = 'info';
                  result.message = `COMPARE ${fieldId} passed • Expected: ${JSON.stringify(expectedValue)}`;
                } else {
                  result.status = 'err';
                  result.message = `Compare mismatch: expected ${JSON.stringify(expectedValue)}, got ${actualValue === null || actualValue === undefined ? 'null' : JSON.stringify(actualValue)}`;
                }
              }
            } catch (error) {
              result.status = 'err';
              result.message = `Compare error: ${error.message}`;
            }
          }
        }
      } else {
        result.status = 'skipped';
        result.message = `Unknown action: ${action}`;
      }
      
      if (result.status === 'info') {
        passed++;
      } else if (result.status === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
      
      results.push(result);
      }

      // After each scenario: update cell shading and refresh grid so results appear immediately
    for (const r of results) {
      if (r.rowIndex == null || !r.testNumber) continue;
      if (testColumn && r.testNumber !== testColumn.testNumber) continue;
      const col = findTestColumnByNumber(r.testNumber);
      if (!col?.field) continue;
      const key = `${r.rowIndex}-${col.field}`;
      if (r.status === 'info') lastRunCellResults[key] = 'pass';
      else if (r.status === 'err') lastRunCellResults[key] = 'fail';
    }
    if (gridApi?.refreshCells) {
      gridApi.refreshCells({ force: true });
    }
    }

    // lastRunCellResults already built incrementally; ensure final state
    for (const r of results) {
      if (r.rowIndex == null || !r.testNumber) continue;
      const col = findTestColumnByNumber(r.testNumber);
      if (!col?.field) continue;
      const key = `${r.rowIndex}-${col.field}`;
      if (r.status === 'info') lastRunCellResults[key] = 'pass';
      else if (r.status === 'err') lastRunCellResults[key] = 'fail';
    }
    if (gridApi?.refreshCells) {
      gridApi.refreshCells({ force: true });
    }

    updateScenarioBadges(results);
    lastRunResults = results;
    saveRecentRun();
    if (failFirstBtn) {
      failFirstBtn.disabled = failed === 0;
    }

    const scenarioSummary = aggregateResultsByScenario(results);
    const scenarioPassed = scenarioSummary.filter(s => s.passed).length;
    const scenarioFailed = scenarioSummary.filter(s => !s.passed && !s.skipped).length;
    const scenarioSkipped = scenarioSummary.filter(s => s.skipped).length;
    const scenarioTotal = scenarioSummary.length;

    if (isSingleRun) {
      const msg = `Test ${singleTestNumber}: ${passed} passed, ${failed} failed, ${skipped} skipped`;
      showToast(msg, scenarioFailed > 0 ? 'warning' : 'success');
      setStatus(msg, scenarioFailed > 0 ? 'err' : 'ok', scenarioFailed > 0 ? 'bi-exclamation-octagon' : 'bi-check-circle');
    } else {
      displayTestResults(results, scenarioSummary, scenarioPassed, scenarioFailed, scenarioSkipped, scenarioTotal);
      updateRunSummary(scenarioPassed, scenarioFailed, scenarioSkipped, scenarioTotal);
      setStatus(`Tests complete: ${scenarioPassed} passed, ${scenarioFailed} failed`,
        failed > 0 ? 'err' : 'ok',
        failed > 0 ? 'bi-exclamation-octagon' : 'bi-check-circle');
      const summary = scenarioFailed > 0
        ? `Tests complete. ${scenarioPassed} scenarios passed, ${scenarioFailed} failed.`
        : `All scenarios passed. ${scenarioPassed} passed.`;
      speak(summary);
    }

  } catch (error) {
    console.error('Error running tests:', error);
    setStatus(`Error running tests: ${error.message}`, 'err', 'bi-exclamation-octagon');
    if (isSingleRun) {
      showToast(`Error: ${error.message}`, 'error');
    } else {
      testResultsList.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
      const scrollToTopBtnEl = document.getElementById('scrollToTopBtn');
      if (scrollToTopBtnEl) scrollToTopBtnEl.style.display = 'none';
    }
  } finally {
    runTestsBtn.disabled = false;
  }
}

function aggregateResultsByScenario(results) {
  const byScenario = {};
  results.forEach((r) => {
    const key = r.testNumber != null ? String(r.testNumber) : 'single';
    if (!byScenario[key]) {
      byScenario[key] = { testNumber: r.testNumber, steps: [] };
    }
    byScenario[key].steps.push(r);
  });
  const descMap = {};
  (testDescriptionsData || []).forEach((t) => {
    descMap[String(t.testNumber)] = t.description || '';
  });
  return Object.keys(byScenario)
    .sort((a, b) => (a === 'single' ? 1 : 0) - (b === 'single' ? 1 : 0) || String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map((key) => {
      const s = byScenario[key];
      const steps = s.steps;
      const compareSteps = steps.filter((r) => (r.action || '').toUpperCase() === 'COMPARE');
      const hasComparePass = compareSteps.some((r) => r.status === 'info');
      const hasPass = steps.some((r) => r.status === 'info');
      const allSkipped = steps.every((r) => r.status === 'skipped');
      const passed = compareSteps.length === 0 ? (hasPass && !allSkipped) : hasComparePass;
      const skipped = allSkipped;
      return {
        testNumber: s.testNumber,
        key,
        description: descMap[key] || (key === 'single' ? 'Single run' : `Test ${s.testNumber}`),
        passed,
        skipped,
        steps
      };
    });
}

function displayTestResults(results, scenarioSummary, scenarioPassed, scenarioFailed, scenarioSkipped, scenarioTotal) {
  const passRate = scenarioTotal > 0 ? ((scenarioPassed / scenarioTotal) * 100).toFixed(1) : 0;
  testResultsSummary.textContent = `${scenarioTotal} scenarios • ${scenarioPassed} passed • ${scenarioFailed} failed (${passRate}% pass rate)`;

  let html = `<div class="scenario-results-layout scenario-results-dark" id="testResultsGrid">`;
  html += '<div class="scenario-results-list">';
  scenarioSummary.forEach((s, idx) => {
    const id = String(idx + 1).padStart(3, '0');
    const name = s.description || `Test ${s.testNumber}`;
    const status = s.skipped ? 'SKIP' : s.passed ? 'PASS' : 'FAIL';
    const statusClass = s.passed ? 'pass' : s.skipped ? 'skip' : 'fail';
    html += `
      <div class="scenario-result-item scenario-result-${statusClass}">
        <span class="scenario-id">${escapeHtml(id)}</span>
        <span class="scenario-name">${escapeHtml(name)}</span>
        <span class="scenario-status-badge scenario-status-${statusClass}">${status}</span>
      </div>
    `;
  });
  html += '</div>';
  html += '<div class="scenario-results-summary">';
  html += '<div class="scenario-summary-title">SUMMARY</div>';
  html += '<div class="scenario-summary-row"><span class="scenario-summary-label">Total Tests</span><span class="scenario-summary-value">' + scenarioTotal + '</span></div>';
  html += '<div class="scenario-summary-row"><span class="scenario-summary-label">Passed</span><span class="scenario-summary-value scenario-summary-pass">' + scenarioPassed + '</span></div>';
  html += '<div class="scenario-summary-row"><span class="scenario-summary-label">Failed</span><span class="scenario-summary-value scenario-summary-fail">' + scenarioFailed + '</span></div>';
  html += '</div>';
  html += '</div>';

  html += '<details class="scenario-debug-details mt-3"><summary class="scenario-debug-summary">Debug: all SET/GET steps</summary><div class="test-results-grid mt-2">';
  results.forEach((result) => {
    const statusClass = result.status === 'info' ? 'success' : result.status === 'skipped' ? 'warning' : 'danger';
    const scenarioLabel = result.testNumber ? ` <span class="badge text-bg-secondary me-1">Test ${result.testNumber}</span>` : '';
    const actionBadgeClass = statusClass === 'success' ? 'text-bg-success' : statusClass === 'warning' ? 'text-bg-warning' : 'text-bg-danger';
    html += `
      <div class="test-result-card test-result-${result.status} small">
        <div class="d-flex align-items-start">
          <span class="badge ${actionBadgeClass} me-2">${result.action}</span>
          <div class="flex-grow-1">
            <div><strong>Step ${result.step}</strong>${scenarioLabel}</div>
            <div class="text-muted small">${escapeHtml(result.description || result.target)}</div>
            <div class="test-result-message">${escapeHtml(result.message)}</div>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div></details>';

  testResultsList.innerHTML = html;

  const scrollToTopBtn = document.getElementById('scrollToTopBtn');
  if (scrollToTopBtn) {
    scrollToTopBtn.style.display = results.length > 10 ? 'inline-flex' : 'none';
  }
}

function clearData() {
  allData = [];
  columnDefs = [];
  testDescriptionsData = [];
  currentFileName = '';
  currentLoanGuid = '';
  lastRunResults = [];
  lastRunSummary = null;
  lastRunCellResults = {};
  resetCurrentFieldMetadataToFallback();

  if (gridApi) {
    setGridRows([]);
  }
  
  fileInput.value = '';
  searchInput.value = '';
  uploadArea.style.display = 'block';
  setHeroPostLoadActionsVisible(false);
  setUnitTestsWelcomeVisible(true);
  runTestsBtn.style.display = 'none';
  clearBtn.style.display = 'none';
  if (fillEmptyTestNullBtn) fillEmptyTestNullBtn.style.display = 'none';
  testResultsContainer.style.display = 'none';
  fileInfo.textContent = 'No file loaded';
  fileInfo.innerHTML = 'No file loaded';
  resultsMeta.textContent = '0 rows';
  hideTestDescriptions();
  removeColumnHighlight();
  if (stickyActionBar) {
    stickyActionBar.style.display = 'none';
  }
  if (loanGuidInput) {
    loanGuidInput.value = '';
  }
  updateLoanGuidChipDisplay('');
  if (runSummaryCard) {
    runSummaryCard.style.display = 'none';
  }
  if (failFirstBtn) {
    failFirstBtn.disabled = true;
  }
  
  // Hide accordion container and Selected Field
  const accordionContainer = document.getElementById('accordionContainer');
  if (accordionContainer) {
    accordionContainer.style.display = 'none';
  }
  const selectedFieldCard = document.getElementById('selectedFieldAccordionCard');
  if (selectedFieldCard) selectedFieldCard.style.display = 'none';
  currentScenarioBuilderField = null;
  const builderContainer = document.getElementById('liveScenarioBuilderContainer');
  if (builderContainer) builderContainer.style.display = 'none';
  
  // Hide AI Assistant
  if (window.unitTestsAI && window.unitTestsAI.hide) {
    window.unitTestsAI.hide();
  }
  
  setStatus('Ready', 'info', 'bi-info-circle');
}

async function handleFileUpload(file) {
  if (!file) return;
  
  // Validate file type (.xlsx only - exceljs does not support legacy .xls)
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  ];
  
  const validExtensions = ['.xlsx'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension && !validTypes.includes(file.type)) {
    setStatus('Invalid file type. Please upload .xlsx files.', 'err', 'bi-exclamation-octagon');
    return;
  }
  
  try {
    setStatus('Processing file...', 'info', 'bi-clock-history');
    
    const parsedData = await parseExcelFile(file);
    const { headers, rows, fileName: parsedFileName, testDescriptions } = parsedData;
    
    if (rows.length === 0) {
      setStatus('No data found in Excel file', 'err', 'bi-exclamation-octagon');
      return;
    }
    
    // Generate column definitions
    columnDefs = generateColumnDefs(headers, rows);
    allData = rows.map((r, i) => ({ ...r, __rowIndex: i }));
    lastRunCellResults = {};

    // Initialize grid if not already done
    initializeGrid();
    
    // Populate grid
    setGridRows(allData);
    if (gridApi && typeof gridApi.refreshCells === 'function') {
      gridApi.refreshCells({ force: true });
    }
    showAllColumns();

    resetCurrentFieldMetadataToFallback();
    scheduleUnitTestGridMetadataRefresh().then(({ dropdownCount }) => {
      if (dropdownCount > 0) {
        showToast(`Loaded metadata: ${dropdownCount} field(s) with dropdowns`, 'info');
      }
    }).catch(() => { /* API may be unavailable; grid still works with text editors */ });

    // Count scenario columns: Reset, Test 1..N; start after Description or Target
    const descIdx = headers.findIndex((h) => String(h || '').toLowerCase().trim() === 'description');
    const targetIdx = headers.findIndex((h) => /^target$/i.test(String(h || '').trim()));
    const scenarioStart = descIdx >= 0 ? descIdx + 1 : (targetIdx >= 0 ? targetIdx + 1 : 0);
    const scenarioColumns = [];
    for (let i = scenarioStart; i < headers.length; i++) {
      if (!isScenarioColumnHeader(headers[i])) break;
      scenarioColumns.push(headers[i]);
    }
    
    // Use Excel Test #/Test Plan if found; fill missing from actual column headers so we have one card per scenario
    const testCols = scenarioColumns.filter((h) => String(h || '').toLowerCase().trim() !== 'reset');
    const byNum = new Map((testDescriptions || []).map((t) => [String(t.testNumber), t.description]));
    const finalDescriptions = testCols.map((h) => {
      const testNum = extractTestNumberFromKey(h) || '';
      const desc = byNum.get(testNum) || (h || `Test ${testNum}`).trim();
      return { testNumber: testNum, description: desc };
    }).filter((t) => t.testNumber);
    
    // Store test descriptions globally for persistence
    testDescriptionsData = finalDescriptions;
    
    // Store current file name
    currentFileName = parsedFileName;
    
    // Load test executions from database
    const execResult = await loadTestExecutionsFromDatabase(parsedFileName);

    // Ensure accordion container is visible for grid/scenarios
    const accordionContainer = document.getElementById('accordionContainer');
    if (accordionContainer) {
      accordionContainer.style.display = 'block';
    }
    // Hide Selected Field accordion when loading from file (only shown for generated-from-custom-field)
    const selectedFieldCard = document.getElementById('selectedFieldAccordionCard');
    if (selectedFieldCard) selectedFieldCard.style.display = 'none';

    // Display Overall Test Sign-off (file-level; always show when file is loaded)
    displayOverallSignOff(execResult.executions, execResult.dbUnavailable);

    // Display test descriptions (scenarios) if available
    if (testDescriptionsData.length > 0) {
      displayTestDescriptions(testDescriptionsData);
    } else {
      hideTestDescriptions();
    }
    
    // Update UI
    uploadArea.style.display = 'none';
    setHeroPostLoadActionsVisible(true);
    setUnitTestsWelcomeVisible(false);
    runTestsBtn.style.display = 'inline-block';
    clearBtn.style.display = 'inline-block';
    if (fillEmptyTestNullBtn) fillEmptyTestNullBtn.style.display = 'inline-block';
    if (stickyActionBar) {
      stickyActionBar.style.display = 'flex';
    }
    updateLoanGuidChipDisplay(currentLoanGuid);
    renderRecentRunsSelect();
    updateScenarioBadges([]);
    
    // Show AI Assistant
    if (window.unitTestsAI && window.unitTestsAI.show) {
      window.unitTestsAI.show();
    }
    
    // Build enhanced file info with test descriptions
    let fileInfoHTML = `<strong>${parsedFileName}</strong>`;
    fileInfoHTML += ` <span class="text-muted">(${rows.length} test step${rows.length !== 1 ? 's' : ''}, ${headers.length} columns)</span>`;
    
    if (testDescriptionsData.length > 0) {
      fileInfoHTML += `<div class="mt-2"><small class="text-muted">Test Scenarios:</small> `;
      const testList = testDescriptionsData.map(test =>
        `<span class="badge text-bg-secondary me-1" title="${test.description}">Test ${test.testNumber}</span>`
      ).join('');
      fileInfoHTML += testList + `</div>`;
    } else if (scenarioColumns.length > 0) {
      fileInfoHTML += ` <span class="text-muted">• ${scenarioColumns.length} test scenario${scenarioColumns.length !== 1 ? 's' : ''}</span>`;
    }
    
    fileInfo.innerHTML = fileInfoHTML;
    
    updateResultsMeta();
    setStatus('File loaded successfully', 'ok', 'bi-check-circle');
    
  } catch (error) {
    console.error('Error processing file:', error);
    setStatus(`Error: ${error.message}`, 'err', 'bi-exclamation-octagon');
  }
}

// Test Library
async function loadTestLibrary() {
  if (!testLibraryList) return;
  try {
    const res = await fetch('/api/unit-tests/files');
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error(res.ok ? 'Invalid response from server' : `Server error (${res.status})`);
    }
    if (!res.ok) {
      const msg = data?.message || data?.error || `Server error (${res.status})`;
      throw new Error(msg);
    }
    if (!data.success || !Array.isArray(data.files)) {
      testLibraryList.innerHTML = '<p class="text-muted mb-0">No tests in library.</p>';
      return;
    }
    if (data.files.length === 0) {
      testLibraryList.innerHTML = '<p class="text-muted mb-0">No tests in library. Use "Save to Library" to add Excel files.</p>';
      return;
    }
    testLibraryList.innerHTML = data.files
      .map(
        (f) =>
          `<div class="d-flex justify-content-between align-items-center py-1 border-bottom border-light">
            <span class="text-truncate" style="max-width: 200px;" title="${(f.original_name || f.file_name || '').replace(/"/g, '&quot;')}">${(f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;')}</span>
            <span class="text-muted small ml-2">${f.row_count || 0} rows, ${Array.isArray(f.field_ids) ? f.field_ids.length : 0} fields</span>
            <span class="ml-2">
              <button class="btn btn-sm btn-outline-primary load-from-library" data-id="${f.id}" data-name="${(f.original_name || f.file_name || '').replace(/"/g, '&quot;')}" title="Load into grid"><i class="bi-folder2"></i> Load</button>
              <button class="btn btn-sm btn-outline-danger delete-from-library ml-1" data-id="${f.id}" title="Remove from library"><i class="bi-trash"></i></button>
            </span>
          </div>`
      )
      .join('');
    testLibraryList.querySelectorAll('.load-from-library').forEach((btn) => {
      btn.addEventListener('click', () => loadFileFromLibrary(btn.dataset.id, btn.dataset.name));
    });
    testLibraryList.querySelectorAll('.delete-from-library').forEach((btn) => {
      btn.addEventListener('click', () => deleteFileFromLibrary(btn.dataset.id));
    });
  } catch (err) {
    const msg = err?.message || 'Failed to load library.';
    testLibraryList.innerHTML = `<p class="text-danger mb-0">${msg.replace(/</g, '&lt;')}</p><button class="btn btn-sm btn-outline-secondary mt-1" id="retryLoadLibrary">Retry</button>`;
    document.getElementById('retryLoadLibrary')?.addEventListener('click', () => loadTestLibrary());
  }
}

async function loadFileFromLibrary(id, originalName) {
  const btn = document.querySelector(`.load-from-library[data-id="${id}"]`);
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/unit-tests/files/${id}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      let errMsg = `Failed to load (${res.status})`;
      if (contentType.includes('application/json')) {
        try {
          const errData = await res.json();
          errMsg = errData?.message || errData?.error || errMsg;
        } catch (_) {}
      }
      throw new Error(errMsg);
    }
    if (!contentType.includes('spreadsheet') && !contentType.includes('excel') && !contentType.includes('octet-stream')) {
      const text = await res.text();
      let errMsg = 'Server returned non-Excel response';
      try {
        const parsed = JSON.parse(text);
        errMsg = parsed?.message || parsed?.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const file = new File([blob], originalName || 'unit-test.xlsx', { type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await handleFileUpload(file);
    showToast('Loaded from library', 'ok');
  } catch (err) {
    showToast(err?.message || 'Failed to load from library', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteFileFromLibrary(id) {
  if (!confirm('Remove this test from the library?')) return;
  try {
    const res = await fetch(`/api/unit-tests/files/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await loadTestLibrary();
    if (fieldSearchResults && fieldSearchResults.style.display !== 'none') {
      const term = fieldIdSearchInput?.value?.trim();
      if (term) searchByFieldId(term);
    }
    showToast('Removed from library', 'ok');
  } catch (err) {
    showToast('Failed to remove', 'err');
  }
}

/**
 * Apply saved BR / Tool 8 payload from server into the unit test grid.
 * Fetches Encompass custom/native catalogs (cached) to enrich descriptions and grid editors.
 */
async function applyBrRulePayloadToGrid(sourceName, bodyText, sourceFormat) {
  if (!window.brRuleParser) {
    showToast('BR parser not loaded', 'err');
    return;
  }
  let metaLookup = {};
  try {
    metaLookup = await buildEncompassFieldMetadataLookupForUnitTests();
  } catch (_) {
    /* Hub offline — still load grid */
  }
  if (sourceFormat === 'tool8_field_matrix_json') {
    if (!window.tool8FieldMatrix) {
      showToast('Tool 8 parser not loaded', 'err');
      return;
    }
    const p = window.tool8FieldMatrix.parseTool8FieldMatrixJson(bodyText);
    if (p.error) {
      showToast(p.error, 'err');
      return;
    }
    const result = window.tool8FieldMatrix.generateUnitTestFromTool8FieldMatrix(p, { fieldMetadataLookup: metaLookup });
    if (!result || !result.rows || result.rows.length === 0) {
      showToast('No rows from Tool 8 JSON', 'warn');
      return;
    }
    loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
      fieldId: '',
      calculation: '',
      description: 'Tool 8 (Alchemist) field matrix',
    });
    return;
  }
  if (sourceFormat === 'encompass_br_vb_snippet') {
    const parsed = window.brRuleParser.parseBRConditionSnippet(bodyText);
    if (parsed.error) {
      showToast(parsed.error, 'err');
      return;
    }
    const result = window.brRuleParser.generateUnitTestFromBRRule(parsed, { fieldMetadataLookup: metaLookup });
    if (!result || !result.rows || result.rows.length === 0) {
      showToast('No rows generated from VB snippet', 'warn');
      return;
    }
    loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
      fieldId: '',
      calculation: String(bodyText).slice(0, 400),
      description: 'BR VB snippet',
    });
    return;
  }
  const parsed = window.brRuleParser.parseBRXml(bodyText);
  if (parsed.error) {
    showToast(parsed.error, 'err');
    return;
  }
  const result = window.brRuleParser.generateUnitTestFromBRRule(parsed, { fieldMetadataLookup: metaLookup });
  if (!result || !result.rows || result.rows.length === 0) {
    showToast('No rows from BR XML (needs advanced conditions)', 'warn');
    return;
  }
  loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
    fieldId: '',
    calculation: parsed.mainCondition ? parsed.mainCondition.expression : '',
    description: 'BR Rule: ' + (parsed.rule ? parsed.rule.name : ''),
  });
}

async function loadBrRuleLibrary() {
  if (!brRuleLibraryList) return;
  try {
    const res = await fetch('/api/unit-tests/br-rules');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Server error (${res.status})`);
    }
    if (!data.success || !Array.isArray(data.files)) {
      brRuleLibraryList.innerHTML = '<p class="text-muted mb-0">No saved rules.</p>';
      return;
    }
    if (data.files.length === 0) {
      brRuleLibraryList.innerHTML =
        '<p class="text-muted mb-0">No BR / Tool 8 files yet. Use <strong>Save to BR library</strong> in Generate from BR Rule, or upload here.</p>';
      return;
    }
    const fmtLabel = (f) => {
      const s = f.source_format || '';
      if (s === 'tool8_field_matrix_json') return 'Tool 8';
      if (s === 'encompass_br_vb_snippet') return 'VB';
      return 'XML';
    };
    brRuleLibraryList.innerHTML = data.files
      .map((f) => {
        const title = (f.display_name || f.original_name || f.file_name || 'Untitled').replace(/"/g, '&quot;');
        const safeTitle = (f.display_name || f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;');
        const nf = Array.isArray(f.field_ids) ? f.field_ids.length : 0;
        return `<div class="d-flex justify-content-between align-items-center py-1 border-bottom border-light">
            <span class="text-truncate" style="max-width: 160px;" title="${title}">${safeTitle}</span>
            <span class="badge bg-secondary ms-1">${fmtLabel(f)}</span>
            <span class="text-muted small ms-1">${nf} fields</span>
            <span class="ms-2">
              <button type="button" class="btn btn-sm btn-outline-primary load-br-rule-library" data-id="${f.id}" data-title="${title}" title="Load into grid"><i class="bi-folder2"></i> Load</button>
              <button type="button" class="btn btn-sm btn-outline-danger delete-br-rule-library ms-1" data-id="${f.id}" title="Delete"><i class="bi-trash"></i></button>
            </span>
          </div>`;
      })
      .join('');
    brRuleLibraryList.querySelectorAll('.load-br-rule-library').forEach((btn) => {
      btn.addEventListener('click', () => loadBrRuleFromLibrary(btn.dataset.id, btn.dataset.title));
    });
    brRuleLibraryList.querySelectorAll('.delete-br-rule-library').forEach((btn) => {
      btn.addEventListener('click', () => deleteBrRuleFromLibrary(btn.dataset.id));
    });
  } catch (err) {
    const msg = err?.message || 'Failed to load BR library.';
    brRuleLibraryList.innerHTML = `<p class="text-danger mb-0">${String(msg).replace(/</g, '&lt;')}</p>`;
  }
}

async function loadBrRuleFromLibrary(id, displayTitle) {
  const btn = document.querySelector(`.load-br-rule-library[data-id="${id}"]`);
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/unit-tests/br-rules/${id}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Failed (${res.status})`);
    }
    const f = data.file;
    if (!f || !f.body_text) throw new Error('Invalid response');
    const sourceName = 'Library: ' + (f.display_name || displayTitle || f.original_name || 'BR');
    await applyBrRulePayloadToGrid(sourceName, f.body_text, f.source_format);
    showToast('Loaded from BR library', 'ok');
  } catch (err) {
    showToast(err?.message || 'Failed to load rule', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteBrRuleFromLibrary(id) {
  if (!confirm('Remove this business rule from the server library?')) return;
  try {
    const res = await fetch(`/api/unit-tests/br-rules/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await loadBrRuleLibrary();
    if (fieldSearchResults && fieldSearchResults.style.display !== 'none') {
      const term = fieldIdSearchInput?.value?.trim();
      if (term) searchByFieldId(term);
    }
    showToast('Removed BR rule', 'ok');
  } catch (err) {
    showToast('Failed to remove', 'err');
  }
}

async function searchByFieldId(fieldId) {
  if (!fieldId || !fieldSearchResults || !fieldSearchTerm || !fieldSearchResultsList) return;
  try {
    const [resExcel, resBr] = await Promise.all([
      fetch(`/api/unit-tests/search?fieldId=${encodeURIComponent(fieldId)}`),
      fetch(`/api/unit-tests/br-rules/search?fieldId=${encodeURIComponent(fieldId)}`),
    ]);
    const dataExcel = await resExcel.json();
    const dataBr = await resBr.json();

    fieldSearchResults.style.display = 'block';
    fieldSearchTerm.textContent = fieldId;

    const excelFiles = resExcel.ok && dataExcel.success && Array.isArray(dataExcel.files) ? dataExcel.files : [];
    const brFiles = resBr.ok && dataBr.success && Array.isArray(dataBr.files) ? dataBr.files : [];

    if (excelFiles.length === 0 && brFiles.length === 0) {
      fieldSearchResultsList.innerHTML = '<p class="text-muted mb-0">No Excel tests or BR / Tool 8 rules reference this field.</p>';
      return;
    }

    let html = '';
    if (excelFiles.length > 0) {
      html += '<div class="small fw-bold mb-1">Excel unit tests</div>';
      html += excelFiles
        .map(
          (f) =>
            `<div class="d-flex justify-content-between align-items-center py-1">
              <span class="text-truncate" style="max-width: 180px;">${(f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;')}</span>
              <button type="button" class="btn btn-sm btn-outline-primary load-from-library" data-id="${f.id}" data-name="${(f.original_name || f.file_name || '').replace(/"/g, '&quot;')}"><i class="bi-folder2"></i> Load</button>
            </div>`,
        )
        .join('');
    }
    if (brFiles.length > 0) {
      html += '<div class="small fw-bold mt-2 mb-1">BR / Tool 8</div>';
      html += brFiles
        .map(
          (f) =>
            `<div class="d-flex justify-content-between align-items-center py-1">
              <span class="text-truncate" style="max-width: 160px;">${(f.display_name || f.original_name || f.file_name || 'Untitled').replace(/</g, '&lt;')}</span>
              <button type="button" class="btn btn-sm btn-outline-primary load-br-rule-search" data-id="${f.id}" data-title="${(f.display_name || f.original_name || '').replace(/"/g, '&quot;')}"><i class="bi-folder2"></i> Load</button>
            </div>`,
        )
        .join('');
    }
    fieldSearchResultsList.innerHTML = html;
    fieldSearchResultsList.querySelectorAll('.load-from-library').forEach((btn) => {
      btn.addEventListener('click', () => loadFileFromLibrary(btn.dataset.id, btn.dataset.name));
    });
    fieldSearchResultsList.querySelectorAll('.load-br-rule-search').forEach((btn) => {
      btn.addEventListener('click', () => loadBrRuleFromLibrary(btn.dataset.id, btn.dataset.title));
    });
  } catch (err) {
    fieldSearchResults.style.display = 'block';
    fieldSearchTerm.textContent = fieldId;
    fieldSearchResultsList.innerHTML = '<p class="text-danger mb-0">Search failed.</p>';
  }
}

// Event listeners
uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

uploadToLibraryBtn?.addEventListener('click', () => {
  libraryFileInput?.click();
});

libraryFileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/unit-tests/files', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    await loadTestLibrary();
    showToast('Saved to library', 'ok');
  } catch (err) {
    showToast(err.message || 'Failed to save to library', 'err');
  }
});

uploadBrRuleLibraryBtn?.addEventListener('click', () => {
  brRuleLibraryFileInput?.click();
});

brRuleLibraryFileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/unit-tests/br-rules/file', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || data.message || 'Upload failed');
    await loadBrRuleLibrary();
    showToast('Saved BR / Tool 8 to library', 'ok');
  } catch (err) {
    showToast(err.message || 'Failed to upload rule', 'err');
  }
});

fieldIdSearchBtn?.addEventListener('click', () => {
  const term = fieldIdSearchInput?.value?.trim();
  if (term) searchByFieldId(term);
});

fieldIdSearchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const term = fieldIdSearchInput?.value?.trim();
    if (term) searchByFieldId(term);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFileUpload(file);
  }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFileUpload(file);
  }
});

uploadArea.addEventListener('click', () => {
  fileInput.click();
});

exportCsvBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  exportToCSV();
});

exportExcelBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  exportToExcel();
});

clearAndReloadBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  clearData();
});

clearBtn.addEventListener('click', (e) => {
  e.preventDefault();
  clearData();
});

fillEmptyTestNullBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  fillEmptyScenarioCellsWithNull();
});

loanGuidInput?.addEventListener('input', (e) => {
  currentLoanGuid = e.target.value.trim();
  updateLoanGuidChipDisplay(currentLoanGuid);
});

clearLoanGuidBtn?.addEventListener('click', () => {
  currentLoanGuid = '';
  if (loanGuidInput) {
    loanGuidInput.value = '';
  }
  updateLoanGuidChipDisplay('');
});

recentRunsSelect?.addEventListener('change', (e) => {
  const selected = e.target.value;
  if (!selected) return;
  currentLoanGuid = selected;
  if (loanGuidInput) {
    loanGuidInput.value = selected;
  }
  updateLoanGuidChipDisplay(selected);
});

runTestsBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  runTests();
});

failFirstBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  focusFirstFailedStep();
});

document.getElementById('showAllColumnsBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  showAllColumns();
  showToast('All columns shown', 'info');
});

closeResultsBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  testResultsContainer.style.display = 'none';
});

document.getElementById('scrollToTopBtn')?.addEventListener('click', () => {
  const grid = document.getElementById('testResultsGrid');
  if (grid) grid.scrollTo({ top: 0, behavior: 'smooth' });
});

voiceHelpToggle?.addEventListener('click', () => toggleVoiceHelp());
voiceHelpClose?.addEventListener('click', () => toggleVoiceHelp(false));

searchInput.addEventListener('input', () => {
  applySearch();
});

// Paste Excel file from clipboard (Ctrl+V when file copied)
document.addEventListener('paste', (e) => {
  const files = e.clipboardData?.files;
  if (!files?.length) return;
  const file = Array.from(files).find(f => /\.xlsx$/i.test(f.name));
  if (!file) return;
  // Don't intercept if user is typing in an input/textarea
  const active = document.activeElement;
  if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) {
    return;
  }
  e.preventDefault();
  handleFileUpload(file);
});

function initializeVoiceWidget() {
  if (typeof initVoiceWidget !== 'function') return;
  voiceWidgetInstance = initVoiceWidget({
    position: 'bottom-right',
    theme: 'blue',
    onCommand: handleVoiceCommand,
  });
}

function handleVoiceCommand(rawCommand = '') {
  const command = rawCommand.toLowerCase().trim();
  if (!command) return;

  if (command.includes('show grid') || command.includes('open grid') || command.includes('show test grid')) {
    showAccordionSection('collapseTestGrid');
    speak('Showing test grid');
    return;
  }

  if (command.includes('show scenarios') || command.includes('show test scenarios') || command.includes('show tests')) {
    showAccordionSection('collapseTestScenarios');
    speak('Showing test scenarios');
    return;
  }

  if (command.includes('show library') || command.includes('show test library')) {
    showAccordionSection('collapseTestLibrary');
    speak('Showing test library');
    return;
  }

  if (command.includes('show commands') || command.includes('voice guide') || command.includes('show guide')) {
    toggleVoiceHelp(true);
    speak('Showing voice commands');
    return;
  }

  if (command.includes('hide commands') || command.includes('hide guide')) {
    toggleVoiceHelp(false);
    speak('Closing voice guide');
    return;
  }

  if (command.includes('run tests') || command.includes('run test')) {
    speak('Running tests');
    runTests();
    return;
  }

  if (command.includes('clear data') || command.includes('clear tests') || command.includes('reset data')) {
    speak('Clearing data');
    clearData();
    return;
  }

  if (command.includes('search for')) {
    const term = command.split('search for')[1]?.trim();
    if (!term) {
      speak('Please say search for followed by your term');
      return;
    }
    if (searchInput) {
      searchInput.value = term;
      applySearch();
      showAccordionSection('collapseTestGrid');
      speak(`Searching for ${term}`);
    }
    return;
  }

  if ((command.includes('analyze failures') || command.includes('analyse failures')) && lastRunResults?.length) {
    const failures = lastRunResults.filter((r) => r.status === 'err');
    if (failures.length === 0) {
      speak('No failures to analyze. All tests passed.');
      return;
    }
    showAccordionSection('collapseAIAssistant');
    if (window.unitTestsAI?.sendMessageWithContext) {
      window.unitTestsAI.sendMessageWithContext(
        'Analyze these test failures and suggest possible causes and fixes.',
        { results: lastRunResults, failures }
      );
      speak(`Sending ${failures.length} failure${failures.length === 1 ? '' : 's'} to the assistant for analysis.`);
    } else {
      const summary = failures.map((f) => `Step ${f.step} ${f.action}: ${f.message}`).join('. ');
      window.unitTestsAI?.sendMessage?.(`Analyze these test failures: ${summary}`);
      speak('Sending failures to the assistant.');
    }
    return;
  }

  // Fallback: route to AI assistant
  if (window.unitTestsAI && typeof window.unitTestsAI.sendMessage === 'function') {
    showAccordionSection('collapseAIAssistant');
    window.unitTestsAI.sendMessage(rawCommand);
    speak('Sending your question to the assistant');
    return;
  }

  speak('Command not recognized for Unit Tests');
}

function getSectionCardForCollapse(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return null;
  if (sectionId === 'collapseAIAssistant') return document.getElementById('aiAssistantCard');
  return el.closest('.section-card');
}

function showAccordionSection(sectionId) {
  const id = String(sectionId || '').replace(/^#/, '').trim();
  const section = document.getElementById(id);
  if (!section) return;
  if (section.classList.contains('show')) return; // already open
  const card = getSectionCardForCollapse(id);
  if (card) card.classList.remove('section-card-hidden');
  updateSectionHeaderState(id, true);
  bsCollapseShow(section);
}

function toggleAccordionSection(sectionId) {
  const id = String(sectionId || '').replace(/^#/, '').trim();
  const section = document.getElementById(id);
  if (!section) return;
  const card = getSectionCardForCollapse(id);
  const isExpanded = section.classList.contains('show');
  if (isExpanded) {
    updateSectionHeaderState(id, false);
    bsCollapseHide(section, card ? function () { card.classList.add('section-card-hidden'); } : undefined);
  } else {
    if (card) card.classList.remove('section-card-hidden');
    updateSectionHeaderState(id, true);
    bsCollapseShow(section);
  }
}

function updateSectionHeaderState(sectionId, expanded) {
  const id = String(sectionId || '').replace(/^#/, '').trim();
  const trigger = document.querySelector(
    `[data-bs-target="#${id}"], [data-bs-target="${id}"], [data-target="#${id}"], [data-target="${id}"]`
  );
  if (trigger) {
    trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    trigger.classList.toggle('collapsed', !expanded);
  }
}

function updateSectionSidebarActiveState(sectionId, isExpanded) {
  const nav = document.getElementById('sectionSidebarNav');
  if (!nav) return;
  const link = nav.querySelector(
    'a[data-bs-target="' + sectionId + '"], a[data-bs-target="#' + sectionId + '"], a[data-target="' + sectionId + '"], a[data-target="#' + sectionId + '"]'
  );
  if (link) {
    link.classList.toggle('active-section', isExpanded);
  }
}

function toggleVoiceHelp(forceShow) {
  if (!voiceHelpPanel) return;
  const show = typeof forceShow === 'boolean' ? forceShow : !voiceHelpPanel.classList.contains('show');
  voiceHelpPanel.classList.toggle('show', show);
}

function speak(text) {
  if (typeof window.speakWithGoogle === 'function') {
    window.speakWithGoogle(text, 'en-US-Standard-D', { speakingRate: 0.95 })
      .then((success) => {
        if (!success) {
          speakWithBrowser(text);
        }
      })
      .catch(() => speakWithBrowser(text));
    return;
  }

  speakWithBrowser(text);
}

function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768);
  utterance.rate = isMobile ? 1.0 : 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Field metadata from Encompass (dataType, format, description) keyed by field ID. Used for scenario builder. */
let currentFieldMetadata = {};

function resetCurrentFieldMetadataToFallback() {
  const fb = window.customFieldCalcParser?.getFallbackFieldMetadata?.() || {};
  currentFieldMetadata = { ...fb };
}

/**
 * Merge buildFieldMetadataLookup() result without wiping existing non-empty description/type (FALLBACK rows often have empty strings).
 */
function mergeParserFieldMetadataLookup(parserLookup) {
  if (!parserLookup || typeof parserLookup !== 'object') return;
  Object.keys(parserLookup).forEach((k) => {
    if (!k) return;
    if (!currentFieldMetadata[k]) currentFieldMetadata[k] = {};
    const inc = parserLookup[k];
    if (!inc || typeof inc !== 'object') return;
    const patch = { ...inc };
    ['description', 'dataType', 'format'].forEach((f) => {
      const v = patch[f];
      if (v === '' || v === null || v === undefined) delete patch[f];
    });
    const prevDesc = String(currentFieldMetadata[k].description || '').trim();
    Object.assign(currentFieldMetadata[k], patch);
    const nextDesc = String(currentFieldMetadata[k].description || '').trim();
    if (!nextDesc && prevDesc) currentFieldMetadata[k].description = prevDesc;
  });
}

/** After any grid is loaded: enrich row descriptions + _fieldMetadata, then refresh from Hub (cached). */
function scheduleUnitTestGridMetadataRefresh() {
  enrichSetRowsWithEncompassMetadata();
  return loadMetadataForSetRowsFromEncompass();
}

/** Current custom field for Live Scenario Builder (when generated from custom field). */
let currentScenarioBuilderField = null;

/** How many grid scenario columns to fill from Live Scenario Builder: one | five | all */
let scenarioApplyMode = 'one';

/**
 * Resolve which ag-Grid column fields receive builder values.
 * @param {'one'|'five'|'all'} mode
 * @param {string} startField - column `field` from dropdown (Test 1, etc.)
 * @returns {string[]}
 */
function getTargetColumnFieldsForApply(mode, startField) {
  const ordered = getOrderedTestColumns().filter((c) => c.testNumber && c.testNumber !== 'RESET');
  if (!ordered.length) return [];
  let idx = ordered.findIndex((c) => c.field === startField);
  if (idx < 0) idx = 0;
  if (mode === 'one') return [ordered[idx].field].filter(Boolean);
  if (mode === 'five') return ordered.slice(idx, idx + 5).map((c) => c.field).filter(Boolean);
  if (mode === 'all') return ordered.map((c) => c.field).filter(Boolean);
  return [ordered[idx].field].filter(Boolean);
}

/**
 * Match a SET row Target to a key in scenario builder values.
 * @param {string} target - e.g. "[CX.TYPE]" or "[@Log.MS.Date.Underwriting]"
 * @param {Record<string, unknown>} builderValues - from getScenarioBuilderValues()
 * @returns {string|number|undefined}
 */
function valueForTargetFromScenarioBuilder(target, builderValues) {
  if (!builderValues || typeof builderValues !== 'object') return undefined;
  const raw = getRawFieldIdFromTarget(target);
  if (raw == null || raw === '') return undefined;
  const norm = window.customFieldCalcParser?.normalizeFieldIdForLookup?.(raw) || String(raw).replace(/^[@#]+/, '');
  const stripped = String(raw).replace(/^[@#]+/, '');
  const candidates = [raw, norm, stripped, '[' + raw + ']', '[' + norm + ']', '[' + stripped + ']'];
  const m = String(target || '').trim().match(/^\[([^\]]+)\]$/);
  if (m) candidates.push(m[1]);
  for (let i = 0; i < candidates.length; i++) {
    const k = candidates[i];
    if (!k) continue;
    const v = builderValues[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/**
 * Populate scenario-column dropdown; call after grid or builder updates.
 */
function refreshScenarioApplyToolbar() {
  const sel = document.getElementById('scenarioApplyColumnSelect');
  if (!sel) return;
  const ordered = getOrderedTestColumns().filter((c) => c.testNumber && c.testNumber !== 'RESET');
  const prev = sel.value;
  sel.innerHTML = '';
  if (ordered.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No Test columns — load a test first';
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  ordered.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.field;
    opt.textContent = c.field || ('Test ' + c.testNumber);
    sel.appendChild(opt);
  });
  if (prev && ordered.some((c) => c.field === prev)) sel.value = prev;
}

/**
 * Copy Live Scenario Builder values into SET rows for selected scenario column(s).
 */
function applyScenarioBuilderValuesToGrid() {
  const sel = document.getElementById('scenarioApplyColumnSelect');
  const startField = sel && !sel.disabled ? sel.value : '';
  const colFields = getTargetColumnFieldsForApply(scenarioApplyMode, startField);
  if (!colFields.length) {
    showToast('No test scenario columns in the grid (or none selected).', 'warning');
    return;
  }
  if (!gridApi || !allData || allData.length === 0) {
    showToast('Load a unit test grid first.', 'warning');
    return;
  }
  const builderValues = getScenarioBuilderValues();
  let cells = 0;
  let rowsTouched = 0;
  gridApi.forEachNode((node) => {
    const row = node.data;
    if (!row) return;
    const action = String(row.Action || row.action || '').trim().toUpperCase();
    if (action !== 'SET') return;
    const val = valueForTargetFromScenarioBuilder(row.Target, builderValues);
    if (val === undefined) return;
    const strVal = typeof val === 'number' && Number.isFinite(val) ? String(val) : String(val);
    rowsTouched += 1;
    colFields.forEach((field) => {
      if (!field) return;
      row[field] = strVal;
      cells += 1;
    });
  });
  gridApi.refreshCells({ force: true });
  if (cells === 0) {
    showToast('No matching SET rows (check Target field IDs vs builder).', 'warning');
    return;
  }
  showToast(`Applied to ${colFields.length} column(s), ${rowsTouched} SET row(s), ${cells} cell(s).`, 'ok');
}

/**
 * Fill empty scenario builder inputs from Tool 8 / Alchemist sample map.
 */
function fillScenarioBuilderInputsFromTool8Samples() {
  const map = (typeof window !== 'undefined' && window.encompassFieldTestValuesMap) || {};
  const container = document.getElementById('liveScenarioBuilderContainer');
  if (!container || container.style.display === 'none') {
    showToast('Open the Live Scenario Builder first (generate from a custom field).', 'warning');
    return;
  }
  const inputs = container.querySelectorAll('[data-field-id]');
  let n = 0;
  inputs.forEach((el) => {
    if (String(el.value || '').trim() !== '') return;
    const fid = el.getAttribute('data-field-id');
    const rawAttr = el.getAttribute('data-field-id-raw') || fid;
    const strip = (s) => String(s || '').replace(/^\[|\]$/g, '').replace(/^[@#]+/, '');
    const keys = [strip(fid), strip(rawAttr), String(rawAttr || '').trim(), String(fid || '').trim()];
    let sample = null;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k && map[k] != null && map[k] !== '') {
        sample = map[k];
        break;
      }
    }
    if (sample == null) {
      const dt = (getScenarioBuilderFieldMeta(fid) || {}).dataType;
      if (/date/i.test(String(dt || ''))) sample = map.DEFAULT_DATE;
      else if (/int|decimal|number/i.test(String(dt || ''))) sample = map.DEFAULT_NUMBER;
      else sample = map.DEFAULT_STRING;
    }
    if (sample == null) return;
    if (el.tagName === 'SELECT') {
      const opt = Array.from(el.options).find((o) => String(o.value) === String(sample));
      if (opt) {
        el.value = sample;
        n += 1;
      }
    } else {
      el.value = String(sample);
      n += 1;
    }
  });
  runScenarioCalculation();
  showToast(n ? `Filled ${n} empty field(s) from Tool 8 samples` : 'No empty fields to fill (or no matching samples)', n ? 'ok' : 'info');
}

function initializeScenarioBuilderApplyControls() {
  const toolbar = document.getElementById('scenarioBuilderApplyToolbar');
  if (!toolbar) return;
  toolbar.querySelectorAll('.scenario-apply-mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('.scenario-apply-mode').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scenarioApplyMode = btn.getAttribute('data-mode') || 'one';
    });
  });
  document.getElementById('scenarioApplyToGridBtn')?.addEventListener('click', () => applyScenarioBuilderValuesToGrid());
  document.getElementById('scenarioFillTool8Btn')?.addEventListener('click', () => fillScenarioBuilderInputsFromTool8Samples());
}

/**
 * Get metadata for a field (from currentFieldMetadata or infer from ID).
 * @param {string} fieldId - e.g. "353", "@353", "CX.TEST"
 * @param {{ expression?: string }|null} [opts] - when expression contains DateDiff([a],[b]), those fields use Date inputs
 * @returns {{ dataType?: string, options?: string[] }|null}
 */
function getScenarioBuilderFieldMeta(fieldId, opts) {
  const norm = window.customFieldCalcParser?.normalizeFieldIdForLookup?.(fieldId) || String(fieldId || '').replace(/^[@#]+/, '');
  let meta = (currentFieldMetadata && currentFieldMetadata[norm]) || (currentFieldMetadata && currentFieldMetadata[fieldId]);
  if (!meta && fieldId && window.customFieldCalcParser?.inferDateTypeFromFieldId) {
    meta = window.customFieldCalcParser.inferDateTypeFromFieldId(norm) || window.customFieldCalcParser.inferDateTypeFromFieldId(fieldId);
  }
  if (!meta && fieldId && window.customFieldCalcParser?.isDateFieldByNotation?.(fieldId)) {
    meta = { dataType: 'Date', format: '', description: 'Date (from @)' };
  }
  if (!meta && fieldId && window.customFieldCalcParser?.isNumberFieldByNotation?.(fieldId)) {
    meta = { dataType: 'Decimal', format: '', description: 'Number (from #)' };
  }
  const expr = opts && opts.expression ? String(opts.expression) : '';
  if (expr && window.customFieldCalcParser?.collectDateDiffFieldIdsFromExpression) {
    const dateIds = window.customFieldCalcParser.collectDateDiffFieldIdsFromExpression(expr);
    if (dateIds.includes(norm) || dateIds.includes(String(fieldId || '').trim())) {
      meta = {
        ...(meta || {}),
        dataType: 'Date',
        format: meta && meta.format != null ? meta.format : '',
        description: (meta && meta.description) ? meta.description : 'Date (DateDiff operand)',
      };
    }
  }
  return meta || null;
}

/**
 * Create an input element for the scenario builder based on field metadata.
 * @param {string} fieldId
 * @param {string} initialValue
 * @param {string} dataAttr - data attribute for lookup
 * @param {{ expression?: string }|null} [opts] - passed to metadata (DateDiff operands → date picker)
 * @returns {HTMLInputElement|HTMLSelectElement}
 */
function createScenarioBuilderInput(fieldId, initialValue, dataAttr, opts) {
  const meta = getScenarioBuilderFieldMeta(fieldId, opts);
  const dt = (meta && meta.dataType) ? String(meta.dataType).toLowerCase() : '';
  const val = initialValue !== undefined && initialValue !== null ? String(initialValue) : '';

  if (meta && Array.isArray(meta.options) && meta.options.length > 0) {
    const sel = document.createElement('select');
    sel.className = 'form-control form-control-sm';
    sel.setAttribute('data-field-id', dataAttr);
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '—';
    sel.appendChild(empty);
    meta.options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (String(opt) === val) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }
  if (/integer/i.test(dt)) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'form-control form-control-sm';
    inp.step = '1';
    inp.value = val;
    inp.setAttribute('data-field-id', dataAttr);
    return inp;
  }
  if (/decimal|number/i.test(dt)) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'form-control form-control-sm';
    inp.step = '0.01';
    inp.value = val;
    inp.setAttribute('data-field-id', dataAttr);
    return inp;
  }
  if (/date|datetime/i.test(dt)) {
    const inp = document.createElement('input');
    inp.type = /datetime/i.test(dt) ? 'datetime-local' : 'date';
    inp.className = 'form-control form-control-sm';
    inp.setAttribute('data-field-id', dataAttr);
    if (val) {
      const usMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (usMatch) {
        inp.value = usMatch[3] + '-' + usMatch[1].padStart(2, '0') + '-' + usMatch[2].padStart(2, '0');
        if (inp.type === 'datetime-local') inp.value += 'T00:00:00';
      } else if (isoMatch) {
        inp.value = val.substring(0, 10);
        if (inp.type === 'datetime-local' && val.length > 10) inp.value += val.substring(10, 19);
      } else {
        inp.value = val;
      }
    }
    return inp;
  }
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'form-control form-control-sm';
  inp.value = val;
  inp.setAttribute('data-field-id', dataAttr);
  return inp;
}

/**
 * Collect current values from scenario builder inputs.
 * @returns {Record<string, string|number>}
 */
function getScenarioBuilderValues() {
  const container = document.getElementById('liveScenarioBuilderContainer');
  if (!container) return {};
  const inputs = container.querySelectorAll('[data-field-id]');
  const values = {};
  inputs.forEach((el) => {
    const fid = el.getAttribute('data-field-id');
    if (!fid) return;
    const norm = window.customFieldCalcParser?.normalizeFieldIdForLookup?.(fid) || fid.replace(/^[@#]+/, '');
    const raw = el.getAttribute('data-field-id-raw');
    let v = el.value;
    if (el.type === 'number') {
      if (el.value === '') v = '';
      // Mis-typed metadata can mark dates as number; parseFloat("09/19/2020") === 9 and breaks DateDiff
      else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(el.value) || /^\d{4}-\d{2}-\d{2}/.test(el.value)) v = el.value;
      else {
        const n = parseFloat(el.value);
        v = Number.isFinite(n) ? n : el.value;
      }
    }
    values[norm] = v;
    values[fid] = v;
    if (raw && raw !== fid) values[raw] = v;
  });
  return values;
}

/**
 * Run scenario calculation and display result.
 */
function runScenarioCalculation() {
  const field = currentScenarioBuilderField;
  const resultEl = document.getElementById('scenarioBuilderResult');
  if (!field || !resultEl) return;

  const calc = field.calculation || field.calculationExpression || field.calculatedExpression || field.expression || field.formula || '';
  if (!calc.trim()) {
    resultEl.textContent = '—';
    return;
  }

  const parsed = window.customFieldCalcParser?.parseCalculationFormula?.(calc);
  if (!parsed) {
    resultEl.textContent = '—';
    return;
  }

  const values = getScenarioBuilderValues();
  const result = window.customFieldCalcParser?.evaluateExpression?.(parsed.expression, values);

  if (result === null || result === undefined) {
    resultEl.textContent = '—';
    return;
  }

  if (typeof result === 'number') {
    const rounded = Number.isInteger(result) ? result : Math.round((result + Number.EPSILON) * 100) / 100;
    resultEl.textContent = String(rounded);
  } else {
    resultEl.textContent = String(result);
  }
}

/**
 * Render the Live Scenario Builder grid for the given custom field.
 * @param {object} field - { fieldId, calculation, ... }
 */
function renderScenarioBuilder(field) {
  const container = document.getElementById('liveScenarioBuilderContainer');
  const tbody = document.getElementById('scenarioBuilderGridBody');
  const resultEl = document.getElementById('scenarioBuilderResult');
  if (!container || !tbody || !field) return;

  const calc = field.calculation || field.calculationExpression || field.calculatedExpression || field.expression || field.formula || '';
  if (!calc.trim()) {
    container.style.display = 'none';
    return;
  }

  const parsed = window.customFieldCalcParser?.parseCalculationFormula?.(calc);
  if (!parsed) {
    container.style.display = 'none';
    return;
  }

  const outNorm = window.customFieldCalcParser?.normalizeFieldIdForLookup?.(field.fieldId || field.id || '') || '';
  let inputFields = (parsed.inputFields || []).filter((f) => {
    const n = window.customFieldCalcParser?.normalizeFieldIdForLookup?.(f) || f.replace(/^[@#]+/, '');
    return n !== outNorm;
  });

  if (inputFields.length === 0) {
    container.style.display = 'none';
    return;
  }

  const scenarios = window.customFieldCalcParser?.parseAllIIfScenarios?.(parsed.expression);
  const expanded = scenarios ? (window.customFieldCalcParser?.expandOrElseScenarios?.(scenarios) || scenarios) : scenarios;
  const firstScenario = expanded && expanded.length > 0 ? expanded[0] : null;
  const fieldMetadata = currentFieldMetadata || {};

  tbody.innerHTML = '';
  inputFields.forEach((fid) => {
    const displayId = window.customFieldCalcParser?.normalizeFieldIdForLookup?.(fid) || fid.replace(/^[@#]+/, '');
    let initialVal = '';
    if (firstScenario) {
      const suggested = window.customFieldCalcParser?.getSuggestedValuesForScenario?.(firstScenario, inputFields, { fieldMetadata, scenarioIndex: 0, allScenarios: expanded }) || {};
      initialVal = suggested[displayId] !== undefined ? suggested[displayId] : '';
    }
    const tr = document.createElement('tr');
    const tdId = document.createElement('td');
    tdId.className = 'field-id-cell';
    tdId.textContent = '[' + displayId + ']';
    tr.appendChild(tdId);
    const tdVal = document.createElement('td');
    tdVal.className = 'value-cell';
    const input = createScenarioBuilderInput(fid, initialVal, displayId, { expression: calc });
    input.setAttribute('data-field-id-raw', fid);
    const onChange = () => runScenarioCalculation();
    input.addEventListener('input', onChange);
    input.addEventListener('change', onChange);
    tdVal.appendChild(input);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  });

  container.style.display = 'block';
  runScenarioCalculation();
  refreshScenarioApplyToolbar();
}

/**
 * Load generated unit test data (from custom field calculation) into the grid.
 * Mirrors handleFileUpload flow but for programmatically generated data.
 * @param {string[]} headers
 * @param {object[]} rows
 * @param {object[]} testDescriptions
 * @param {string} sourceName
 * @param {Record<string,{dataType,format,description}>} [fieldMetadata] - optional Encompass field metadata
 * @param {object} [field] - optional custom field object (fieldId, calculation, description, color) for Selected Field accordion
 */
function loadGeneratedTestData(headers, rows, testDescriptions, sourceName, fieldMetadata, field) {
  if (!rows || rows.length === 0) return;

  const fallback = window.customFieldCalcParser?.getFallbackFieldMetadata?.() || {};
  currentFieldMetadata = { ...fallback, ...(fieldMetadata || {}) };
  columnDefs = generateColumnDefs(headers, rows);
  allData = rows.map((r, i) => ({ ...r, __rowIndex: i }));
  lastRunCellResults = {};

  initializeGrid();
  setGridRows(allData);
  showAllColumns();

  const descIdx = headers.findIndex((h) => String(h || '').toLowerCase().trim() === 'description');
  const targetIdx = headers.findIndex((h) => /^target$/i.test(String(h || '').trim()));
  const scenarioStart = descIdx >= 0 ? descIdx + 1 : (targetIdx >= 0 ? targetIdx + 1 : 0);
  const scenarioColumns = [];
  for (let i = scenarioStart; i < headers.length; i++) {
    if (!isScenarioColumnHeader(headers[i])) break;
    scenarioColumns.push(headers[i]);
  }

  // Merge Excel descriptions with actual column headers so we have one card per scenario
  const testCols = scenarioColumns.filter((h) => String(h || '').toLowerCase().trim() !== 'reset');
  const byNum = new Map((testDescriptions || []).map((t) => [String(t.testNumber), t.description]));
  testDescriptionsData = testCols.map((h) => {
    const testNum = extractTestNumberFromKey(h) || '';
    const desc = byNum.get(testNum) || (h || `Test ${testNum}`).trim();
    return { testNumber: testNum, description: desc };
  }).filter((t) => t.testNumber);
  currentFileName = sourceName || 'Generated from Custom Field';

  const accordionContainer = document.getElementById('accordionContainer');
  if (accordionContainer) accordionContainer.style.display = 'block';

  loadTestExecutionsFromDatabase(currentFileName).then((result) => {
    displayOverallSignOff(result.executions, result.dbUnavailable);
  });

  if (testDescriptionsData.length > 0) {
    displayTestDescriptions(testDescriptionsData);
  } else {
    hideTestDescriptions();
  }

  uploadArea.style.display = 'none';
  setHeroPostLoadActionsVisible(true);
  setUnitTestsWelcomeVisible(false);
  runTestsBtn.style.display = 'inline-block';
  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (fillEmptyTestNullBtn) fillEmptyTestNullBtn.style.display = 'inline-block';
  if (stickyActionBar) stickyActionBar.style.display = 'flex';

  const selectedFieldCard = document.getElementById('selectedFieldAccordionCard');
  const selectedFieldContent = document.getElementById('selectedFieldContent');
  const collapseSelectedField = document.getElementById('collapseSelectedField');
  if (field && selectedFieldCard && selectedFieldContent) {
    const fieldId = field.fieldId || field.id || field.Id || field.fieldName || '';
    const calc = field.calculation || field.calculationExpression || field.calculatedExpression || field.expression || field.formula || '';
    const desc = field.description || field.longDescription || field.shortDescription || field.comments || '';
    const color = field.color || field.backgroundColor || field.foregroundColor || '';
    let html = `<div class="mb-2"><strong>Field:</strong> <code>[${fieldId}]</code></div>`;
    if (calc) {
      html += `<div class="mb-2"><strong>Calculation:</strong><pre class="mb-0 mt-1 p-2 bg-light rounded" style="max-height: 200px; overflow: auto; font-size: 1rem;">${escapeHtml(calc)}</pre></div>`;
    }
    if (desc) {
      html += `<div class="mb-2"><strong>Comments:</strong> <span class="text-muted">${escapeHtml(desc)}</span></div>`;
    }
    if (color) {
      const colorStr = String(color).trim();
      const isHex = /^#([0-9a-fA-F]{3}){1,2}$/.test(colorStr) || /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(colorStr);
      const swatch = isHex ? `<span class="d-inline-block rounded border" style="width: 1.2em; height: 1.2em; background: ${colorStr.startsWith('#') ? colorStr : '#' + colorStr}; vertical-align: middle;"></span> ` : '';
      html += `<div><strong>Color:</strong> ${swatch}<code>${escapeHtml(colorStr)}</code></div>`;
    }
    selectedFieldContent.innerHTML = html || '<span class="text-muted">No details</span>';
    selectedFieldCard.classList.remove('section-card-hidden');
    selectedFieldCard.style.display = 'block';
    const sidebarSelectedField = document.getElementById('sidebarSelectedField');
    if (sidebarSelectedField) sidebarSelectedField.style.display = '';
    currentScenarioBuilderField = field;
    renderScenarioBuilder(field);
    if (collapseSelectedField) {
      bsCollapseShow(collapseSelectedField);
    }
  } else if (selectedFieldCard) {
    selectedFieldCard.style.display = 'none';
    const sidebarSelectedField = document.getElementById('sidebarSelectedField');
    if (sidebarSelectedField) sidebarSelectedField.style.display = 'none';
    currentScenarioBuilderField = null;
    const builderContainer = document.getElementById('liveScenarioBuilderContainer');
    if (builderContainer) builderContainer.style.display = 'none';
  }

  updateLoanGuidChipDisplay(currentLoanGuid);
  renderRecentRunsSelect();
  updateScenarioBadges([]);

  if (window.unitTestsAI && window.unitTestsAI.show) {
    window.unitTestsAI.show();
  }

  let fileInfoHTML = `<strong>${currentFileName}</strong>`;
  fileInfoHTML += ` <span class="text-muted">(${rows.length} test step${rows.length !== 1 ? 's' : ''}, ${headers.length} columns)</span>`;
  if (testDescriptions && testDescriptions.length > 0) {
    fileInfoHTML += `<div class="mt-2"><small class="text-muted">Test Scenarios:</small> `;
    fileInfoHTML += testDescriptions.map((t) => `<span class="badge text-bg-secondary me-1" title="${t.description}">Test ${t.testNumber}</span>`).join('');
    fileInfoHTML += `</div>`;
  } else if (scenarioColumns.length > 0) {
    fileInfoHTML += ` <span class="text-muted">• ${scenarioColumns.length} test scenario${scenarioColumns.length !== 1 ? 's' : ''}</span>`;
  }
  fileInfo.innerHTML = fileInfoHTML;

  updateResultsMeta();
  setStatus('Generated test loaded successfully', 'ok', 'bi-check-circle');

  scheduleUnitTestGridMetadataRefresh()
    .then(({ dropdownCount }) => {
      if (dropdownCount > 0) {
        showToast(`Encompass: ${dropdownCount} SET field(s) with dropdown metadata`, 'info');
      }
    })
    .catch(() => {
      /* Hub unavailable — text editors still work */
    });
}

/**
 * Resolve merged field metadata for a SET row Target using currentFieldMetadata (Hub + parser).
 * @param {string} target - e.g. "[CX.FOO]", "[@Log.MS.Date.Underwriting]"
 * @returns {object|null}
 */
function resolveFieldMetadataForTarget(target) {
  if (!target || typeof currentFieldMetadata !== 'object') return null;
  const normFn = window.customFieldCalcParser?.normalizeFieldIdForLookup;
  const norm = normFn || function (id) { return String(id || '').replace(/^[@#]+/, ''); };
  const raw = getRawFieldIdFromTarget(target);
  const extracted = extractFieldId(target);
  const candidates = [];
  if (raw) {
    candidates.push(raw, norm(raw));
    const noAt = raw.replace(/^@/, '');
    if (noAt !== raw) candidates.push(noAt, '@' + noAt);
  }
  if (extracted) {
    candidates.push(extracted, norm(extracted));
  }
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c && currentFieldMetadata[c]) return { ...currentFieldMetadata[c] };
  }
  const seeds = [extracted, raw].filter(Boolean);
  for (let s = 0; s < seeds.length; s++) {
    const n = norm(String(seeds[s]));
    if (!n) continue;
    const keys = Object.keys(currentFieldMetadata);
    for (let k = 0; k < keys.length; k++) {
      if (norm(keys[k]) === n) return { ...currentFieldMetadata[keys[k]] };
    }
  }
  const seedStr = extracted || raw;
  if (seedStr) {
    const nl = norm(String(seedStr)).toLowerCase();
    if (nl) {
      const keys = Object.keys(currentFieldMetadata);
      for (let k = 0; k < keys.length; k++) {
        if (norm(String(keys[k])).toLowerCase() === nl) return { ...currentFieldMetadata[keys[k]] };
      }
    }
  }
  return null;
}

/**
 * Attach _fieldMetadata to SET rows and refresh Description from Encompass metadata (same idea as custom-field load).
 */
function enrichSetRowsWithEncompassMetadata() {
  if (!allData || !Array.isArray(allData)) return;
  const enrichActions = { SET: 1, COMPARE: 1, GET: 1 };
  allData.forEach((row) => {
    const action = String(row.Action || row.action || '').trim().toUpperCase();
    const target = row.Target || row.target || '';
    if (!target || !hasFieldId(target)) {
      delete row._fieldMetadata;
      return;
    }
    if (!enrichActions[action]) {
      delete row._fieldMetadata;
      return;
    }
    let meta = resolveFieldMetadataForTarget(target);
    const rawId = getRawFieldIdFromTarget(target);
    if (!meta && rawId && window.customFieldCalcParser?.isDateFieldByNotation?.(rawId)) {
      const descLow = String(row.Description || '').toLowerCase();
      meta = {
        dataType: descLow.includes('datetime') ? 'DateTime' : 'Date',
        format: '',
        description: 'Date field (@ milestone)',
      };
    }
    if (!meta) {
      const eid = extractFieldId(target);
      if (eid && window.customFieldCalcParser?.inferDateTypeFromFieldId) {
        const inferred = window.customFieldCalcParser.inferDateTypeFromFieldId(eid);
        if (inferred) meta = { ...inferred };
      }
    }
    if (meta) {
      row._fieldMetadata = {
        dataType: meta.dataType,
        format: meta.format || '',
        description: meta.description || '',
        ...(Array.isArray(meta.options) && meta.options.length > 0 ? { options: [...meta.options] } : {}),
      };
    } else {
      delete row._fieldMetadata;
    }
    const apiDesc = meta && String(meta.description || '').trim();
    const extracted = extractFieldId(target);
    const bracket = String(target).trim().startsWith('[') ? String(target).trim() : extracted ? `[${extracted}]` : String(target).trim();
    const dt = meta && meta.dataType ? String(meta.dataType).trim() : '';
    if (apiDesc) {
      const typeSuffix = dt && !/^string$/i.test(dt) ? ` — ${dt}` : '';
      row.Description = `${apiDesc} ${bracket}${typeSuffix}`.trim();
    } else if (meta && dt && !/^string$/i.test(dt)) {
      const base = String(row.Description || '').trim();
      if (base && !base.includes(`(${dt})`) && !base.includes(` — ${dt}`)) {
        row.Description = `${base} (${dt})`.trim();
      }
    }
  });
  if (gridApi && typeof gridApi.refreshCells === 'function') {
    gridApi.refreshCells({ force: true });
  }
}

/**
 * Load Encompass field metadata for SET rows and merge into currentFieldMetadata.
 * Enables dropdowns (enumerated) and date pickers based on field definitions.
 * @returns {Promise<{fieldMeta: object, dropdownCount: number}>}
 */
async function loadMetadataForSetRowsFromEncompass() {
  if (!allData || allData.length === 0) return { fieldMeta: {}, dropdownCount: 0 };
  const metadataRelevantRows = allData.filter((r) => {
    const action = String(r.Action || r.action || '').trim().toUpperCase();
    const target = r.Target || r.target || '';
    return ['SET', 'COMPARE', 'GET'].includes(action) && target && extractFieldId(target);
  });
  if (metadataRelevantRows.length === 0) {
    enrichSetRowsWithEncompassMetadata();
    return { fieldMeta: {}, dropdownCount: 0 };
  }

  const { customList, nativeList } = await fetchHubFieldListsCached();

  const fieldMeta = {};
  const addMeta = (item, source) => {
    const id = String(item.fieldId || item.id || item.Id || item.fieldName || item.name || '').trim();
    if (!id) return;
    const baseId = id.replace(/^[@#]+/, '');
    const readOnly = !!(item.readOnly ?? item.isReadOnly ?? false);
    const isCalc = !!(item.isCalculatedField ?? item.isCalculated ?? item.calculated ?? item.isCalculation ?? false);
    const fmt = String(item.format || item.formatType || item.Format || '').toUpperCase();
    const dt = String(item.dataType || item.DataType || item.type || '').toUpperCase();
    const desc = String(item.description || item.longDescription || item.shortDescription || item.label || item.Name || '').trim();
    const rawOpts = item.options ?? item.Options ?? item.values ?? item.Values ?? item.enum ?? item.Enum;
    const options = Array.isArray(rawOpts) && rawOpts.length > 0
      ? rawOpts.map((o) => (o && typeof o === 'object' ? (o.Value ?? o.value ?? o.Key ?? o.key ?? o.Label ?? o.label ?? o.Text ?? o.text ?? String(o)) : String(o)))
      : null;
    const aliasKeys = new Set([baseId, id].filter(Boolean));
    [item.fieldName, item.name, item.Name, item.title].forEach((nm) => {
      const s = String(nm || '').trim();
      if (s) aliasKeys.add(s);
    });
    for (const key of aliasKeys) {
      if (!key) continue;
      if (!fieldMeta[key]) fieldMeta[key] = { id: baseId, readOnly: false, isCalculated: false, source: '' };
      fieldMeta[key].readOnly = fieldMeta[key].readOnly || readOnly;
      fieldMeta[key].isCalculated = fieldMeta[key].isCalculated || isCalc;
      if (!fieldMeta[key].source) fieldMeta[key].source = source;
      if (desc) fieldMeta[key].description = fieldMeta[key].description || desc;
      const isDropdownFormat = /^(DROPDOWN|DROPDOWNLIST|SELECT|LIST|COMBO|AUDIT|PICKLIST)$/i.test(fmt);
      const allowOptsByFormat = isDropdownFormat || /^(AUDIT|PICKLIST|ENUMERATED)/i.test(fmt);
      if (options && options.length > 0 && allowOptsByFormat) {
        fieldMeta[key].options = options;
        fieldMeta[key].dataType = fieldMeta[key].dataType || 'String';
      }
      if (/^(YN|YESNO|Y\/N)$/i.test(fmt) || /^YN$/i.test(dt)) {
        fieldMeta[key].dataType = fieldMeta[key].dataType || 'YesNo';
        if (!fieldMeta[key].options) fieldMeta[key].options = ['Y', 'N'];
      }
      if (/^(DATE|DATETIME|DATETIMEOFFSET)$/i.test(fmt) || /^(DATE|DATETIME)$/i.test(dt)) {
        fieldMeta[key].dataType = fieldMeta[key].dataType || (/DATETIME/i.test(fmt) || /DATETIME/i.test(dt) ? 'DateTime' : 'Date');
      }
    }
  };
  customList.forEach((item) => addMeta(item, 'custom'));
  nativeList.forEach((item) => addMeta(item, 'native'));

  if (typeof currentFieldMetadata !== 'object') currentFieldMetadata = {};
  const fallback = window.customFieldCalcParser?.getFallbackFieldMetadata?.() || {};
  Object.assign(currentFieldMetadata, fallback);

  const parserLookup = window.customFieldCalcParser?.buildFieldMetadataLookup?.(customList, nativeList);
  mergeParserFieldMetadataLookup(parserLookup);

  const uniqueDropdownIds = new Set();
  Object.keys(fieldMeta).forEach((k) => {
    const m = fieldMeta[k];
    if (!currentFieldMetadata[k]) currentFieldMetadata[k] = {};
    if (m.description) {
      currentFieldMetadata[k].description = m.description || currentFieldMetadata[k].description;
    }
    if (m.options && m.options.length > 0) {
      currentFieldMetadata[k].options = m.options;
      currentFieldMetadata[k].dataType = m.dataType || currentFieldMetadata[k].dataType || 'String';
      uniqueDropdownIds.add(m.id || k);
    }
    if (m.dataType) {
      currentFieldMetadata[k].dataType = m.dataType || currentFieldMetadata[k].dataType;
    }
  });
  const dropdownCount = uniqueDropdownIds.size;
  enrichSetRowsWithEncompassMetadata();
  return { fieldMeta, dropdownCount };
}

/**
 * Initialize Scan SET Fields button and modal.
 * Scans SET rows for read-only or calculated fields that will fail if not addressed.
 */
function initializeScanSetFields() {
  const btn = scanSetFieldsBtn;
  const modal = document.getElementById('scanSetFieldsModal');
  const statusEl = document.getElementById('scanSetFieldsStatus');
  const resultsEl = document.getElementById('scanSetFieldsResults');

  if (!btn || !modal || !resultsEl) return;

  btn.addEventListener('click', async () => {
    if (!allData || allData.length === 0) {
      showToast('Load or generate a test first', 'warning');
      return;
    }

    const setRows = allData.filter((r) => {
      const action = String(r.Action || r.action || '').trim().toUpperCase();
      return action === 'SET';
    });
    if (setRows.length === 0) {
      showBsModal(modal);
      statusEl.textContent = 'No SET rows found in this test.';
      resultsEl.innerHTML = '<p class="text-muted small mb-0">No action needed.</p>';
      return;
    }

    statusEl.textContent = 'Loading field metadata from Encompass...';
    resultsEl.innerHTML = '';
    showBsModal(modal);

    try {
      const { fieldMeta } = await loadMetadataForSetRowsFromEncompass();

      const problems = [];
      const checked = new Set();
      setRows.forEach((row) => {
        const target = row.Target || row.target || '';
        const fid = extractFieldId(target);
        if (!fid || checked.has(fid)) return;
        checked.add(fid);
        const meta = fieldMeta[fid];
        if (!meta) return;
        if (meta.readOnly || meta.isCalculated) {
          problems.push({
            step: row.Step,
            target: target,
            fieldId: fid,
            reason: meta.readOnly && meta.isCalculated ? 'Read-only and Calculated' : meta.readOnly ? 'Read-only' : 'Calculated',
            description: row.Description || row.description || '',
          });
        }
      });

      statusEl.textContent = '';
      const fieldsWithOptions = Object.keys(fieldMeta).filter((k) => fieldMeta[k].options && fieldMeta[k].options.length > 0);
      const uniqueOptFields = [...new Set(fieldsWithOptions.map((k) => fieldMeta[k].id))];
      if (problems.length === 0) {
        let msg = '<p class="text-success mb-0"><i class="bi-check-circle mr-1"></i>No read-only or calculated fields found in SET rows. All SET targets should work.</p>';
        if (uniqueOptFields.length > 0) {
          msg += `<p class="text-muted small mt-2 mb-0"><i class="bi-list-ul mr-1"></i>Added dropdowns for ${uniqueOptFields.length} custom field(s) with enumerated values. Edit Test columns to use them.</p>`;
        }
        resultsEl.innerHTML = msg;
        return;
      }

      let html = '<div class="alert alert-warning mb-3"><strong>' + problems.length + ' field(s) will fail SET operations:</strong></div>';
      html += '<ul class="list-group">';
      problems.forEach((p) => {
        html += '<li class="list-group-item d-flex flex-column align-items-start">';
        html += '<span class="fw-bold text-danger">Step ' + (p.step || '?') + ': ' + (p.target || p.fieldId) + '</span>';
        html += '<span class="badge text-bg-warning mt-1">' + (p.reason || '') + '</span>';
        if (p.description) html += '<small class="text-muted mt-1">' + (p.description || '').replace(/</g, '&lt;') + '</small>';
        html += '</li>';
      });
      html += '</ul>';
      html += '<p class="text-muted small mt-3 mb-0">Remove or change these SET steps, or use fields that are writable.</p>';
      if (uniqueOptFields.length > 0) {
        html += `<p class="text-muted small mt-2 mb-0"><i class="bi-list-ul mr-1"></i>Added dropdowns for ${uniqueOptFields.length} custom field(s) with enumerated values.</p>`;
      }
      resultsEl.innerHTML = html;
    } catch (err) {
      statusEl.textContent = '';
      resultsEl.innerHTML = '<p class="text-danger mb-0">Error: ' + (err.message || 'Failed to scan') + '</p>';
    }
  });
}

/**
 * Initialize Generate from Custom Field modal and handlers.
 */
function initializeGenerateFromCustomField() {
  const btn = document.getElementById('generateFromCustomFieldBtn');
  const modal = document.getElementById('generateFromCustomFieldModal');
  const searchInput = document.getElementById('customFieldSearchInput');
  const hiddenSelect = document.getElementById('customFieldSelect');
  const dropdown = document.getElementById('customFieldDropdown');
  const dropdownToggle = document.getElementById('customFieldDropdownToggle');
  const preview = document.getElementById('generateCustomFieldPreview');
  const previewContent = document.getElementById('generateCustomFieldPreviewContent');
  const confirmBtn = document.getElementById('generateCustomFieldConfirmBtn');
  const statusEl = document.getElementById('generateCustomFieldStatus');

  if (!btn || !modal || !searchInput || !hiddenSelect || !dropdown) return;

  let calculatedFields = [];
  let cachedCustomFieldsForMetadata = [];
  let cachedNativeFieldsForMetadata = [];

  function getFieldDisplay(f) {
    const id = f.fieldId || f.id || f.Id || f.fieldName || f.name || '';
    const calc = f.calculation || f.calculationExpression || f.Calculation || f.calculatedExpression || f.expression || f.formula || '';
    return { id, calc };
  }

  function renderDropdown(filter) {
    const term = (filter || '').toLowerCase().trim();
    const filtered = term
      ? calculatedFields.filter((f) => {
          const { id, calc } = getFieldDisplay(f);
          return id.toLowerCase().includes(term) || calc.toLowerCase().includes(term);
        })
      : calculatedFields;

    dropdown.innerHTML = '';
    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="custom-field-dropdown-item text-muted">No matching fields</div>';
    } else {
      filtered.forEach((f) => {
        const { id, calc } = getFieldDisplay(f);
        const item = document.createElement('div');
        item.className = 'custom-field-dropdown-item';
        item.setAttribute('data-field-id', id);
        item.innerHTML = `<span class="field-id">[${id}]</span><span class="field-calc">${(calc || '(no calculation)').replace(/</g, '&lt;')}</span>`;
        const selectField = () => {
          hiddenSelect.value = id;
          searchInput.value = id ? `[${id}] ${calc || ''}` : '';
          dropdown.style.display = 'none';
          updatePreview();
        };
        // Use mousedown so selection runs before input blur hides dropdown (mousedown fires before blur)
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectField();
        });
        // Touch: touchstart fires before blur; handle tap to select
        item.addEventListener('touchstart', (e) => {
          e.preventDefault();
          selectField();
        }, { passive: false });
        dropdown.appendChild(item);
      });
    }
    dropdown.style.display = 'block';
  }

  function updatePreview() {
    const val = hiddenSelect.value;
    if (!val) {
      preview.style.display = 'none';
      confirmBtn.disabled = true;
      return;
    }
    const field = calculatedFields.find((f) => (f.fieldId || f.id || f.Id) === val);
    if (!field || !window.customFieldCalcParser) {
      preview.style.display = 'none';
      confirmBtn.disabled = true;
      return;
    }
    const fieldMetadata = window.customFieldCalcParser.buildFieldMetadataLookup
      ? window.customFieldCalcParser.buildFieldMetadataLookup(cachedCustomFieldsForMetadata, cachedNativeFieldsForMetadata)
      : {};
    const result = window.customFieldCalcParser.generateUnitTestFromCustomField(field, { fieldMetadata });
    if (!result) {
      preview.style.display = 'none';
      confirmBtn.disabled = true;
      return;
    }
    previewContent.textContent = result.rows.map((r) => `${r.Step}. ${r.Action} [${(r.Target || '').replace(/[\[\]]/g, '')}] → ${r['Test 1'] ?? ''}`).join('\n');
    preview.style.display = 'block';
    confirmBtn.disabled = false;
  }

  function showDropdown() {
    if (calculatedFields.length) renderDropdown(searchInput.value);
  }

  searchInput.addEventListener('focus', showDropdown);
  searchInput.addEventListener('input', () => {
    renderDropdown(searchInput.value);
    if (!searchInput.value.trim()) {
      hiddenSelect.value = '';
      updatePreview();
    } else {
      // Try to match typed value to a field (e.g. [CX.XXX] or CX.XXX)
      const match = searchInput.value.match(/\[?([A-Za-z0-9_.]+)\]?/);
      const typedId = match ? match[1] : searchInput.value.trim();
      const field = calculatedFields.find((f) => {
        const id = f.fieldId || f.id || f.Id || '';
        return id === typedId || id.toLowerCase() === typedId.toLowerCase();
      });
      if (field) {
        hiddenSelect.value = field.fieldId || field.id || field.Id;
        updatePreview();
      } else {
        hiddenSelect.value = '';
        updatePreview();
      }
    }
  });
  searchInput.addEventListener('blur', (e) => {
    const related = e.relatedTarget;
    if (related && (related === dropdownToggle || dropdown.contains(related))) return;
    // Delay hide to allow mousedown on dropdown item to fire first (mousedown fires before blur)
    setTimeout(() => { dropdown.style.display = 'none'; }, 200);
  });

  if (dropdownToggle) {
    dropdownToggle.addEventListener('click', (e) => {
      e.preventDefault();
      searchInput.focus();
      const isVisible = dropdown.style.display === 'block';
      if (isVisible) {
        dropdown.style.display = 'none';
      } else {
        showDropdown();
      }
    });
  }

  btn.addEventListener('click', async () => {
    statusEl.textContent = 'Loading custom fields...';
    searchInput.value = '';
    hiddenSelect.value = '';
    searchInput.placeholder = 'Loading...';
    dropdown.style.display = 'none';
    confirmBtn.disabled = true;
    preview.style.display = 'none';

    showBsModal(modal);

    try {
      const [customRes, nativeRes] = await Promise.all([
        (window.encompassApi?.encompassFetch || fetch)('/api/encompass-hub/custom-fields'),
        (window.encompassApi?.encompassFetch || fetch)('/api/encompass-hub/native-fields'),
      ]);
      if (!customRes.ok) throw new Error(`Custom fields API failed (${customRes.status})`);
      const customData = await customRes.json();
      const customItems = Array.isArray(customData) ? customData : customData.items || customData.fields || [];
      cachedCustomFieldsForMetadata = customItems;
      calculatedFields = customItems.filter((item) => {
        const calc =
          item.calculation ||
          item.calculationExpression ||
          item.calculatedExpression ||
          item.expression ||
          item.formula ||
          '';
        return (item.isCalculatedField || item.isCalculated) && calc && calc.trim();
      });

      let nativeItems = [];
      if (nativeRes.ok) {
        const nativeData = await nativeRes.json();
        nativeItems = Array.isArray(nativeData) ? nativeData : nativeData.items || nativeData.fields || nativeData.standardFields || [];
      }
      cachedNativeFieldsForMetadata = nativeItems;

      searchInput.placeholder = 'Type to search custom fields...';

      if (calculatedFields.length === 0) {
        statusEl.textContent = 'No calculated custom fields in your Encompass instance.';
        return;
      }

      statusEl.textContent = `${calculatedFields.length} calculated field${calculatedFields.length !== 1 ? 's' : ''} found. Type to search.`;
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      searchInput.placeholder = 'Type to search custom fields...';
    }
  });

  confirmBtn.addEventListener('click', () => {
    const val = hiddenSelect.value;
    if (!val) return;
    const field = calculatedFields.find((f) => (f.fieldId || f.id || f.Id) === val);
    if (!field || !window.customFieldCalcParser) return;

    const fieldMetadata = window.customFieldCalcParser.buildFieldMetadataLookup
      ? window.customFieldCalcParser.buildFieldMetadataLookup(cachedCustomFieldsForMetadata, cachedNativeFieldsForMetadata)
      : {};
    const result = window.customFieldCalcParser.generateUnitTestFromCustomField(field, { fieldMetadata });
    if (!result) {
      showToast('Could not parse calculation formula', 'warning');
      return;
    }

    loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, `Generated: [${field.fieldId || field.id || field.Id}]`, result.fieldMetadata, field);
    hideBsModal(modal);
    showToast('Unit test generated and loaded', 'success');
  });
}

/**
 * Keyboard + aria-selected sync for BR modal tabs (Bootstrap 5 button tabs).
 */
function initializeBrRuleModalTabsA11y(modalEl) {
  const tablist = modalEl.querySelector('#brRuleModalTabs');
  if (!tablist) return;
  const getTabs = () => Array.from(tablist.querySelectorAll('[role="tab"]'));

  function syncTabAttributes() {
    const list = getTabs();
    const active = list.find((t) => t.classList.contains('active'));
    list.forEach((t) => {
      const isSel = t === active;
      t.setAttribute('aria-selected', isSel ? 'true' : 'false');
      t.setAttribute('tabindex', isSel ? '0' : '-1');
    });
  }

  tablist.addEventListener('shown.bs.tab', () => {
    syncTabAttributes();
  });
  tablist.addEventListener('click', (e) => {
    if (e.target.closest('[role="tab"]')) {
      requestAnimationFrame(() => syncTabAttributes());
    }
  });

  tablist.addEventListener('keydown', (e) => {
    const list = getTabs();
    const cur = list.indexOf(document.activeElement);
    if (cur < 0) return;
    let next = cur;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = (cur + 1) % list.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = (cur - 1 + list.length) % list.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = list.length - 1;
    } else {
      return;
    }
    const nextTab = list[next];
    if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
      bootstrap.Tab.getOrCreateInstance(nextTab).show();
    } else {
      nextTab.click();
    }
    nextTab.focus();
  });

  syncTabAttributes();
}

/**
 * Initialize Generate from BR Rule modal and handlers.
 */
function initializeGenerateFromBRRule() {
  const btn = document.getElementById('generateFromBRRuleBtn');
  const modal = document.getElementById('generateFromBRRuleModal');
  const brXmlInput = document.getElementById('brXmlInput');
  const brXmlFile = document.getElementById('brXmlFile');
  const brConditionSnippetInput = document.getElementById('brConditionSnippetInput');
  const brTool8JsonInput = document.getElementById('brTool8JsonInput');
  const brExtractBtn = document.getElementById('brExtractBtn');
  const brCreateTestBtn = document.getElementById('brCreateTestBtn');
  const brSaveToServerBtn = document.getElementById('brSaveToServerBtn');
  const brExtractStatus = document.getElementById('brExtractStatus');
  const brExtractResults = document.getElementById('brExtractResults');
  const brExtractContent = document.getElementById('brExtractContent');

  if (!btn || !modal || !brXmlInput) return;

  initializeBrRuleModalTabsA11y(modal);

  let lastParsed = null;

  function getXmlText() {
    return (brXmlInput && brXmlInput.value ? String(brXmlInput.value).trim() : '') || '';
  }

  /**
   * Which BR modal tab is active (Bootstrap 5). Prefer visible tab-pane — nav-link.active
   * is sometimes missing or wrong inside modals / after programmatic opens.
   */
  function getActiveBrTabHref() {
    const pane =
      modal.querySelector('.tab-content .tab-pane.active') ||
      modal.querySelector('.tab-content .tab-pane.show');
    if (pane && pane.id) {
      return '#' + pane.id;
    }
    const link = modal.querySelector('#brRuleModalTabs .nav-link.active');
    if (link) {
      const h = link.getAttribute('href');
      if (h && h !== '#') return h;
      const t = link.getAttribute('data-bs-target');
      if (t) return t;
    }
    return '';
  }

  function renderExtract(parsed) {
    if (!parsed || parsed.error) {
      brExtractContent.innerHTML = '<p class="text-danger mb-0">' + (parsed ? parsed.error : 'No data') + '</p>';
      return;
    }
    const { rule, mainCondition, advancedConditions, requiredFields } = parsed;
    let html = '';

    html += '<div class="mb-3"><strong>' + (rule.name || rule.ruleType || 'Rule') + '</strong> (' + (rule.ruleType || '') + ')</div>';

    if (mainCondition) {
      html += '<div class="condition-block mb-2 p-2 rounded" style="background: rgba(74,144,164,0.08); border-left: 4px solid #4a90a4;">';
      html += '<strong>Rule condition</strong><pre class="mb-0 mt-1 small" style="white-space: pre-wrap;">' + escapeHtml(mainCondition.expression) + '</pre>';
      if (mainCondition.fields && mainCondition.fields.length) {
        html += '<div class="mt-1"><span class="badge text-bg-secondary me-1">Fields</span> ';
        mainCondition.fields.forEach((f) => { html += '<span class="field-chip">[' + escapeHtml(f.entityId) + ']</span> '; });
        html += '</div></div>';
      } else html += '</div>';
    }

    if (advancedConditions && advancedConditions.length) {
      html += '<div class="mb-2"><strong>Advanced conditions</strong></div>';
      advancedConditions.forEach((ac, i) => {
        const ms = ac.milestone ? ac.milestone.entityUid || ac.milestone.entityId : '';
        html += '<div class="condition-block mb-2 p-2 rounded" style="background: rgba(74,144,164,0.08); border-left: 4px solid #4a90a4;">';
        html += '<span class="milestone-badge">' + escapeHtml(ms || 'Milestone') + '</span>';
        html += '<pre class="mb-1 mt-1 small" style="white-space: pre-wrap;">' + escapeHtml(ac.value) + '</pre>';
        if (ac.fields && ac.fields.length) {
          html += '<div><span class="badge text-bg-secondary me-1">Fields</span> ';
          ac.fields.forEach((f) => { html += '<span class="field-chip">[' + escapeHtml(f.entityId) + ']</span> '; });
          html += '</div>';
        }
        html += '</div>';
      });
    }

    if (requiredFields && requiredFields.length) {
      html += '<div class="mb-2"><strong>Required fields</strong></div><ul class="small mb-0">';
      requiredFields.forEach((rf) => {
        html += '<li><span class="milestone-badge">' + escapeHtml(rf.milestone) + '</span> [' + escapeHtml(rf.fieldId) + '] ' + escapeHtml(rf.fieldUid || '') + '</li>';
      });
      html += '</ul>';
    }

    brExtractContent.innerHTML = html || '<span class="text-muted">No advanced conditions</span>';
  }

  btn.addEventListener('click', () => {
    brXmlInput.value = '';
    if (brXmlFile) brXmlFile.value = '';
    if (brConditionSnippetInput) brConditionSnippetInput.value = '';
    if (brTool8JsonInput) brTool8JsonInput.value = '';
    lastParsed = null;
    brExtractStatus.textContent = '';
    brExtractResults.style.display = 'none';
    brCreateTestBtn.disabled = true;
    showBsModal(modal);
  });

  if (brXmlFile) brXmlFile.addEventListener('change', (e) => {
    const f = e.target && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      brXmlInput.value = r.result || '';
    };
    r.readAsText(f);
  });

  brExtractBtn.addEventListener('click', () => {
    if (!window.brRuleParser) {
      brExtractStatus.textContent = 'BR parser not loaded.';
      return;
    }

    let tabHref = getActiveBrTabHref();
    const xmlText = getXmlText();
    const snippetText = brConditionSnippetInput ? String(brConditionSnippetInput.value).trim() : '';
    const tool8Text = brTool8JsonInput ? String(brTool8JsonInput.value).trim() : '';
    const xmlTab = tabHref === '#brPasteTab' || tabHref === '#brUploadTab' || tabHref === '';
    if (xmlTab && !xmlText && snippetText) {
      tabHref = '#brConditionTab';
    } else if (xmlTab && !xmlText && !snippetText && tool8Text) {
      tabHref = '#brTool8Tab';
    }

    if (tabHref === '#brConditionTab') {
      const snippet = snippetText;
      if (!snippet) {
        brExtractStatus.textContent = 'Paste the VB condition (If … Then Fail …) first.';
        brExtractResults.style.display = 'none';
        brCreateTestBtn.disabled = true;
        return;
      }
      if (!window.brRuleParser.parseBRConditionSnippet) {
        brExtractStatus.textContent = 'BR parser missing parseBRConditionSnippet; refresh the page.';
        brCreateTestBtn.disabled = true;
        return;
      }
      lastParsed = window.brRuleParser.parseBRConditionSnippet(snippet);
    } else if (tabHref === '#brTool8Tab') {
      const jsonText = tool8Text;
      if (!jsonText) {
        brExtractStatus.textContent = 'Paste Tool 8 JSON or VB field logic here, then Extract.';
        brExtractResults.style.display = 'none';
        brCreateTestBtn.disabled = true;
        return;
      }
      if (!window.tool8FieldMatrix || !window.tool8FieldMatrix.parseTool8FieldMatrixJson) {
        brExtractStatus.textContent = 'Tool 8 helper not loaded; refresh the page.';
        brExtractResults.style.display = 'none';
        brCreateTestBtn.disabled = true;
        return;
      }
      const trimmedT8 = jsonText.trim();
      const looksLikeTool8JsonArray =
        trimmedT8.startsWith('[') && (/^\[\s*\{/.test(trimmedT8) || /^\[\s*"/.test(trimmedT8));
      const t8 = window.tool8FieldMatrix.parseTool8FieldMatrixJson(jsonText);
      if (!t8.error) {
        lastParsed = {
          rule: { name: 'Tool 8 (Alchemist) field matrix', ruleType: 'Tool8FieldMatrix', status: '' },
          mainCondition: null,
          advancedConditions: [
            {
              value: 'JSON matrix — ' + t8.items.length + ' field row(s) (see Tool 8 → Transform XML)',
              milestone: null,
              fields: t8.items.map((it) => ({
                entityId: window.tool8FieldMatrix.stripBrackets(it.FieldID),
                entityUid: it.Label || '',
              })),
            },
          ],
          requiredFields: [],
          _tool8Matrix: t8,
        };
      } else {
        const vbIds = window.brRuleParser.extractFieldIdsFromConditionText
          ? window.brRuleParser.extractFieldIdsFromConditionText(jsonText)
          : [];
        if (!looksLikeTool8JsonArray && vbIds.length > 0 && window.brRuleParser.parseBRConditionSnippet) {
          lastParsed = window.brRuleParser.parseBRConditionSnippet(jsonText);
          if (lastParsed.error) {
            lastParsed = { error: lastParsed.error + ' (input is not Tool 8 JSON: ' + t8.error + ')' };
          }
        } else {
          lastParsed = {
            error:
              t8.error +
              (looksLikeTool8JsonArray
                ? ''
                : ' Tip: paste VB with [FieldID] references in this tab or use **VB condition only**.'),
          };
        }
      }
    } else {
      const xml = xmlText;
      if (!xml) {
        brExtractStatus.textContent = 'Paste or upload BR XML first (or switch to VB / Tool 8 tab).';
        brExtractResults.style.display = 'none';
        brCreateTestBtn.disabled = true;
        return;
      }
      lastParsed = window.brRuleParser.parseBRXml(xml);
    }

    brExtractResults.style.display = 'block';
    renderExtract(lastParsed);
    const hasAdvanced =
      lastParsed &&
      !lastParsed.error &&
      lastParsed.advancedConditions &&
      lastParsed.advancedConditions.length > 0;
    brCreateTestBtn.disabled = !hasAdvanced;
    if (lastParsed && lastParsed._tool8Matrix) {
      brExtractStatus.textContent =
        lastParsed._tool8Matrix.items.length + ' Tool 8 field row(s), ' +
        (lastParsed._tool8Matrix.fieldIds ? lastParsed._tool8Matrix.fieldIds.length : 0) +
        ' unique field id(s)';
    } else {
      brExtractStatus.textContent = lastParsed.error
        ? lastParsed.error
        : (lastParsed.advancedConditions ? lastParsed.advancedConditions.length : 0) + ' advanced condition(s), ' +
          (lastParsed.requiredFields ? lastParsed.requiredFields.length : 0) + ' required field(s)';
    }
  });

  brCreateTestBtn.addEventListener('click', async () => {
    if (!lastParsed || lastParsed.error) return;

    let metaLookup = {};
    try {
      metaLookup = await buildEncompassFieldMetadataLookupForUnitTests();
    } catch (_) {
      /* continue without API labels */
    }

    let result;
    let sourceName;
    let calcExpr;
    let desc;

    if (lastParsed._tool8Matrix && window.tool8FieldMatrix) {
      result = window.tool8FieldMatrix.generateUnitTestFromTool8FieldMatrix(lastParsed._tool8Matrix, {
        fieldMetadataLookup: metaLookup,
      });
      sourceName = 'Generated: Tool 8 (Alchemist) matrix';
      calcExpr = '';
      desc = 'Tool 8 (Alchemist) field matrix';
    } else {
      if (!window.brRuleParser) return;
      result = window.brRuleParser.generateUnitTestFromBRRule(lastParsed, { fieldMetadataLookup: metaLookup });
      sourceName = 'Generated: BR ' + (lastParsed.rule ? lastParsed.rule.name || lastParsed.rule.ruleType : 'Rule');
      const firstAdv = lastParsed.advancedConditions && lastParsed.advancedConditions[0];
      calcExpr = lastParsed.mainCondition
        ? lastParsed.mainCondition.expression
        : firstAdv && firstAdv.value
          ? firstAdv.value
          : '';
      desc = 'BR Rule: ' + (lastParsed.rule ? lastParsed.rule.name : '');
    }

    if (!result || !result.rows || result.rows.length === 0) {
      showToast('No test rows generated', 'warning');
      return;
    }
    loadGeneratedTestData(result.headers, result.rows, result.testDescriptions, sourceName, metaLookup, {
      fieldId: '',
      calculation: calcExpr,
      description: desc,
    });
    hideBsModal(modal);
    showToast('Unit test generated', 'success');
  });

  if (brSaveToServerBtn) {
    brSaveToServerBtn.addEventListener('click', async () => {
      const tabHref = getActiveBrTabHref();
      let sourceFormat;
      let body;
      let originalName;
      if (tabHref === '#brConditionTab') {
        body = brConditionSnippetInput ? String(brConditionSnippetInput.value).trim() : '';
        sourceFormat = 'encompass_br_vb_snippet';
        originalName = 'vb-condition.txt';
      } else if (tabHref === '#brTool8Tab') {
        body = brTool8JsonInput ? String(brTool8JsonInput.value).trim() : '';
        sourceFormat = 'tool8_field_matrix_json';
        originalName = 'tool8-field-matrix.json';
      } else {
        body = getXmlText();
        sourceFormat = 'encompass_br_xml';
        originalName = 'business-rule.xml';
      }
      if (!body) {
        showToast('Nothing to save on this tab', 'warning');
        return;
      }
      try {
        const res = await fetch('/api/unit-tests/br-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceFormat, body, originalName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Save failed');
        await loadBrRuleLibrary();
        showToast('Saved to BR library', 'success');
      } catch (err) {
        showToast(err.message || 'Save failed', 'err');
      }
    });
  }
}

function initializeSectionSidebar() {
  const nav = document.getElementById('sectionSidebarNav');
  if (!nav) return;

  // On load: hide section cards and collapse; then open Unit Test Data so status, welcome, and upload are visible
  var sectionIds = ['collapseAIAssistant', 'collapseTestLibrary', 'collapseOverallSignOff', 'collapseTestScenarios', 'collapseSelectedField', 'collapseTestGrid', 'collapseUnitTestData'];
  sectionIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.remove('show');
      try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
          const inst = bootstrap.Collapse.getInstance(el);
          if (inst) inst.hide();
        } else if (window.$ && window.$.fn && window.$.fn.collapse) {
          window.$(el).collapse('hide');
        }
      } catch (_) {}
    }
    var card = getSectionCardForCollapse(id);
    if (card) card.classList.add('section-card-hidden');
  });
  var sidebarNav = document.getElementById('sectionSidebarNav');
  if (sidebarNav) {
    sidebarNav.querySelectorAll('.active-section').forEach(function (a) { a.classList.remove('active-section'); });
  }
  if (typeof history !== 'undefined' && history.replaceState && location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  // Sidebar click: toggle section visibility (multiple sections can stay open)
  nav.addEventListener('click', function (e) {
    const link = e.target.closest('a[data-bs-target], a[data-target], a[data-action]');
    if (!link) return;
    e.preventDefault();
    const action = link.getAttribute('data-action');
    if (action === 'voice-help') {
      if (typeof toggleVoiceHelp === 'function') toggleVoiceHelp(true);
      return;
    }
    const target = link.getAttribute('data-bs-target') || link.getAttribute('data-target');
    if (target && typeof toggleAccordionSection === 'function') {
      toggleAccordionSection(target);
      const heading = document.getElementById(link.getAttribute('data-heading'));
      if (heading) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            heading.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        });
      }
    }
  });

  // Sync sidebar active state when sections expand/collapse (from header clicks, voice, or sidebar)
  var sectionIds = ['collapseAIAssistant', 'collapseTestLibrary', 'collapseOverallSignOff', 'collapseTestScenarios', 'collapseSelectedField', 'collapseTestGrid', 'collapseUnitTestData'];
  sectionIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('shown.bs.collapse', function () {
      updateSectionSidebarActiveState(id, true);
    });
    el.addEventListener('hidden.bs.collapse', function () {
      updateSectionSidebarActiveState(id, false);
    });
  });

  var utdId = 'collapseUnitTestData';
  var utdEl = document.getElementById(utdId);
  var utdCard = getSectionCardForCollapse(utdId);
  if (utdCard) utdCard.classList.remove('section-card-hidden');
  if (utdEl) {
    updateSectionHeaderState(utdId, true);
    bsCollapseShow(utdEl);
  }
  updateSectionSidebarActiveState(utdId, true);

  document.querySelectorAll('.section-card-header[role="button"]').forEach((h) => {
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        h.click();
      }
    });
  });
}

// Initialize grid on load
document.addEventListener('DOMContentLoaded', () => {
  initializeGrid();
  initializeVoiceWidget();
  initializeScanSetFields();
  initializeGenerateFromCustomField();
  initializeGenerateFromBRRule();
  initializeScenarioBuilderApplyControls();
  initializeSectionSidebar();
  const welcomeUploadBtn = document.getElementById('welcomeUploadBtn');
  welcomeUploadBtn?.addEventListener('click', () => fileInput?.click());
  updateLoanGuidChipDisplay(currentLoanGuid);
  renderRecentRunsSelect();
  loadTestLibrary();
  loadBrRuleLibrary();
  if (typeof window !== 'undefined') {
    window.addEventListener('encompassEnvChanged', () => {
      _hubFieldListsCache = null;
    });
  }
  if (failFirstBtn) {
    failFirstBtn.disabled = true;
  }
});
