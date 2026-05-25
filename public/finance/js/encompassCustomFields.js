/**
 * Development work by David Lane
 */
const resultsMeta = document.getElementById('resultsMeta');
const statusChip = document.getElementById('statusChip');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const gridRoot = document.getElementById('fieldsGrid');

const filters = {
  searchInput: document.getElementById('searchInput'),
  fieldId: document.getElementById('fieldIdFilter'),
  fieldName: document.getElementById('fieldNameFilter'),
  category: document.getElementById('categoryFilter'),
  fieldType: document.getElementById('fieldTypeFilter'),
  dataType: document.getElementById('dataTypeFilter'),
  inputType: document.getElementById('inputTypeFilter'),
  required: document.getElementById('requiredFilter'),
  readOnly: document.getElementById('readOnlyFilter'),
  active: document.getElementById('activeFilter'),
  format: document.getElementById('formatFilter'),
};

const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');

let allFields = [];
let gridApi;

const columnDefs = [
  { headerName: 'Field ID', field: 'fieldId', filter: 'agTextColumnFilter', minWidth: 140 },
  { headerName: 'Name', field: 'name', filter: 'agTextColumnFilter', minWidth: 180 },
  { headerName: 'Description', field: 'description', filter: 'agTextColumnFilter', minWidth: 220 },
  { headerName: 'Category', field: 'category', filter: 'agTextColumnFilter', minWidth: 160 },
  { headerName: 'Field Type', field: 'fieldType', filter: 'agTextColumnFilter', minWidth: 160 },
  { headerName: 'Data Type', field: 'dataType', filter: 'agTextColumnFilter', minWidth: 150 },
  { headerName: 'Input Type', field: 'inputType', filter: 'agTextColumnFilter', minWidth: 150 },
  { headerName: 'Required', field: 'required', filter: 'agTextColumnFilter', minWidth: 120 },
  { headerName: 'Read Only', field: 'readOnly', filter: 'agTextColumnFilter', minWidth: 120 },
  { headerName: 'Active', field: 'active', filter: 'agTextColumnFilter', minWidth: 110 },
  { headerName: 'Calculated', field: 'isCalculated', filter: 'agTextColumnFilter', minWidth: 130 },
  { headerName: 'Length', field: 'maxLength', filter: 'agNumberColumnFilter', minWidth: 120 },
  { headerName: 'Format', field: 'format', filter: 'agTextColumnFilter', minWidth: 140 },
  { headerName: 'Contract Path', field: 'contractPath', filter: 'agTextColumnFilter', minWidth: 240 },
  { headerName: 'JSON Path', field: 'jsonPath', filter: 'agTextColumnFilter', minWidth: 240 },
  { headerName: 'Calculation', field: 'calculation', filter: 'agTextColumnFilter', minWidth: 240 },
];

const gridOptions = {
  columnDefs,
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
  overlayNoRowsTemplate: '<span class="text-muted">No fields match the current filters.</span>',
};

function setStatus(text, status = 'ok', icon = 'bi-check-circle') {
  statusChip.className = `status-chip ${status}`;
  statusChip.innerHTML = `<i class="bi ${icon}"></i> ${text}`;
}

function formatBoolean(value) {
  return value ? 'Yes' : 'No';
}

function normalizeField(item = {}) {
  const calculation =
    item.calculationExpression ||
    item.calculation ||
    item.calculatedExpression ||
    item.expression ||
    item.formula ||
    item.script ||
    item.calculationScript ||
    '';

  return {
    fieldId: item.fieldId || item.id || item.fieldName || item.name || '',
    name: item.fieldName || item.name || item.title || '',
    description: item.description || item.longDescription || item.shortDescription || item.label || '',
    category: item.category || item.categoryName || item.fieldCategory || '',
    fieldType: item.fieldType || item.type || item.fieldTypeName || '',
    dataType: item.dataType || item.dataTypeName || item.valueType || '',
    inputType: item.inputType || item.uiType || item.inputControl || '',
    required: formatBoolean(item.required ?? item.isRequired ?? false),
    readOnly: formatBoolean(item.readOnly ?? item.isReadOnly ?? false),
    active: formatBoolean(item.active ?? item.isActive ?? true),
    isCalculated: formatBoolean(
      item.isCalculatedField ?? item.isCalculated ?? item.calculated ?? item.isCalculation ?? false,
    ),
    maxLength: item.maxLength ?? item.length ?? item.maxChars ?? '',
    format: item.format || item.formatType || item.displayFormat || '',
    contractPath: item.contractPath || item.fieldPath || item.path || '',
    jsonPath: item.jsonPath || item.jsonpath || '',
    calculation,
  };
}

function updateSelectOptions(selectEl, values) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">Any</option>';
  values.forEach((value) => {
    if (!value) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  });
  selectEl.value = current;
}

function getUniqueValues(list, key) {
  return [...new Set(list.map((item) => item[key]).filter(Boolean))].sort();
}

function setTextFilter(field, value) {
  if (!gridApi) return;
  const normalized = value || '';
  const modelValue = normalized ? { type: 'contains', filter: normalized } : null;

  const applyModel = (filterInstance) => {
    if (!filterInstance) return;
    filterInstance.setModel(modelValue);
    gridApi.onFilterChanged?.();
  };

  if (typeof gridApi.getFilterInstance === 'function') {
    if (gridApi.getFilterInstance.length >= 2) {
      gridApi.getFilterInstance(field, applyModel);
      return;
    }
    const maybeInstance = gridApi.getFilterInstance(field);
    if (maybeInstance?.then) {
      maybeInstance.then(applyModel);
      return;
    }
    if (maybeInstance) {
      applyModel(maybeInstance);
      return;
    }
  }

  if (typeof gridApi.getColumnFilterInstance === 'function') {
    if (gridApi.getColumnFilterInstance.length >= 2) {
      gridApi.getColumnFilterInstance(field, applyModel);
      return;
    }
    const maybeInstance = gridApi.getColumnFilterInstance(field);
    if (maybeInstance?.then) {
      maybeInstance.then(applyModel);
      return;
    }
    if (maybeInstance) {
      applyModel(maybeInstance);
      return;
    }
  }

  if (typeof gridApi.setFilterModel === 'function') {
    const current = gridApi.getFilterModel ? gridApi.getFilterModel() : {};
    if (modelValue) {
      current[field] = modelValue;
    } else {
      delete current[field];
    }
    gridApi.setFilterModel(current);
    gridApi.onFilterChanged?.();
  }
}

function applyFilters() {
  if (!gridApi) return;
  const term = filters.searchInput.value.trim();
  const fieldIdFilter = filters.fieldId.value.trim();
  const fieldNameFilter = filters.fieldName.value.trim();
  const categoryFilter = filters.category.value;
  const fieldTypeFilter = filters.fieldType.value;
  const dataTypeFilter = filters.dataType.value;
  const inputTypeFilter = filters.inputType.value;
  const requiredFilter = filters.required.value;
  const readOnlyFilter = filters.readOnly.value;
  const activeFilter = filters.active.value;
  const formatFilter = filters.format.value.trim();

  if (typeof gridApi.setQuickFilter === 'function') {
    gridApi.setQuickFilter(term);
  } else if (typeof gridApi.setGridOption === 'function') {
    gridApi.setGridOption('quickFilterText', term);
  }
  setTextFilter('fieldId', fieldIdFilter);
  setTextFilter('name', fieldNameFilter);
  setTextFilter('category', categoryFilter);
  setTextFilter('fieldType', fieldTypeFilter);
  setTextFilter('dataType', dataTypeFilter);
  setTextFilter('inputType', inputTypeFilter);
  setTextFilter('required', requiredFilter === '' ? '' : requiredFilter === 'true' ? 'Yes' : 'No');
  setTextFilter('readOnly', readOnlyFilter === '' ? '' : readOnlyFilter === 'true' ? 'Yes' : 'No');
  setTextFilter('active', activeFilter === '' ? '' : activeFilter === 'true' ? 'Yes' : 'No');
  setTextFilter('format', formatFilter);

  resultsMeta.textContent = `${gridApi.getDisplayedRowCount()} of ${allFields.length}`;
}

function wireFilterEvents() {
  Object.values(filters).forEach((el) => {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  applyFiltersBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    applyFilters();
  });

  clearFiltersBtn.addEventListener('click', () => {
    filters.searchInput.value = '';
    filters.fieldId.value = '';
    filters.fieldName.value = '';
    filters.category.value = '';
    filters.fieldType.value = '';
    filters.dataType.value = '';
    filters.inputType.value = '';
    filters.required.value = '';
    filters.readOnly.value = '';
    filters.active.value = '';
    filters.format.value = '';
    applyFilters();
  });
}

function initializeGrid() {
  if (!gridRoot || gridApi) return;
  if (typeof agGrid.createGrid === 'function') {
    gridApi = agGrid.createGrid(gridRoot, gridOptions);
  } else {
    new agGrid.Grid(gridRoot, gridOptions);
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
}

function exportGrid() {
  if (!gridApi || typeof gridApi.exportDataAsCsv !== 'function') {
    console.warn('CSV export unavailable for custom fields grid');
    return;
  }

  gridApi.exportDataAsCsv({
    fileName: 'encompass-custom-fields.csv',
    onlyFiltered: true,
  });
}

async function loadFields() {
  try {
    setStatus('Loading', 'ok', 'bi-clock-history');
    initializeGrid();
    const response = await (window.encompassApi?.encompassFetch || fetch)('/api/encompass-hub/custom-fields');
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    const data = await response.json();
    const rawItems = Array.isArray(data) ? data : data.items || data.fields || [];
    allFields = rawItems.map(normalizeField);

    updateSelectOptions(filters.category, getUniqueValues(allFields, 'category'));
    updateSelectOptions(filters.fieldType, getUniqueValues(allFields, 'fieldType'));
    updateSelectOptions(filters.dataType, getUniqueValues(allFields, 'dataType'));
    updateSelectOptions(filters.inputType, getUniqueValues(allFields, 'inputType'));

    resultsMeta.textContent = `${allFields.length}`;
    setStatus('Loaded', 'ok', 'bi-check-circle');
    setGridRows(allFields);
    gridApi.sizeColumnsToFit();
    applyFilters();
  } catch (error) {
    console.error('Failed to load custom fields', error);
    setStatus('Error', 'err', 'bi-exclamation-octagon');
    if (gridApi) {
      setGridRows([]);
      if (typeof gridApi.showNoRowsOverlay === 'function') {
        gridApi.showNoRowsOverlay();
      }
    }
  }
}

refreshBtn.addEventListener('click', (event) => {
  event.preventDefault();
  loadFields();
});

exportBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  exportGrid();
});

wireFilterEvents();
loadFields();
