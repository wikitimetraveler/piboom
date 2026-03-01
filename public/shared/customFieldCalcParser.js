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
   * Generate unit test rows from a custom field with a calculation.
   * @param {object} customField - { id, fieldId, calculation, calculationExpression, ... }
   * @param {Array<Record<string, number|string>>} [scenarios] - optional array of input value maps for each scenario
   * @returns {{ headers: string[], rows: object[], testDescriptions: object[] }|null}
   */
  function generateUnitTestFromCustomField(customField, scenarios) {
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

    // 5 scenarios — leave values blank; user fills in 100% of the time
    const scenarioCount = 5;
    const headers = ['Step', 'Action', 'Target', 'Description', 'Test 1'];
    for (let i = 2; i <= scenarioCount; i++) {
      headers.push('Test ' + i);
    }

    const rows = [];
    let step = 1;

    // SET rows: one per input field — blank values for user to fill
    for (let k = 0; k < inputFields.length; k++) {
      const inputField = inputFields[k];
      const row = {
        Step: step,
        Action: 'SET',
        Target: '[' + inputField + ']',
        Description: 'Set input ' + inputField + ' for calculated field [' + outField + ']',
      };
      for (let idx = 0; idx < scenarioCount; idx++) {
        row['Test ' + (idx + 1)] = '';
      }
      rows.push(row);
      step++;
    }

    // COMPARE row — blank expected values for user to fill
    const compareRow = {
      Step: step,
      Action: 'COMPARE',
      Target: '[' + outField + ']',
      Description: 'Verify calculated result for [' + outField + '] = ' + expression,
    };
    for (let idx = 0; idx < scenarioCount; idx++) {
      compareRow['Test ' + (idx + 1)] = '';
    }
    rows.push(compareRow);

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

    return {
      headers: headers,
      rows: rows,
      testDescriptions: testDescriptions,
    };
  }

  global.customFieldCalcParser = {
    parseCalculationFormula: parseCalculationFormula,
    evaluateSimpleExpression: evaluateSimpleExpression,
    generateUnitTestFromCustomField: generateUnitTestFromCustomField,
  };
})(typeof window !== 'undefined' ? window : globalThis);
