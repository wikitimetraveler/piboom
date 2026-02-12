const statusChip = document.getElementById('statusChip');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadArea = document.getElementById('uploadArea');
const unitTestsGrid = document.getElementById('unitTestsGrid');
const exportBtn = document.getElementById('exportBtn');
const runTestsBtn = document.getElementById('runTestsBtn');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const resultsMeta = document.getElementById('resultsMeta');
const fileInfo = document.getElementById('fileInfo');
const exampleFilesList = document.getElementById('exampleFilesList');
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

let gridApi;
let allData = [];
let columnDefs = [];
let testDescriptionsData = []; // Store test descriptions (scenario metadata)
let currentFileName = ''; // Store current file name for database operations
let voiceWidgetInstance = null;
let currentLoanGuid = '';
let lastRunResults = [];
let lastRunSummary = null;

const RECENT_RUNS_KEY = 'unitTestsRecentRuns';

/**
 * Extract field ID from bracket notation (e.g., "[LOCKRATE.2866]" -> "LOCKRATE.2866")
 */
function extractFieldId(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

/**
 * Check if a value contains a field ID in brackets
 */
function hasFieldId(value) {
  return extractFieldId(value) !== null;
}

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

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON - get all rows first
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        });
        
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
        // Look for columns like "Test #" and "Test Plan" descriptions
        const testDescriptions = [];
        const rowsBeforeStep = jsonData.slice(0, headerRowIndex);
        
        // Find rows with test numbers (1-11) in first column and descriptions in second column
        for (let rowIdx = 0; rowIdx < rowsBeforeStep.length; rowIdx++) {
          const row = rowsBeforeStep[rowIdx];
          const col1 = normalizeValue(row[0]);
          const col2 = normalizeValue(row[1]);
          
          // Check if first column is a test number (1-11) and second has description
          if (col1 && col2 && /^\d+$/.test(col1) && parseInt(col1) >= 1 && parseInt(col1) <= 11 && col2.length > 3) {
            testDescriptions.push({
              testNumber: col1,
              description: col2
            });
          }
        }
        
        // Also check for header row pattern (Test #, Test Plan, etc.)
        if (testDescriptions.length === 0 && rowsBeforeStep.length > 0) {
          for (let rowIdx = 0; rowIdx < rowsBeforeStep.length; rowIdx++) {
            const row = rowsBeforeStep[rowIdx];
            const rowLower = row.map(cell => String(cell).toLowerCase().trim());
            
            // Check if this row has test-related headers
            const hasTestHeader = rowLower.some(cell => 
              (cell.includes('test') && (cell.includes('#') || cell.includes('number'))) ||
              (cell.includes('test') && cell.includes('plan'))
            );
            
            if (hasTestHeader && rowIdx + 1 < rowsBeforeStep.length) {
              // Process rows after this header
              const testDataRows = rowsBeforeStep.slice(rowIdx + 1);
              testDataRows.forEach(testRow => {
                const testNum = normalizeValue(testRow[0]);
                const testDesc = normalizeValue(testRow[1]);
                if (testNum && testDesc && testNum.toLowerCase() !== 'null' && /^\d+$/.test(testNum)) {
                  testDescriptions.push({
                    testNumber: testNum,
                    description: testDesc
                  });
                }
              });
              break;
            }
          }
        }
        
        // Extract headers from the Step row; ensure unique keys so each scenario column has its own field
        const rawHeaders = jsonData[headerRowIndex].map(normalizeHeader);
        const seen = {};
        const headers = rawHeaders.map((h, idx) => {
          const base = h && String(h).trim() ? h : `Scenario_${idx + 1}`;
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

function generateColumnDefs(headers, rows) {
  const defs = [];
  
  const descriptionIndex = headers.findIndex((h) => String(h || '').toLowerCase().trim() === 'description');

  // No pinning - all columns scroll together to avoid header/body alignment issues at pinned boundary
  const pinnedColumns = [];

  headers.forEach((header, index) => {
    if (!header || header.trim() === '') {
      header = `Column ${index + 1}`;
    }
    
    // Get column data for type detection
    const columnData = rows.map(row => row[header]);
    const columnType = detectColumnType(columnData);
    
    const headerLower = header.toLowerCase().trim();
    const isTestColumn = descriptionIndex >= 0 && index > descriptionIndex;
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
      colDef.minWidth = 200;
      colDef.width = 220;
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
      colDef.width = 280;
      colDef.headerClass = 'description-header';
      colDef.cellClass = 'description-cell';
      colDef.wrapText = true;
      colDef.autoHeight = false;
      // Description can be longer, so allow wrapping
      colDef.cellStyle = { whiteSpace: 'normal', lineHeight: '1.5' };
    }
    
    // Special handling for Test columns - contain values for Set operations
    // These are test scenario values that will be used when Action = "Set"
    if (isTestColumn) {
      colDef.minWidth = 90;
      colDef.width = 110;
      colDef.headerClass = 'test-scenario-column';
      colDef.cellClass = 'test-scenario-cell';
      
      // Detect value types and style accordingly
      colDef.cellRenderer = (params) => {
        if (!params.value || params.value === '' || params.value === null || params.value === undefined) {
          return '<span class="text-muted">—</span>';
        }
        
        const value = String(params.value).trim();
        const valueLower = value.toLowerCase();
        
        // Boolean/Yes-No values (Y/N, Yes/No, True/False)
        if (valueLower === 'y' || valueLower === 'yes' || valueLower === 'true' || value === '1') {
          return '<span class="test-value-badge test-value-yes">Y</span>';
        }
        if (valueLower === 'n' || valueLower === 'no' || valueLower === 'false' || value === '0') {
          return '<span class="test-value-badge test-value-no">N</span>';
        }
        
        // Numeric values (like IDs: 2518608430, 1765780087)
        if (/^\d+$/.test(value)) {
          return `<span class="test-value-numeric" title="Numeric ID: ${value}">${value}</span>`;
        }
        
        // Text values (like "FHLMC Conf Fixed 30 Buydown")
        return `<span class="test-value-text" title="Test value for Set operation">${value}</span>`;
      };
      
      // Tooltip to indicate these are Set operation values
      colDef.tooltipValueGetter = (params) => {
        if (!params.value) return 'Empty - No test value';
        return `Test Value: ${params.value}\n\nUsed when Action = "Set"`;
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
    theme: 'legacy',
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
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
  const descriptionIndex = columnDefs.findIndex((colDef) => {
    const header = String(colDef.headerName || colDef.field || '').trim().toLowerCase();
    return header === 'description';
  });
  if (descriptionIndex >= 0) {
    if (testNumber) {
      const offset = parseInt(testNumber, 10);
      if (!Number.isNaN(offset)) {
        const targetIndex = descriptionIndex + offset + 1;
        const targetCol = columnDefs[targetIndex];
        if (targetCol?.field) {
          return { field: targetCol.field, testNumber: String(testNumber) };
        }
      }
    } else {
      const resetCol = columnDefs[descriptionIndex + 1];
      if (resetCol?.field) {
        return { field: resetCol.field, testNumber: 'RESET' };
      }
    }
  }

  if (!testNumber) return null;
  const patterns = [
    `Test ${testNumber}`,
    `Test${testNumber}`,
    `Test #${testNumber}`,
    `Test#${testNumber}`,
    `Test-${testNumber}`,
    `Test_${testNumber}`
  ];
  const match = columnDefs.find((colDef) => {
    const header = String(colDef.headerName || colDef.field || '').trim();
    return patterns.some(pattern => header.toLowerCase() === pattern.toLowerCase());
  });
  return match ? { field: match.field, testNumber: String(testNumber) } : null;
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
  const pinned = ['step', 'action', 'target', 'description'];
  return columnDefs.slice(startIndex).filter((colDef) => {
    const header = String(colDef.headerName || colDef.field || '').trim().toLowerCase();
    return !pinned.some((p) => header.includes(p));
  }).map((colDef, idx) => {
    const raw = colDef.headerName || colDef.field || '';
    const headerLower = String(raw).trim().toLowerCase();
    const testNum = extractTestNumberFromKey(raw) || (headerLower === 'reset' ? 'RESET' : String(idx + 1));
    return { field: colDef.field, testNumber: testNum };
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

function exportToCSV() {
  if (!gridApi || typeof gridApi.exportDataAsCsv !== 'function') {
    console.warn('CSV export unavailable');
    return;
  }
  
  const fileName = fileInfo.textContent.replace('File: ', '').replace('.xlsx', '').replace('.xls', '') || 'unit-tests';
  gridApi.exportDataAsCsv({
    fileName: `${fileName}-export.csv`,
    onlyFiltered: false,
  });
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
      <div class="test-number-badge">${test.testNumber}</div>
      <div class="flex-grow-1">
        <div class="test-description-text">${test.description}</div>
        <div class="scenario-status-badges" data-test-number="${test.testNumber}"></div>
      </div>
    `;

    // Add click handler to highlight associated column
    cardElement.addEventListener('click', () => {
      document.querySelectorAll('.test-description-card').forEach(card => {
        card.classList.remove('test-scenario-active');
      });
      cardElement.classList.add('test-scenario-active');
      highlightTestColumn(test.testNumber);
    });

    container.appendChild(cardElement);
  });
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
    runSummaryCounts.textContent = `${total} total • ${passed} passed • ${failed} failed • ${skipped} skipped`;
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
 * Load test executions from database
 */
async function loadTestExecutionsFromDatabase(fileName) {
  if (!fileName) return {};

  try {
    const response = await fetch(`/api/unit-tests/executions?fileName=${encodeURIComponent(fileName)}`);

    if (!response.ok) {
      console.error('Failed to load test executions');
      return {};
    }

    const result = await response.json();
    return result.executions || {};
  } catch (error) {
    console.error('Error loading test executions:', error);
    return {};
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
 */
function displayOverallSignOff(executions) {
  const container = document.getElementById('overallSignOffContainer');
  if (!container) return;

  const overall = (executions && executions['overall']) || {};

  container.innerHTML = '';

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
          displayOverallSignOff({ ...(executions || {}), overall: { ...(overall || {}), [value]: { testedAt: result.execution.tested_at } } });
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

async function runTests() {
  if (!allData || allData.length === 0) {
    setStatus('No test data loaded', 'err', 'bi-exclamation-octagon');
    return;
  }
  
  try {
    setStatus('Running tests...', 'info', 'bi-clock-history');
    runTestsBtn.disabled = true;
    testResultsContainer.style.display = 'block';
    testResultsList.innerHTML = '<div class="text-center p-4"><i class="bi-hourglass-split" style="font-size: 2rem;"></i><p class="mt-2">Running tests...</p></div>';
    const scrollToTopBtnEl = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtnEl) scrollToTopBtnEl.style.display = 'none';
    
    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Run per scenario (Test 1, Test 2, ...) so each column gets its own results; exclude Reset
    const scenarioColumns = getOrderedTestColumns().filter((c) => c.testNumber && c.testNumber !== 'RESET');
    const columnsToRun = scenarioColumns.length > 0 ? scenarioColumns : [null];

    const getCache = {}; // key: `${scenario}-${rowIndex}-${fieldId}` — loan state differs per scenario (each runs its own SETs)

    for (const testColumn of columnsToRun) {
      for (let i = 0; i < allData.length; i++) {
        const row = allData[i];
        const step = row.Step || row.step || (i + 1);
        const action = row.Action || row.action || '';
        const target = row.Target || row.target || '';
        const description = row.Description || row.description || '';

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
            const setValue = currentCol ? row[currentCol.field] : null;
            const hasValue = setValue !== null && setValue !== undefined && String(setValue).trim() !== '';
            if (!currentCol || !hasValue) {
              result.status = 'skipped';
              result.message = 'Skipped (no value to set — field left as-is)';
            } else {
            try {
              const body = buildFieldWriterPayload(fieldId, setValue, row);
              const response = await fetch(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-writer`, {
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
                // Verify value was actually written (Set can return 200 but write null/wrong value)
                let readBack = null;
                try {
                  const getRes = await fetch(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-reader?invalidFieldBehavior=Include`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([fieldId])
                  });
                  if (getRes.ok) {
                    const getData = await getRes.json();
                    const match = Array.isArray(getData)
                      ? (getData.find((item) => item?.id === fieldId || item?.fieldId === fieldId) || getData[0])
                      : getData;
                    readBack = match?.value ?? match?.Value ?? match?.fieldValue ?? match?.field_value ?? null;
                  }
                } catch (_) {
                  readBack = null;
                }
                const setStr = String(setValue).trim();
                const readStr = readBack === null || readBack === undefined ? '' : String(readBack).trim();
                const same = setStr === readStr || (Number(setStr) === Number(readStr) && readStr !== '' && setStr !== '');
                if (same) {
                  result.status = 'info';
                  result.message = `SET ${fieldId} succeeded • Value: ${JSON.stringify(setValue)}`;
                } else {
                  result.status = 'err';
                  result.message = `Set returned OK but value mismatch: set ${JSON.stringify(setValue)}, got ${readBack === null || readBack === undefined ? 'null' : JSON.stringify(readBack)}`;
                }
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
              const response = await fetch(`/api/encompass-hub/loans/${encodeURIComponent(currentLoanGuid)}/field-reader?invalidFieldBehavior=Include`, {
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
                if (Array.isArray(data)) {
                  const match =
                    data.find((item) => item?.id === fieldId) ||
                    data.find((item) => item?.fieldId === fieldId) ||
                    data[0];
                  value = match?.value ?? match?.Value ?? match?.fieldValue ?? match?.field_value ?? null;
                } else if (data && typeof data === 'object') {
                  value = data[fieldId] ?? data[fieldId.toUpperCase()] ?? data[fieldId.toLowerCase()] ?? null;
                }
                const displayValue = value === null || value === undefined ? 'No value returned' : JSON.stringify(value);
                getCache[getCacheKey] = { status: 'info', message: `GET ${fieldId}: ${displayValue}`, value };
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
          if (cached.value !== null && cached.value !== undefined && currentCol) {
            row[currentCol.field] = cached.value;
            if (gridApi?.getDisplayedRowAtIndex) {
              const rowNode = gridApi.getDisplayedRowAtIndex(i);
              if (rowNode) rowNode.setDataValue(currentCol.field, cached.value);
            }
          }
        }
      } else if (actionNorm === 'compare') {
        // For compare, check if we have expected values
        const hasExpected = Object.values(testValues).some(v => v && v !== '');
        if (hasExpected) {
          result.status = 'info';
          result.message = `Would COMPARE ${fieldId} against expected values`;
        } else {
          result.status = 'skipped';
          result.message = 'No expected values to compare';
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
    }

    // Display results
    displayTestResults(results, passed, failed, skipped);
    updateRunSummary(passed, failed, skipped, results.length);
    updateScenarioBadges(results);
    lastRunResults = results;
    saveRecentRun();
    if (failFirstBtn) {
      failFirstBtn.disabled = failed === 0;
    }
    setStatus(`Tests complete: ${passed} passed, ${failed} failed, ${skipped} skipped`, 
      failed > 0 ? 'err' : 'ok', 
      failed > 0 ? 'bi-exclamation-octagon' : 'bi-check-circle');
    
  } catch (error) {
    console.error('Error running tests:', error);
    setStatus(`Error running tests: ${error.message}`, 'err', 'bi-exclamation-octagon');
    testResultsList.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    const scrollToTopBtnEl = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtnEl) scrollToTopBtnEl.style.display = 'none';
  } finally {
    runTestsBtn.disabled = false;
  }
}

function displayTestResults(results, passed, failed, skipped) {
  const total = results.length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
  const hasMultipleScenarios = new Set(results.map((r) => r.testNumber).filter(Boolean)).size > 1;

  testResultsSummary.textContent = `${total} tests • ${passed} passed • ${failed} failed • ${skipped} skipped (${passRate}% pass rate)`;

  const SCROLL_THRESHOLD = 10;
  const showScrollBtn = results.length > SCROLL_THRESHOLD;

  let html = '<div class="test-results-grid" id="testResultsGrid">';

  results.forEach(result => {
    const statusClass = result.status === 'info' ? 'success' :
                       result.status === 'skipped' ? 'warning' : 'danger';
    const statusIcon = result.status === 'info' ? 'bi-check-circle' :
                      result.status === 'skipped' ? 'bi-skip-forward' : 'bi-x-circle';
    const scenarioLabel = hasMultipleScenarios && result.testNumber ? `<span class="badge badge-light mr-1">Test ${result.testNumber}</span>` : '';

    html += `
      <div class="test-result-card test-result-${result.status}">
        <div class="d-flex align-items-start">
          <div class="test-result-icon ${statusClass}">
            <i class="bi ${statusIcon}"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <strong>Step ${result.step}</strong>
              ${scenarioLabel}<span class="badge badge-${statusClass}">${result.action}</span>
            </div>
            <div class="text-muted small mb-1">${result.description || result.target}</div>
            <div class="test-result-message">${result.message}</div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  testResultsList.innerHTML = html;

  const scrollToTopBtn = document.getElementById('scrollToTopBtn');
  if (scrollToTopBtn) {
    scrollToTopBtn.style.display = showScrollBtn ? 'inline-flex' : 'none';
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
  
  if (gridApi) {
    setGridRows([]);
  }
  
  fileInput.value = '';
  searchInput.value = '';
  uploadArea.style.display = 'block';
  exportBtn.style.display = 'none';
  runTestsBtn.style.display = 'none';
  clearBtn.style.display = 'none';
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
  
  // Hide accordion container
  const accordionContainer = document.getElementById('accordionContainer');
  if (accordionContainer) {
    accordionContainer.style.display = 'none';
  }
  
  // Hide AI Assistant
  if (window.unitTestsAI && window.unitTestsAI.hide) {
    window.unitTestsAI.hide();
  }
  
  setStatus('Ready', 'info', 'bi-info-circle');
}

async function loadExampleFile(fileName) {
  try {
    setStatus('Loading example file...', 'info', 'bi-clock-history');
    
    const response = await fetch(`/finance/data/${encodeURIComponent(fileName)}`);
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });
    
    await handleFileUpload(file);
  } catch (error) {
    console.error('Error loading example file:', error);
    setStatus(`Error loading file: ${error.message}`, 'err', 'bi-exclamation-octagon');
  }
}

async function handleFileUpload(file) {
  if (!file) return;
  
  // Validate file type
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];
  
  const validExtensions = ['.xlsx', '.xls'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension && !validTypes.includes(file.type)) {
    setStatus('Invalid file type. Please upload .xlsx or .xls files.', 'err', 'bi-exclamation-octagon');
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
    allData = rows;
    
    // Initialize grid if not already done
    initializeGrid();
    
    // Populate grid
    setGridRows(allData);
    
    // Count scenario columns (all after Description except pinned)
    const descIdx = headers.findIndex((h) => String(h || '').toLowerCase().trim() === 'description');
    const pinned = ['step', 'action', 'target', 'description'];
    const scenarioColumns = descIdx >= 0
      ? headers.slice(descIdx + 1).filter((h) => !pinned.some((p) => String(h || '').toLowerCase().includes(p)))
      : [];
    
    // Store test descriptions globally for persistence
    testDescriptionsData = testDescriptions || [];
    
    // Store current file name
    currentFileName = parsedFileName;
    
    // Load test executions from database
    const executions = await loadTestExecutionsFromDatabase(parsedFileName);

    // Ensure accordion container is visible for grid/scenarios
    const accordionContainer = document.getElementById('accordionContainer');
    if (accordionContainer) {
      accordionContainer.style.display = 'block';
    }

    // Display Overall Test Sign-off (file-level; always show when file is loaded)
    displayOverallSignOff(executions);

    // Display test descriptions (scenarios) if available
    if (testDescriptions && testDescriptions.length > 0) {
      displayTestDescriptions(testDescriptionsData);
    } else {
      hideTestDescriptions();
    }
    
    // Update UI
    uploadArea.style.display = 'none';
    exportBtn.style.display = 'inline-block';
    runTestsBtn.style.display = 'inline-block';
    clearBtn.style.display = 'inline-block';
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
    
    if (testDescriptions && testDescriptions.length > 0) {
      fileInfoHTML += `<div class="mt-2"><small class="text-muted">Test Scenarios:</small> `;
      const testList = testDescriptions.map(test => 
        `<span class="badge badge-light mr-1" title="${test.description}">Test ${test.testNumber}</span>`
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

// Event listeners
uploadBtn.addEventListener('click', () => {
  fileInput.click();
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

exportBtn.addEventListener('click', (e) => {
  e.preventDefault();
  exportToCSV();
});

clearBtn.addEventListener('click', (e) => {
  e.preventDefault();
  clearData();
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

// Example file buttons
if (exampleFilesList) {
  exampleFilesList.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-file]');
    if (button) {
      const fileName = button.getAttribute('data-file');
      loadExampleFile(fileName);
    }
  });
}

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

  // Fallback: route to AI assistant
  if (window.unitTestsAI && typeof window.unitTestsAI.sendMessage === 'function') {
    showAccordionSection('collapseAIAssistant');
    window.unitTestsAI.sendMessage(rawCommand);
    speak('Sending your question to the assistant');
    return;
  }

  speak('Command not recognized for Unit Tests');
}

function showAccordionSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const trigger = document.querySelector(`[data-target="#${sectionId}"]`);
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.remove('collapsed');
  }
  if (window.$ && typeof window.$.fn?.collapse === 'function') {
    window.$(section).collapse('show');
  } else {
    section.classList.add('show');
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
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// Initialize grid on load
document.addEventListener('DOMContentLoaded', () => {
  initializeGrid();
  initializeVoiceWidget();
  updateLoanGuidChipDisplay(currentLoanGuid);
  renderRecentRunsSelect();
  if (failFirstBtn) {
    failFirstBtn.disabled = true;
  }
});
