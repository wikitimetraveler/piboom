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
   * Split expression by top-level & (concatenation). Respects parens and quotes.
   * @param {string} expression - e.g. "IIf(A,\"x\",\"\") & IIf(B,\"y\",\"\")"
   * @returns {string[]} - trimmed segments
   */
  function splitByTopLevelAmpersand(expression) {
    if (!expression || typeof expression !== 'string') return [];
    const str = expression.trim();
    if (!str) return [];
    const segments = [];
    let depth = 0;
    let inQuote = false;
    let start = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '"' && (i === 0 || str[i - 1] !== '\\')) {
        inQuote = !inQuote;
        continue;
      }
      if (!inQuote) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === '&' && depth === 0) {
          segments.push(str.substring(start, i).trim());
          start = i + 1;
        }
      }
    }
    const last = str.substring(start).trim();
    if (last) segments.push(last);
    return segments;
  }

  /**
   * Parse nested IIf(condition, thenValue, elseValue) into an array of scenarios.
   * @param {string} expression - e.g. "IIf([#60#1] <= 200 And [#1452#1] <= 200, [#1415#1], IIf(...))"
   * @returns {Array<{ condition: string|null, result: string, isElse: boolean }>|null} - scenarios or null if no IIf
   */
  function parseIIfScenarios(expression) {
    if (!expression || typeof expression !== 'string') return null;
    const str = expression.trim();
    const iifMatch = str.match(/IIf\s*\(/i);
    if (!iifMatch) return null;

    const start = iifMatch.index + iifMatch[0].length;
    let depth = 1;
    let firstComma = -1;
    let secondComma = -1;
    let i = start;
    let inQuote = false;

    let closeParen = -1;
    while (i < str.length) {
      const c = str[i];
      if (c === '"' && (i === 0 || str[i - 1] !== '\\')) {
        inQuote = !inQuote;
        i++;
        continue;
      }
      if (!inQuote) {
        if (c === '(') {
          depth++;
        } else if (c === ')') {
          depth--;
          if (depth === 0) {
            closeParen = i;
            break;
          }
        } else if (c === ',' && depth === 1) {
          if (firstComma < 0) {
            firstComma = i;
          } else {
            secondComma = i;
          }
        }
      }
      i++;
    }

    if (firstComma < 0 || secondComma < 0 || closeParen < 0) return null;

    const condition = str.substring(start, firstComma).trim();
    const thenValue = str.substring(firstComma + 1, secondComma).trim();
    const elseValue = str.substring(secondComma + 1, closeParen).trim();

    const scenarios = [{ condition, result: thenValue, isElse: false }];

    if (/IIf\s*\(/i.test(elseValue)) {
      const rest = parseIIfScenarios(elseValue);
      if (rest) {
        scenarios.push(...rest);
      } else {
        scenarios.push({ condition: null, result: elseValue, isElse: true });
      }
    } else {
      scenarios.push({ condition: null, result: elseValue, isElse: true });
    }

    return scenarios;
  }

  /**
   * Parse all IIf blocks from a concatenated expression (A & B & C).
   * Merges scenarios from each IIf segment.
   * @param {string} expression - e.g. "IIf(A,\"x\",\"\") & IIf(B,\"y\",\"\")"
   * @returns {Array<{ condition: string|null, result: string, isElse: boolean }>|null} - merged scenarios or null if no IIf
   */
  function parseAllIIfScenarios(expression) {
    if (!expression || typeof expression !== 'string') return null;
    const str = expression.trim();
    if (!str) return null;
    if (!/IIf\s*\(/i.test(str)) return null;

    const segments = splitByTopLevelAmpersand(str);
    const allScenarios = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].trim();
      if (!seg) continue;
      const scenarios = parseIIfScenarios(seg);
      if (scenarios && scenarios.length > 0) {
        allScenarios.push(...scenarios);
      }
    }
    return allScenarios.length > 0 ? allScenarios : null;
  }

  /**
   * Extract string comparisons [field] = "value" from a condition for suggested test values.
   * @param {string} conditionString - e.g. '[19] = "NoCash-Out Refinance"'
   * @returns {Array<{ fieldId: string, op: string, value: string }>}
   */
  function extractStringComparisons(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') return [];
    const results = [];
    const re = /\[([^\]]+)\]\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(conditionString)) !== null) {
      results.push({ fieldId: m[1].trim(), op: '=', value: m[2] });
    }
    return results;
  }

  /**
   * Split a condition by OrElse at shallowest depth (respecting parens and quotes).
   * @param {string} condition - e.g. '([19] = "A" OrElse [19] = "B") AndAlso [299] = ""'
   * @returns {string[]} - array of sub-conditions, or [condition] if no OrElse
   */
  function splitOrElseBranches(condition) {
    if (!condition || typeof condition !== 'string') return [];
    const trimmed = condition.trim();
    if (!trimmed) return [];

    const andAlsoMatch = trimmed.match(/^(.+?)\s+AndAlso\s+(.+)$/);
    let orGroup = trimmed;
    let suffix = '';
    if (andAlsoMatch) {
      orGroup = andAlsoMatch[1].trim();
      suffix = ' AndAlso ' + andAlsoMatch[2].trim();
    }

    let minOrElseDepth = -1;
    const orElse = ' OrElse ';
    let depth = 0;
    let inQuote = false;
    for (let i = 0; i < orGroup.length; i++) {
      const c = orGroup[i];
      if (c === '"' && (i === 0 || orGroup[i - 1] !== '\\')) inQuote = !inQuote;
      if (!inQuote) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (orGroup.substring(i, i + orElse.length) === orElse && (minOrElseDepth < 0 || depth < minOrElseDepth)) {
          minOrElseDepth = depth;
        }
      }
    }
    if (minOrElseDepth < 0) return [trimmed];

    const parts = [];
    depth = 0;
    inQuote = false;
    let current = '';
    let i = 0;
    while (i < orGroup.length) {
      const c = orGroup[i];
      if (c === '"' && (i === 0 || orGroup[i - 1] !== '\\')) {
        inQuote = !inQuote;
        current += c;
        i++;
        continue;
      }
      if (!inQuote) {
        if (c === '(') {
          depth++;
          current += c;
          i++;
          continue;
        }
        if (c === ')') {
          depth--;
          current += c;
          i++;
          continue;
        }
        if (depth === minOrElseDepth && orGroup.substring(i, i + orElse.length) === orElse) {
          parts.push(current.trim());
          current = '';
          i += orElse.length;
          continue;
        }
      }
      current += c;
      i++;
    }
    if (current.trim()) parts.push(current.trim());

    if (parts.length <= 1) return [trimmed];
    return parts.map((p) => (suffix ? p + suffix : p));
  }

  /**
   * Expand scenarios: when a condition has OrElse, split into one scenario per branch.
   * @param {Array<{ condition: string|null, result: string, isElse: boolean }>} scenarios
   * @returns {Array<{ condition: string|null, result: string, isElse: boolean }>}
   */
  function expandOrElseScenarios(scenarios) {
    if (!scenarios || scenarios.length === 0) return scenarios;
    const expanded = [];
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      if (s.isElse || !s.condition) {
        expanded.push(s);
        continue;
      }
      const branches = splitOrElseBranches(s.condition);
      for (let j = 0; j < branches.length; j++) {
        expanded.push({
          condition: branches[j],
          result: s.result,
          isElse: false,
        });
      }
    }
    return expanded;
  }

  /**
   * Extract IsDate, DateDiff, Contains condition parts for scenario suggested values.
   * @param {string} conditionString - e.g. "Not IsDate([CX.DISASTER.DATE])" or "[19].Contains(\"Refi\")"
   * @returns {Array<{ type: string, fieldId?: string, field1?: string, field2?: string, op?: string, value?: number, substring?: string, negated?: boolean }>}
   */
  function extractConditionValues(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') return [];
    const results = [];

    // IsDate([field]) or Not IsDate([field]) — (Not\s+)? captures optional "Not "
    const isDateRe = /(Not\s+)?IsDate\s*\(\s*\[([^\]]+)\]\s*\)/gi;
    let m;
    while ((m = isDateRe.exec(conditionString)) !== null) {
      results.push({ type: 'isDate', fieldId: m[2].trim(), negated: !!m[1] });
    }

    // DateDiff("d", [field1], [field2]) op N
    const dateDiffRe = /DateDiff\s*\(\s*"d"\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+)/gi;
    while ((m = dateDiffRe.exec(conditionString)) !== null) {
      const value = parseInt(m[4], 10);
      if (Number.isFinite(value)) {
        results.push({
          type: 'dateDiff',
          field1: m[1].trim(),
          field2: m[2].trim(),
          op: m[3],
          value,
        });
      }
    }

    // [field].Contains("literal")
    const containsRe = /\[([^\]]+)\]\.Contains\s*\(\s*"([^"]*)"\s*\)/gi;
    while ((m = containsRe.exec(conditionString)) !== null) {
      results.push({ type: 'contains', fieldId: m[1].trim(), substring: m[2] });
    }

    // [field].StartsWith("literal")
    const startsWithRe = /\[([^\]]+)\]\.StartsWith\s*\(\s*"([^"]*)"\s*\)/gi;
    while ((m = startsWithRe.exec(conditionString)) !== null) {
      results.push({ type: 'startsWith', fieldId: m[1].trim(), prefix: m[2] });
    }

    // [field] <> Nothing or [field] = Nothing (VB null checks)
    const nothingRe = /\[([^\]]+)\]\s*(<>|=)\s*Nothing\b/gi;
    while ((m = nothingRe.exec(conditionString)) !== null) {
      const op = (m[2] || '').trim();
      results.push({
        type: 'nothing',
        fieldId: m[1].trim(),
        negated: op === '<>',
      });
    }

    return results;
  }

  /**
   * Extract numeric comparisons from a condition string for suggested test values.
   * @param {string} conditionString - e.g. "[#60#1] <= 200 And [#1452#1] <= 200"
   * @returns {Array<{ fieldId: string, op: string, value: number }>}
   */
  function extractComparisonValues(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') return [];
    const results = [];
    const re = /\[([^\]]+)\]\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(conditionString)) !== null) {
      const value = parseFloat(m[3]);
      if (Number.isFinite(value)) {
        results.push({ fieldId: m[1].trim(), op: m[2], value });
      }
    }
    return results;
  }

  /**
   * Compute suggested test value from a numeric comparison (for condition=true branch).
   * @param {{ fieldId: string, op: string, value: number }} comp
   * @returns {number}
   */
  function suggestedValueForComparison(comp) {
    const v = comp.value;
    switch (comp.op) {
      case '<=':
        return v > 100 ? Math.max(0, v - 100) : Math.floor(v / 2);
      case '>=':
        return v;
      case '<':
        return Math.max(0, v - 1);
      case '>':
        return v >= 0 ? v + 1 : v - 1;
      case '=':
        return v;
      case '<>':
        return v !== 0 ? 0 : 1;
      default:
        return v;
    }
  }

  /**
   * Get suggested value for a DateDiff condition (true branch).
   * DateDiff > 90: 105 days apart. DateDiff <= 90: within 90 days.
   * @param {{ field1: string, field2: string, op: string, value: number }} cond
   * @returns {{ field1: string, val1: string, field2: string, val2: string }}
   */
  function suggestedValuesForDateDiff(cond) {
    const n = cond.value;
    const op = cond.op;
    let d1 = '01/01/2025';
    let d2 = '01/02/2025'; // 1 day apart for <= / <
    if (op === '>' || op === '>=') {
      d2 = '04/15/2025'; // 105 days apart
    } else if (op === '<' || op === '<=') {
      d2 = n <= 1 ? '01/01/2025' : '01/02/2025';
    } else if (op === '=') {
      d2 = n <= 1 ? '01/01/2025' : '01/' + String(Math.min(1 + n, 28)).padStart(2, '0') + '/2025';
    } else if (op === '<>') {
      d2 = n === 0 ? '01/02/2025' : '01/01/2025';
    }
    return { field1: cond.field1, val1: d1, field2: cond.field2, val2: d2 };
  }

  /**
   * Collect field IDs that have [field] = "Y" or [field] = "N" or [field] <> Nothing in any scenario condition.
   * Used to suggest N/blank for else scenarios (condition false).
   */
  function collectYNAndNothingFieldsFromScenarios(scenarios) {
    const yFields = new Set();
    const nFields = new Set();
    const notNothingFields = new Set();
    if (!scenarios || !Array.isArray(scenarios)) return { yFields, nFields, notNothingFields };
    for (let i = 0; i < scenarios.length; i++) {
      const cond = scenarios[i] && scenarios[i].condition;
      if (!cond) continue;
      const strComps = extractStringComparisons(cond);
      for (let j = 0; j < strComps.length; j++) {
        const v = (strComps[j].value || '').toUpperCase();
        const norm = normalizeFieldIdForLookup(strComps[j].fieldId);
        if (norm) {
          if (v === 'Y') yFields.add(norm);
          else if (v === 'N') nFields.add(norm);
        }
      }
      const condVals = extractConditionValues(cond);
      for (let k = 0; k < condVals.length; k++) {
        if (condVals[k].type === 'nothing' && condVals[k].negated) {
          const norm = normalizeFieldIdForLookup(condVals[k].fieldId);
          if (norm) notNothingFields.add(norm);
        }
      }
    }
    return { yFields, nFields, notNothingFields };
  }

  /**
   * Get suggested input values for a scenario so the condition evaluates true.
   * @param {{ condition: string|null, result: string, isElse: boolean }} scenario
   * @param {string[]} inputFields - field IDs referenced in formula
   * @param {{ fieldMetadata?: Record<string, {options?: string[]}>, scenarioIndex?: number, allScenarios?: array }} [opts] - optional metadata and scenario index for dropdown/StartsWith
   * @returns {Record<string, string|number>} - normalized field ID -> suggested value
   */
  function getSuggestedValuesForScenario(scenario, inputFields, opts) {
    const suggested = {};
    const scenarioIndex = typeof (opts && opts.scenarioIndex) === 'number' ? opts.scenarioIndex : 0;
    const fieldMetadata = (opts && opts.fieldMetadata) || {};

    if (!scenario.condition) {
      if (scenario.isElse && opts && opts.allScenarios && opts.allScenarios.length > 0) {
        const { yFields, nFields, notNothingFields } = collectYNAndNothingFieldsFromScenarios(opts.allScenarios);
        const elseCycle = ['N', 'Y', ''];
        const val = elseCycle[scenarioIndex % 3];
        for (const norm of yFields) {
          if (inputFields.some((f) => normalizeFieldIdForLookup(f) === norm)) {
            suggested[norm] = val;
          }
        }
        const nElseCycle = ['', 'N', 'Y'];
        const nVal = nElseCycle[scenarioIndex % 3];
        for (const norm of nFields) {
          if (inputFields.some((f) => normalizeFieldIdForLookup(f) === norm)) {
            suggested[norm] = nVal;
          }
        }
        for (const norm of notNothingFields) {
          if (inputFields.some((f) => normalizeFieldIdForLookup(f) === norm) && suggested[norm] === undefined) {
            suggested[norm] = '';
          }
        }
      }
      return suggested;
    }

    const comps = extractComparisonValues(scenario.condition);
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      const norm = normalizeFieldIdForLookup(c.fieldId);
      if (norm && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm)) {
        const val = suggestedValueForComparison(c);
        suggested[norm] = Number.isFinite(val) ? val : '';
      }
    }
    const strComps = extractStringComparisons(scenario.condition);
    for (let i = 0; i < strComps.length; i++) {
      const sc = strComps[i];
      const norm = normalizeFieldIdForLookup(sc.fieldId);
      if (norm && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm)) {
        const val = (sc.value || '').toUpperCase();
        if (val === 'Y') {
          const yNEmpty = ['Y', 'N', ''];
          suggested[norm] = yNEmpty[scenarioIndex % 3];
        } else if (val === 'N') {
          const nYEmpty = ['N', 'Y', ''];
          suggested[norm] = nYEmpty[scenarioIndex % 3];
        } else {
          suggested[norm] = sc.value;
        }
      }
    }

    // Phase 2: IsDate, DateDiff, Contains
    const condValues = extractConditionValues(scenario.condition);
    for (let i = 0; i < condValues.length; i++) {
      const cv = condValues[i];
      if (cv.type === 'isDate') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm) && suggested[norm] === undefined) {
          suggested[norm] = cv.negated ? '' : '01/15/2025';
        }
      } else if (cv.type === 'contains') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm) && suggested[norm] === undefined) {
          const meta = fieldMetadata[norm] || fieldMetadata[cv.fieldId];
          const options = meta && Array.isArray(meta.options) ? meta.options : [];
          const substr = (cv.substring || '').toLowerCase();
          const matching = substr ? options.filter((o) => String(o).toLowerCase().includes(substr)) : options;
          if (matching.length > 0) {
            suggested[norm] = matching[scenarioIndex % matching.length];
          } else {
            suggested[norm] = cv.substring !== undefined && cv.substring !== '' ? cv.substring : 'Refi';
          }
        }
      } else if (cv.type === 'startsWith') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm) && suggested[norm] === undefined) {
          const meta = fieldMetadata[norm] || fieldMetadata[cv.fieldId];
          const options = meta && Array.isArray(meta.options) ? meta.options : [];
          const prefix = (cv.prefix || '').toLowerCase();
          const matching = prefix ? options.filter((o) => String(o).toLowerCase().startsWith(prefix)) : options;
          if (matching.length > 0) {
            suggested[norm] = matching[scenarioIndex % matching.length];
          } else {
            suggested[norm] = cv.prefix !== undefined && cv.prefix !== '' ? cv.prefix : '';
          }
        }
      } else if (cv.type === 'dateDiff') {
        const sv = suggestedValuesForDateDiff(cv);
        const norm1 = normalizeFieldIdForLookup(sv.field1);
        const norm2 = normalizeFieldIdForLookup(sv.field2);
        if (norm1 && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm1) && suggested[norm1] === undefined) {
          suggested[norm1] = sv.val1;
        }
        if (norm2 && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm2) && suggested[norm2] === undefined) {
          suggested[norm2] = sv.val2;
        }
      } else if (cv.type === 'nothing') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && inputFields.some((f) => normalizeFieldIdForLookup(f) === norm) && suggested[norm] === undefined) {
          suggested[norm] = cv.negated ? 'Y' : '';
        }
      }
    }
    return suggested;
  }

  /**
   * Extract single field ref from result if it is a pass-through (e.g. "[#1415#1]").
   * @param {string} result - e.g. "[#1415#1]" or "[4002] + [4003]"
   * @returns {string|null} - normalized field ID or null
   */
  function extractSingleResultField(result) {
    if (!result || typeof result !== 'string') return null;
    const m = result.trim().match(/^\[([^\]]+)\]$/);
    return m ? normalizeFieldIdForLookup(m[1]) : null;
  }

  /**
   * Extract literal string from result if it is a quoted string (e.g. "AltPropTax(F)" or "").
   * Used for COMPARE row expected values when output is String, not a pass-through.
   * @param {string} result - e.g. "\"AltPropTax(F)\"" or "\"\""
   * @returns {string|null} - unquoted string or null if not a quoted literal
   */
  function extractLiteralResult(result) {
    if (!result || typeof result !== 'string') return null;
    const m = result.trim().match(/^"([^"]*)"$/);
    return m ? m[1] : null;
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
   * Infer date/dateTime from custom field naming: .DT, .date, .dttm suffix, or CX.SUNRISE / CX.SUNRISE.* prefix.
   * @param {string} fieldId - e.g. "CX.CLOSING.DT", "FI.SOMEDATE", "CX.EVENT.dttm", "CX.SUNRISE", "CX.SUNRISE.DATE"
   * @returns {{ dataType: 'Date'|'DateTime' }|null}
   */
  function inferDateTypeFromFieldId(fieldId) {
    if (!fieldId || typeof fieldId !== 'string') return null;
    const s = String(fieldId).trim();
    const lower = s.toLowerCase();
    if (lower === 'cx.sunrise' || lower.startsWith('cx.sunrise.')) return { dataType: 'Date', format: '', description: 'Date field (CX.SUNRISE)' };
    if (lower.endsWith('.dttm')) return { dataType: 'DateTime', format: '', description: 'DateTime field (from .dttm suffix)' };
    if (lower.endsWith('.dt') || lower.endsWith('.date')) return { dataType: 'Date', format: '', description: 'Date field (from .DT/.date suffix)' };
    return null;
  }

  /**
   * True if field ID is CX.SUNRISE or CX.SUNRISE.* (always a date field).
   * @param {string} fieldId - e.g. "CX.SUNRISE", "CX.SUNRISE.DATE", "CX.SUNRISE.XXXX"
   * @returns {boolean}
   */
  function isSunriseField(fieldId) {
    if (!fieldId || typeof fieldId !== 'string') return false;
    const s = String(fieldId).trim().toLowerCase();
    return s === 'cx.sunrise' || s.startsWith('cx.sunrise.');
  }

  /**
   * Format date as MM/DD/YYYY with optional day offset from today.
   * @param {number} daysOffset - e.g. -2, 0, 2
   * @returns {string}
   */
  function formatDateWithOffset(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    return m + '/' + day + '/' + y;
  }

  /** Fallback metadata for widely used fields when not in API response. */
  const FALLBACK_FIELD_METADATA = {
    'CX.APPRAISAL.TYPE': {
      dataType: 'String',
      format: 'DROPDOWNLIST',
      description: 'Appraisal type',
      options: [
        'Appraisal Waived',
        'Appraisal Waived - Other',
        'Desktop Appraisal',
        'Full Appraisal',
        'Hybrid Appraisal',
        'Exterior-Only Inspection',
      ],
    },
    'CX.TYPE': {
      dataType: 'String',
      format: 'DROPDOWNLIST',
      description: 'Loan type',
      options: [
        'FHA',
        'FHA 203k',
        'FHA Streamline',
        'VA',
        'Conventional',
        'USDA',
        'Jumbo',
      ],
    },
  };

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

    const expression = parsed.expression;
    const outField = fieldId;
    if (!outField) return null;

    let inputFields = parsed.inputFields;
    const outNorm = normalizeFieldIdForLookup(outField);
    inputFields = inputFields.filter((f) => normalizeFieldIdForLookup(f) !== outNorm);

    const fieldMetadata = Object.assign(
      {},
      FALLBACK_FIELD_METADATA,
      (options && typeof options === 'object' && options.fieldMetadata) ? options.fieldMetadata : {}
    );

    // Ensure output field's dataType is in metadata from custom field definition (String, Decimal, Date, Y/N, etc.)
    const outMetaFromField = {
      dataType: customField.dataType || customField.dataTypeName || customField.valueType || customField.fieldType || '',
      format: customField.format || customField.formatType || customField.displayFormat || '',
      description: customField.description || customField.longDescription || customField.shortDescription || customField.label || '',
    };
    if (outMetaFromField.dataType || outMetaFromField.format || outMetaFromField.description) {
      const existing = fieldMetadata[outNorm] || fieldMetadata[outField] || {};
      fieldMetadata[outNorm] = {
        ...existing,
        dataType: outMetaFromField.dataType || existing.dataType,
        format: outMetaFromField.format || existing.format,
        description: outMetaFromField.description || existing.description,
      };
      fieldMetadata[outField] = fieldMetadata[outNorm];
    }

    let scenarios = parseAllIIfScenarios(expression);
    if (scenarios) scenarios = expandOrElseScenarios(scenarios);
    const maxScenarios = 20;
    const scenarioCount = Math.min(Math.max(5, (scenarios && scenarios.length) || 0), maxScenarios);
    const headers = ['Step', 'Action', 'Target', 'Description', 'Test 1'];
    for (let i = 2; i <= scenarioCount; i++) {
      headers.push('Test ' + i);
    }

    const rows = [];
    let step = 1;

    const getMetaForField = (fid) => {
      const n = normalizeFieldIdForLookup(fid);
      const meta = fieldMetadata[n] || fieldMetadata[fid] || FALLBACK_FIELD_METADATA[n] || FALLBACK_FIELD_METADATA[fid] || null;
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

    const scenarioList = scenarios ? scenarios.slice(0, scenarioCount) : [];

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
        const s = scenarioList[idx];
        const suggested = s ? getSuggestedValuesForScenario(s, inputFields, { fieldMetadata, scenarioIndex: idx, allScenarios: scenarioList }) : {};
        let val = suggested[displayId];
        if ((val === undefined || val === '') && isSunriseField(displayId)) {
          const daysOffset = idx - Math.floor((scenarioCount - 1) / 2);
          val = formatDateWithOffset(daysOffset);
        }
        setRow['Test ' + (idx + 1)] = val !== undefined && val !== '' ? String(val) : '';
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

    // COMPARE row — pre-fill when result is single field ref (pass-through)
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
      const s = scenarioList[idx];
      let suggested = '';
      if (s && s.result) {
        const resultField = extractSingleResultField(s.result);
        const literalResult = extractLiteralResult(s.result);
        if (resultField && inputFields.some((f) => normalizeFieldIdForLookup(f) === resultField)) {
          const suggestedMap = getSuggestedValuesForScenario(s, inputFields, { fieldMetadata, scenarioIndex: idx });
          const val = suggestedMap[resultField];
          suggested = val !== undefined && val !== '' ? String(val) : '';
        } else if (literalResult !== null) {
          // String/Date/Y-N literal result (e.g. "AltPropTax(F)" or "") — use as-is per output field dataType
          suggested = literalResult;
        }
      }
      compareRow['Test ' + (idx + 1)] = suggested;
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

    const maxDescLen = 80;
    const scenarioDescs = scenarios && scenarios.length > 0
      ? scenarios.slice(0, scenarioCount).map((s, idx) => {
          const cond = s.condition ? s.condition.trim() : 'else';
          const result = s.result ? s.result.trim() : '';
          let desc = s.isElse ? `else → ${result}` : `${cond} → ${result}`;
          if (desc.length > maxDescLen) desc = desc.substring(0, maxDescLen - 3) + '...';
          return { testNumber: String(idx + 1), description: desc };
        })
      : [];
    const testDescriptions = Array.from({ length: scenarioCount }, (_, idx) =>
      scenarioDescs[idx] || { testNumber: String(idx + 1), description: 'Scenario ' + (idx + 1) }
    );

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

  /**
   * Get value for a field from values map (supports normalized and raw IDs).
   * @param {string} fieldId - e.g. "353", "@353", "#4002"
   * @param {Record<string, string|number>} values - fieldId -> value
   * @returns {string|number}
   */
  function getFieldValue(fieldId, values) {
    if (!values || typeof values !== 'object') return '';
    const raw = String(fieldId || '').trim();
    const norm = normalizeFieldIdForLookup(raw);
    return values[norm] ?? values[raw] ?? values[fieldId] ?? '';
  }

  /**
   * Evaluate a single atomic condition (no AndAlso/OrElse).
   * @param {string} cond - e.g. "[353] <= 200", "[19] = \"Y\"", "IsDate([@CX.DT])"
   * @param {Record<string, string|number>} values
   * @returns {boolean}
   */
  function evaluateAtomicCondition(cond, values) {
    if (!cond || typeof cond !== 'string') return false;
    const c = cond.trim();
    if (!c) return false;

    const comps = extractComparisonValues(c);
    if (comps.length > 0) {
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        const val = getFieldValue(comp.fieldId, values);
        const num = (val === '' || val === null || val === undefined) ? 0 : (typeof val === 'number' ? val : parseFloat(val));
        const target = comp.value;
        let result = false;
        switch (comp.op) {
          case '<=': result = num <= target; break;
          case '>=': result = num >= target; break;
          case '<': result = num < target; break;
          case '>': result = num > target; break;
          case '=': result = num === target; break;
          case '<>': result = num !== target; break;
          default: result = false;
        }
        if (!result) return false;
      }
      return true;
    }

    const strComps = extractStringComparisons(c);
    if (strComps.length > 0) {
      for (let i = 0; i < strComps.length; i++) {
        const sc = strComps[i];
        const val = String(getFieldValue(sc.fieldId, values) ?? '').trim();
        const target = (sc.value ?? '').trim();
        if (val !== target) return false;
      }
      return true;
    }

    const condVals = extractConditionValues(c);
    for (let i = 0; i < condVals.length; i++) {
      const cv = condVals[i];
      if (cv.type === 'isDate') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '');
        const d = new Date(val);
        const valid = !Number.isNaN(d.getTime()) && val.trim() !== '';
        if (valid !== !cv.negated) return false;
      } else if (cv.type === 'contains') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '').toLowerCase();
        const sub = (cv.substring ?? '').toLowerCase();
        if (!val.includes(sub)) return false;
      } else if (cv.type === 'startsWith') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '').toLowerCase();
        const prefix = (cv.prefix ?? '').toLowerCase();
        if (!val.startsWith(prefix)) return false;
      } else if (cv.type === 'nothing') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '').trim();
        const isEmpty = val === '';
        if (cv.negated ? isEmpty : !isEmpty) return false;
      } else if (cv.type === 'dateDiff') {
        const v1 = String(getFieldValue(cv.field1, values) ?? '');
        const v2 = String(getFieldValue(cv.field2, values) ?? '');
        const d1 = new Date(v1);
        const d2 = new Date(v2);
        if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return false;
        const diff = Math.floor((d2 - d1) / (24 * 60 * 60 * 1000));
        let result = false;
        switch (cv.op) {
          case '<=': result = diff <= cv.value; break;
          case '>=': result = diff >= cv.value; break;
          case '<': result = diff < cv.value; break;
          case '>': result = diff > cv.value; break;
          case '=': result = diff === cv.value; break;
          case '<>': result = diff !== cv.value; break;
          default: result = false;
        }
        if (!result) return false;
      }
    }
    return condVals.length > 0 || (c === 'true' || c === 'True');
  }

  /**
   * Evaluate a full condition (supports AndAlso, OrElse).
   * @param {string} condition - e.g. "[353] <= 200 AndAlso [19] = \"Y\""
   * @param {Record<string, string|number>} values
   * @returns {boolean}
   */
  function evaluateCondition(condition, values) {
    if (!condition || typeof condition !== 'string') return false;
    const c = condition.trim();
    if (!c) return false;

    const orParts = splitOrElseBranches(c);
    if (orParts.length > 1) {
      return orParts.some((p) => evaluateCondition(p, values));
    }

    const andMatch = c.match(/^(.+?)\s+AndAlso\s+(.+)$/);
    if (andMatch) {
      return evaluateCondition(andMatch[1].trim(), values) && evaluateCondition(andMatch[2].trim(), values);
    }

    return evaluateAtomicCondition(c, values);
  }

  /**
   * Resolve a result segment: replace [field] with value, or return literal.
   * @param {string} result - e.g. "[#1415#1]" or "\"Y\"" or "123"
   * @param {Record<string, string|number>} values
   * @returns {string}
   */
  function resolveResultValue(result, values) {
    if (!result || typeof result !== 'string') return '';
    const r = result.trim();
    const quoted = r.match(/^"([^"]*)"$/);
    if (quoted) return quoted[1];
    const fieldRef = r.match(/^\[([^\]]+)\]$/);
    if (fieldRef) {
      const val = getFieldValue(fieldRef[1], values);
      return val === null || val === undefined ? '' : String(val);
    }
    return r;
  }

  /**
   * Evaluate a single IIf(cond, thenVal, elseVal) segment.
   * @param {string} segment - e.g. "IIf([353] <= 200, \"Y\", \"N\")"
   * @param {Record<string, string|number>} values
   * @returns {string}
   */
  function evaluateIIfSegment(segment, values) {
    if (!segment || typeof segment !== 'string') return '';
    const str = segment.trim();
    const iifMatch = str.match(/IIf\s*\(/i);
    if (!iifMatch) return resolveResultValue(str, values);

    const start = iifMatch.index + iifMatch[0].length;
    let depth = 1;
    let firstComma = -1;
    let secondComma = -1;
    let i = start;
    let inQuote = false;

    while (i < str.length) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) {
        inQuote = !inQuote;
        i++;
        continue;
      }
      if (!inQuote) {
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) break;
        } else if (ch === ',' && depth === 1) {
          if (firstComma < 0) firstComma = i;
          else secondComma = i;
        }
      }
      i++;
    }

    if (firstComma < 0 || secondComma < 0) return '';
    const condition = str.substring(start, firstComma).trim();
    const thenVal = str.substring(firstComma + 1, secondComma).trim();
    const elseVal = str.substring(secondComma + 1, i).trim();

    const condResult = evaluateCondition(condition, values);
    if (condResult) {
      if (/IIf\s*\(/i.test(thenVal)) return evaluateIIfSegment(thenVal, values);
      return resolveResultValue(thenVal, values);
    }
    if (/IIf\s*\(/i.test(elseVal)) return evaluateIIfSegment(elseVal, values);
    return resolveResultValue(elseVal, values);
  }

  /**
   * Evaluate an Encompass calculation expression (IIf or simple arithmetic).
   * @param {string} expression - e.g. "[4002] + [4003]" or "IIf([19] = \"Refi\", \"Y\", \"N\")"
   * @param {Record<string, string|number>} values - fieldId (normalized) -> value
   * @returns {string|number|null}
   */
  function evaluateExpression(expression, values) {
    values = values || {};
    if (!expression || typeof expression !== 'string') return null;
    const expr = expression.trim();
    if (!expr) return null;

    if (/IIf\s*\(/i.test(expr)) {
      const segments = splitByTopLevelAmpersand(expr);
      const parts = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i].trim();
        if (seg) parts.push(evaluateIIfSegment(seg, values));
      }
      return parts.join('');
    }

    return evaluateSimpleExpression(expr, values);
  }

  global.customFieldCalcParser = {
    parseCalculationFormula: parseCalculationFormula,
    splitByTopLevelAmpersand: splitByTopLevelAmpersand,
    parseIIfScenarios: parseIIfScenarios,
    parseAllIIfScenarios: parseAllIIfScenarios,
    expandOrElseScenarios: expandOrElseScenarios,
    extractComparisonValues: extractComparisonValues,
    extractConditionValues: extractConditionValues,
    extractStringComparisons: extractStringComparisons,
    getSuggestedValuesForScenario: getSuggestedValuesForScenario,
    evaluateSimpleExpression: evaluateSimpleExpression,
    evaluateExpression: evaluateExpression,
    evaluateCondition: evaluateCondition,
    getFieldValue: getFieldValue,
    generateUnitTestFromCustomField: generateUnitTestFromCustomField,
    buildFieldMetadataLookup: buildFieldMetadataLookup,
    getFallbackFieldMetadata: getFallbackFieldMetadata,
    normalizeFieldIdForLookup: normalizeFieldIdForLookup,
    isDateFieldByNotation: isDateFieldByNotation,
    isNumberFieldByNotation: isNumberFieldByNotation,
    inferDateTypeFromFieldId: inferDateTypeFromFieldId,
    isSunriseField: isSunriseField,
    formatDateWithOffset: formatDateWithOffset,
    extractSingleResultField: extractSingleResultField,
    extractLiteralResult: extractLiteralResult,
  };
})(typeof window !== 'undefined' ? window : globalThis);
