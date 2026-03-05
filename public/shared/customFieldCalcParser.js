/**
 * Parse Encompass custom field calculation formulas and generate unit test rows.
 *
 * Supports simple formulas like:
 *   [CX.TEST] = 1 + [353]
 *   [CX.SUM] = [4002] + [4003]
 *   [CX.RESULT] = [353] * 2
 *
 * API/return format: Custom field objects with:
 *   - id / fieldId: output field ID (e.g. CX.TEST)
 *   - calculation / calculationExpression: formula string
 *   - isCalculatedField / isCalculated: boolean
 */
(function (global) {
  'use strict';

  /**
   * Parse a calculation formula to extract output field, input fields, and expression.
   * @param {string} formula - e.g. "[CX.TEST] = 1 + [353]" or "1 + [353]"
   * @returns {{ outputField: string|null, inputFields: string[], expression: string }|null}
   */
  function parseCalculationFormula(formula) {
    if (!formula || typeof formula !== 'string') return null;
    const trimmed = formula.trim();
    if (!trimmed) return null;

    // Pattern: [outputField] = expression  OR  just expression (output inferred from context)
    const assignMatch = trimmed.match(/^\s*\[([^\]]+)\]\s*=\s*(.+)$/);
    let outputField = null;
    let expression = trimmed;

    if (assignMatch) {
      outputField = assignMatch[1].trim();
      expression = assignMatch[2].trim();
    }

    // Extract all field references [fieldId] from the expression
    const fieldRefs = [...expression.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
    const inputFields = [...new Set(fieldRefs)];

    return {
      outputField,
      inputFields,
      expression,
    };
  }

  /**
   * Safely evaluate a simple arithmetic expression.
   * Replaces [fieldId] with provided values. Only allows numbers and + - * / ( ).
   * @param {string} expression - e.g. "1 + [353]" or "[4002] + [4003]"
   * @param {Record<string, number|string>} values - map of fieldId -> value
   * @returns {number|string|null} - evaluated result or null if invalid
   */
  function evaluateSimpleExpression(expression, values) {
    values = values || {};
    if (!expression || typeof expression !== 'string') return null;

    let expr = expression.trim();
    if (!expr) return null;

    // Replace each [fieldId] with the value
    const fieldRefs = [...expr.matchAll(/\[([^\]]+)\]/g)];
    for (let i = 0; i < fieldRefs.length; i++) {
      const m = fieldRefs[i];
      const fieldId = m[1].trim();
      const val = values[fieldId];
      const num = val === '' || val === null || val === undefined
        ? 0
        : typeof val === 'number'
          ? val
          : Number(val);
      const replacement = Number.isFinite(num) ? String(num) : '0';
      expr = expr.replace(m[0], replacement);
    }

    // Sanitize: only allow digits, decimals, + - * / ( ) and spaces
    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      return null;
    }

    try {
      const result = Function('"use strict"; return (' + expr + ')')();
      return typeof result === 'number' && Number.isFinite(result) ? result : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Normalize field ID for metadata lookup (strip leading @ date typecast, # number typecast).
   * @param {string} fieldId - e.g. "353", "@353", "#4002", "CX.TEST"
   * @returns {string}
   */
  function normalizeFieldIdForLookup(fieldId) {
    if (!fieldId || typeof fieldId !== 'string') return '';
    return String(fieldId).trim().replace(/^[@#]+/, '');
  }

  /**
   * True if field ID uses Encompass date notation (@ prefix).
   * Used to infer Date metadata when API lookup has no dataType.
   * @param {string} fieldId - e.g. "@353", "353"
   * @returns {boolean}
   */
  function isDateFieldByNotation(fieldId) {
    if (!fieldId || typeof fieldId !== 'string') return false;
    return String(fieldId).trim().startsWith('@');
  }

  /**
   * True if field ID uses Encompass number typecast (# prefix).
   * Used to infer Number metadata when API lookup has no dataType.
   * @param {string} fieldId - e.g. "#4002", "353"
   * @returns {boolean}
   */
  function isNumberFieldByNotation(fieldId) {
    if (!fieldId || typeof fieldId !== 'string') return false;
    return String(fieldId).trim().startsWith('#');
  }

  /**
   * Infer date/dateTime from custom field naming: .DT, .date, .dttm suffix (case-insensitive).
   * @param {string} fieldId - e.g. "CX.CLOSING.DT", "FI.SOMEDATE", "CX.EVENT.dttm"
   * @returns {{ dataType: 'Date'|'DateTime' }|null}
   */
  function inferDateTypeFromFieldId(fieldId) {
    if (!fieldId || typeof fieldId !== 'string') return null;
    const s = String(fieldId).trim();
    const lower = s.toLowerCase();
    if (lower.endsWith('.dttm')) return { dataType: 'DateTime', format: '', description: 'DateTime field (from .dttm suffix)' };
    if (lower.endsWith('.dt') || lower.endsWith('.date')) return { dataType: 'Date', format: '', description: 'Date field (from .DT/.date suffix)' };
    return null;
  }

  /** Fallback metadata for widely used fields when not in API response. No hardcoded options - use API only. */
  const FALLBACK_FIELD_METADATA = {};

  /**
   * Build metadata lookup from custom + native field lists.
   * @param {Array} customFields - from Encompass custom fields API
   * @param {Array} nativeFields - from Encompass native/standard fields API
   * @returns {Record<string, { dataType: string, format: string, description: string }>}
   */
  function buildFieldMetadataLookup(customFields, nativeFields) {
    const lookup = { ...FALLBACK_FIELD_METADATA };
    const add = (item) => {
      const id = item.fieldId ?? item.id ?? item.fieldName ?? item.name ?? '';
      const meta = {
        dataType: item.dataType || item.dataTypeName || item.valueType || '',
        format: item.format || item.formatType || item.displayFormat || '',
        description: item.description || item.longDescription || item.shortDescription || item.label || '',
      };
      const fmt = String(meta.format || '').toUpperCase();
      if ((fmt === 'DROPDOWNLIST' || fmt === 'DROPDOWN') && Array.isArray(item.options) && item.options.length > 0) {
        meta.options = item.options.map((o) => (o && typeof o === 'object' ? (o.value ?? o.key ?? o.label ?? String(o)) : String(o)));
      }
      const keys = [String(id).trim(), normalizeFieldIdForLookup(String(id))];
      keys.forEach((k) => { if (k) lookup[k] = meta; });
      if (item.contractPath) {
        const pathId = item.contractPath.split('.').pop();
        if (pathId && !lookup[pathId]) lookup[pathId] = meta;
      }
      if (typeof item.id === 'number') lookup[String(item.id)] = meta;
    };
    (customFields || []).forEach(add);
    (nativeFields || []).forEach(add);
    return lookup;
  }

  /**
   * Generate unit test rows from a custom field with a calculation.
   * @param {object} customField - { id, fieldId, calculation, calculationExpression, ... }
   * @param {object} [options] - optional { fieldMetadata: Record<fieldId, {dataType, format, description}> }
   * @returns {{ headers: string[], rows: object[], testDescriptions: object[], fieldMetadata?: object }|null}
   */
  function generateUnitTestFromCustomField(customField, options) {
    const fieldId =
      customField.fieldId ||
      customField.id ||
      customField.fieldName ||
      customField.name ||
      '';
    const calculation =
      customField.calculation ||
      customField.calculationExpression ||
      customField.calculatedExpression ||
      customField.expression ||
      customField.formula ||
      '';

    if (!calculation.trim()) return null;

    const parsed = parseCalculationFormula(calculation);
    if (!parsed) return null;

    const outputField = parsed.outputField;
    const inputFields = parsed.inputFields;
    const expression = parsed.expression;
    const outField = outputField || fieldId;
    if (!outField) return null;

    const fieldMetadata = (options && typeof options === 'object' && options.fieldMetadata) ? options.fieldMetadata : {};

    // 5 scenarios — leave values blank; user fills in 100% of the time
    const scenarioCount = 5;
    const headers = ['Step', 'Action', 'Target', 'Description', 'Test 1'];
    for (let i = 2; i <= scenarioCount; i++) {
      headers.push('Test ' + i);
    }

    const rows = [];
    let step = 1;

    const getMetaForField = (fid) => {
      const n = normalizeFieldIdForLookup(fid);
      const meta = fieldMetadata[n] || fieldMetadata[fid] || null;
      if (meta && meta.dataType) return meta;
      // Encompass typecasts: @ = date, # = number
      if (isDateFieldByNotation(fid)) {
        return { dataType: 'Date', format: '', description: 'Date field (from @ notation)' };
      }
      // Custom field naming: .DT, .date, .dttm suffix = date/dateTime
      const dateFromSuffix = inferDateTypeFromFieldId(n) || inferDateTypeFromFieldId(fid);
      if (dateFromSuffix) return dateFromSuffix;
      if (isNumberFieldByNotation(fid)) {
        return { dataType: 'Decimal', format: '', description: 'Number field (from # notation)' };
      }
      return meta;
    };

    // SET rows: all input fields first
    for (let k = 0; k < inputFields.length; k++) {
      const inputField = inputFields[k];
      const displayId = normalizeFieldIdForLookup(inputField);
      const meta = getMetaForField(inputField);
      const desc = 'Field ' + displayId;
      const setRow = {
        Step: step,
        Action: 'SET',
        Target: '[' + displayId + ']',
        Description: desc,
      };
      if (meta) setRow._fieldMetadata = meta;
      for (let idx = 0; idx < scenarioCount; idx++) {
        setRow['Test ' + (idx + 1)] = '';
      }
      rows.push(setRow);
      step++;
    }

    // GET rows: all input fields (corresponding to SETs above)
    for (let k = 0; k < inputFields.length; k++) {
      const inputField = inputFields[k];
      const displayId = normalizeFieldIdForLookup(inputField);
      const meta = getMetaForField(inputField);
      const desc = 'Field ' + displayId;
      const getRow = {
        Step: step,
        Action: 'GET',
        Target: '[' + displayId + ']',
        Description: desc,
      };
      if (meta) getRow._fieldMetadata = meta;
      for (let idx = 0; idx < scenarioCount; idx++) {
        getRow['Test ' + (idx + 1)] = '';
      }
      rows.push(getRow);
      step++;
    }

    // Placeholder row: Actual Results (display only, for readability)
    const actualResultsRow = { Step: '', Action: '', Target: '', Description: 'Actual Results' };
    for (let idx = 0; idx < scenarioCount; idx++) {
      actualResultsRow['Test ' + (idx + 1)] = '';
    }
    rows.push(actualResultsRow);

    // COMPARE row — blank expected values for user to fill
    const outDisplayId = normalizeFieldIdForLookup(outField);
    const outMeta = getMetaForField(outField);
    const compareDesc = 'Field ' + outDisplayId;
    const compareRow = {
      Step: step,
      Action: 'COMPARE',
      Target: '[' + outDisplayId + ']',
      Description: compareDesc,
    };
    if (outMeta) compareRow._fieldMetadata = outMeta;
    for (let idx = 0; idx < scenarioCount; idx++) {
      compareRow['Test ' + (idx + 1)] = '';
    }
    rows.push(compareRow);

    // Placeholder row: Overall Test Results (display only, for readability)
    const overallResultsRow = { Step: '', Action: '', Target: '', Description: 'Overall Test Results' };
    for (let idx = 0; idx < scenarioCount; idx++) {
      overallResultsRow['Test ' + (idx + 1)] = '';
    }
    rows.push(overallResultsRow);

    // EOF marker row (X in Step, Test Results in Description) for export
    const eofRow = {};
    headers.forEach((h) => { eofRow[h] = ''; });
    eofRow['Step'] = 'X';
    eofRow['Description'] = 'Test Results';
    rows.push(eofRow);

    const testDescriptions = Array.from({ length: scenarioCount }, function (_, idx) {
      return {
        testNumber: String(idx + 1),
        description: 'Scenario ' + (idx + 1),
      };
    });

    const result = {
      headers: headers,
      rows: rows,
      testDescriptions: testDescriptions,
    };
    if (Object.keys(fieldMetadata).length > 0) result.fieldMetadata = fieldMetadata;
    return result;
  }

  function getFallbackFieldMetadata() {
    return { ...FALLBACK_FIELD_METADATA };
  }

  global.customFieldCalcParser = {
    parseCalculationFormula: parseCalculationFormula,
    evaluateSimpleExpression: evaluateSimpleExpression,
    generateUnitTestFromCustomField: generateUnitTestFromCustomField,
    buildFieldMetadataLookup: buildFieldMetadataLookup,
    getFallbackFieldMetadata: getFallbackFieldMetadata,
    normalizeFieldIdForLookup: normalizeFieldIdForLookup,
    isDateFieldByNotation: isDateFieldByNotation,
    isNumberFieldByNotation: isNumberFieldByNotation,
    inferDateTypeFromFieldId: inferDateTypeFromFieldId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
