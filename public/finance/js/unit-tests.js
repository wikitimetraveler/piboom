const statusChip = document.getElementById('statusChip');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadArea = document.getElementById('uploadArea');
const gridContainer = document.getElementById('gridContainer');
const unitTestsGrid = document.getElementById('unitTestsGrid');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const resultsMeta = document.getElementById('resultsMeta');
const fileInfo = document.getElementById('fileInfo');
const exampleFilesList = document.getElementById('exampleFilesList');

let gridApi;
let allData = [];
let columnDefs = [];

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
        
        // Extract headers from the Step row
        const headers = jsonData[headerRowIndex].map(normalizeHeader);
        
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
  
  // Identify test columns (columns that start with "Test" or contain test numbers)
  const testColumns = headers.filter(h => {
    const headerLower = h.toLowerCase().trim();
    return headerLower.startsWith('test') || /^test\s*\d+/i.test(headerLower);
  });
  
  // Pin non-test columns to the left (Reset is included but Test columns are not)
  const pinnedColumns = ['Step', 'Action', 'Target', 'Description', 'Reset'];
  
  headers.forEach((header, index) => {
    if (!header || header.trim() === '') {
      header = `Column ${index + 1}`;
    }
    
    // Get column data for type detection
    const columnData = rows.map(row => row[header]);
    const columnType = detectColumnType(columnData);
    
    const headerLower = header.toLowerCase().trim();
    const isTestColumn = headerLower.startsWith('test') || /^test\s*\d+/i.test(headerLower);
    const isPinnedColumn = pinnedColumns.some(p => headerLower.includes(p.toLowerCase()));
    
    const colDef = {
      headerName: header,
      field: header,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 120,
      flex: header === 'Description' ? 2 : 1,
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
      colDef.minWidth = 80;
      colDef.flex = 0.6;
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
      colDef.minWidth = 250;
      colDef.flex = 1.8;
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
      colDef.minWidth = 300;
      colDef.flex = 2.5;
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
      colDef.minWidth = 120;
      colDef.flex = 1;
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
      colDef.minWidth = 120;
      colDef.flex = 0.8;
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
      flex: 1,
      minWidth: 120,
    },
    animateRows: true,
    overlayNoRowsTemplate: '<span class="text-muted">No data available. Upload an Excel file to get started.</span>',
    enableRangeSelection: true,
    suppressRowClickSelection: false,
  };
  
  if (typeof agGrid.createGrid === 'function') {
    gridApi = agGrid.createGrid(unitTestsGrid, gridOptions);
  } else {
    new agGrid.Grid(unitTestsGrid, gridOptions);
    gridApi = gridOptions.api;
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
  if (typeof gridApi.sizeColumnsToFit === 'function') {
    setTimeout(() => {
      gridApi.sizeColumnsToFit();
    }, 100);
  }
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
  const card = document.getElementById('testDescriptionsCard');
  
  if (!container || !card) return;
  
  container.innerHTML = '';
  card.style.display = 'block';
  
  testDescriptions.forEach(test => {
    const cardElement = document.createElement('div');
    cardElement.className = 'test-description-card';
    cardElement.innerHTML = `
      <div class="test-number-badge">${test.testNumber}</div>
      <div class="test-description-text">${test.description}</div>
    `;
    container.appendChild(cardElement);
  });
}

function hideTestDescriptions() {
  const container = document.getElementById('testDescriptionsContainer');
  const card = document.getElementById('testDescriptionsCard');
  if (container) {
    container.innerHTML = '';
  }
  if (card) {
    card.style.display = 'none';
  }
}

function clearData() {
  allData = [];
  columnDefs = [];
  
  if (gridApi) {
    setGridRows([]);
  }
  
  fileInput.value = '';
  searchInput.value = '';
  uploadArea.style.display = 'block';
  gridContainer.style.display = 'none';
  exportBtn.style.display = 'none';
  clearBtn.style.display = 'none';
  fileInfo.textContent = 'No file loaded';
  fileInfo.innerHTML = 'No file loaded';
  resultsMeta.textContent = '0 rows';
  hideTestDescriptions();
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
    
    // Count test scenario columns
    const testColumns = headers.filter(h => {
      const headerLower = h.toLowerCase().trim();
      return headerLower.startsWith('test') || /^test\s*\d+/i.test(headerLower);
    });
    
    // Display test descriptions if available
    if (testDescriptions && testDescriptions.length > 0) {
      displayTestDescriptions(testDescriptions);
    } else {
      hideTestDescriptions();
    }
    
    // Update UI
    uploadArea.style.display = 'none';
    gridContainer.style.display = 'block';
    exportBtn.style.display = 'inline-block';
    clearBtn.style.display = 'inline-block';
    
    // Build enhanced file info with test descriptions
    let fileInfoHTML = `<strong>${parsedFileName}</strong>`;
    fileInfoHTML += ` <span class="text-muted">(${rows.length} test step${rows.length !== 1 ? 's' : ''}, ${headers.length} columns)</span>`;
    
    if (testDescriptions && testDescriptions.length > 0) {
      fileInfoHTML += `<div class="mt-2"><small class="text-muted">Test Scenarios:</small> `;
      const testList = testDescriptions.map(test => 
        `<span class="badge badge-light mr-1" title="${test.description}">Test ${test.testNumber}</span>`
      ).join('');
      fileInfoHTML += testList + `</div>`;
    } else if (testColumns.length > 0) {
      fileInfoHTML += ` <span class="text-muted">• ${testColumns.length} test scenario${testColumns.length !== 1 ? 's' : ''}</span>`;
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

// Initialize grid on load
document.addEventListener('DOMContentLoaded', () => {
  initializeGrid();
});
