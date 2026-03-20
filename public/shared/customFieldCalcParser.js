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

    // Pre-pass: resolve VB date functions (Month, Day, Year, Now, Today) while
    // field values are still date strings — must happen before numeric substitution.
    expr = evaluateDatePrePass(expr, values);

    // Replace each [fieldId] with the value (use getFieldValue for consistent lookup)
    const fieldRefs = [...expr.matchAll(/\[([^\]]+)\]/g)];
    for (let i = 0; i < fieldRefs.length; i++) {
      const m = fieldRefs[i];
      const fieldId = m[1].trim();
      const val = getFieldValue(fieldId, values);
      const num = val === '' || val === null || val === undefined
        ? 0
        : typeof val === 'number'
          ? val
          : Number(val);
      const replacement = Number.isFinite(num) ? String(num) : '0';
      expr = expr.replace(m[0], replacement);
    }

    // Preprocess Encompass built-in functions (Diff, Sum, Avg, Round, Abs, Max, Min)
    expr = preprocessEncompassFunctions(expr);

    // Sanitize: allow digits, arithmetic ops (including % from Mod), parens, and Math.* calls
    const sanitizeExpr = expr.replace(/\bMath\.(abs|max|min|round|pow|floor|ceil|sqrt|trunc)\b/g, '');
    if (!/^[\d\s+\-*/().%]+$/.test(sanitizeExpr)) {
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
   * Extract string comparisons [field] = "value" or [field] <> "value" from a condition.
   * @param {string} conditionString - e.g. '[19] = "NoCash-Out Refinance"' or '[TPO.X88] <> "Y"'
   * @returns {Array<{ fieldId: string, op: string, value: string }>}
   */
  function extractStringComparisons(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') return [];
    conditionString = normalizeConditionQuotes(conditionString);
    const results = [];
    const re = /\[([^\]]+)\]\s*(=|<>)\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(conditionString)) !== null) {
      results.push({ fieldId: m[1].trim(), op: m[2].trim(), value: m[3] });
    }
    return results;
  }

  /**
   * Split a condition by OrElse or Or at shallowest depth (respecting parens and quotes).
   * Encompass uses both "Or" and "OrElse"; treat them the same.
   * Matches flexible whitespace (including newlines) around Or/OrElse for Encompass-formatted expressions.
   * @param {string} condition - e.g. '([19] = "A" OrElse [19] = "B")' or '(A >= 2 Or B >= 2)'
   * @returns {string[]} - array of sub-conditions, or [condition] if no Or/OrElse
   */
  function splitOrElseBranches(condition) {
    if (!condition || typeof condition !== 'string') return [];
    const trimmed = condition.trim();
    if (!trimmed) return [];

    const andAlsoMatch = trimmed.match(/^(.+?)\s+(?:AndAlso|And)\s+(.+)$/i);
    let orGroup = trimmed;
    let suffix = '';
    if (andAlsoMatch) {
      orGroup = andAlsoMatch[1].trim();
      suffix = ' ' + (/AndAlso/i.test(trimmed) ? 'AndAlso' : 'And') + ' ' + andAlsoMatch[2].trim();
    }

    let minOrDepth = -1;
    const orElseRe = /^\s+OrElse\s+/i;
    const orOnlyRe = /^\s+Or\b\s*/i;
    let depth = 0;
    let inQuote = false;
    for (let i = 0; i < orGroup.length; i++) {
      const c = orGroup[i];
      if (c === '"' && (i === 0 || orGroup[i - 1] !== '\\')) inQuote = !inQuote;
      if (!inQuote) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else {
          const chunk = orGroup.substring(i);
          const matchOrElse = orElseRe.test(chunk);
          const matchOr = !matchOrElse && orOnlyRe.test(chunk);
          if ((matchOrElse || matchOr) && (minOrDepth < 0 || depth < minOrDepth)) {
            minOrDepth = depth;
          }
        }
      }
    }
    if (minOrDepth < 0) return [trimmed];

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
        const chunk = orGroup.substring(i);
        const orElseMatch = chunk.match(/^(\s+OrElse\s+)/i);
        const orMatch = !orElseMatch && chunk.match(/^(\s+Or\b\s*)/i);
        const match = orElseMatch || orMatch;
        if (depth === minOrDepth && match) {
          parts.push(current.trim());
          current = '';
          i += match[1].length;
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
    conditionString = normalizeConditionQuotes(conditionString);
    const results = [];

    // IsDate([field]) or Not IsDate([field]) — (Not\s+)? captures optional "Not "
    const isDateRe = /(Not\s+)?IsDate\s*\(\s*\[([^\]]+)\]\s*\)/gi;
    let m;
    while ((m = isDateRe.exec(conditionString)) !== null) {
      results.push({ type: 'isDate', fieldId: m[2].trim(), negated: !!m[1] });
    }

    // DateDiff("d"|'d', [field1], [field2]) op N — any interval letter(s); case-insensitive DateDiff
    const dateDiffRe = /DateDiff\s*\(\s*["']([^"']+)["']\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)/gi;
    while ((m = dateDiffRe.exec(conditionString)) !== null) {
      const value = parseFloat(m[5]);
      if (Number.isFinite(value)) {
        results.push({
          type: 'dateDiff',
          interval: String(m[1] || 'd').toLowerCase().trim(),
          field1: m[2].trim(),
          field2: m[3].trim(),
          op: m[4],
          value,
        });
      }
    }

    // [field].Contains("literal") or Not [field].Contains("literal") or Not([field].Contains("literal"))
    const containsRe = /(Not\s*\(?\s*)?\[([^\]]+)\]\.Contains\s*\(\s*"([^"]*)"\s*\)/gi;
    while ((m = containsRe.exec(conditionString)) !== null) {
      const hasNot = !!(m[1] && m[1].replace(/\s/g, '').toLowerCase().startsWith('not'));
      results.push({ type: 'contains', fieldId: m[2].trim(), substring: m[3], negated: hasNot });
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

    // IsEmpty([field]) / Not IsEmpty([field]) — VB empty/null check
    const isEmptyRe = /(Not\s+)?IsEmpty\s*\(\s*\[([^\]]+)\]\s*\)/gi;
    while ((m = isEmptyRe.exec(conditionString)) !== null) {
      results.push({ type: 'isEmpty', fieldId: m[2].trim(), negated: !!m[1] });
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
   * Extract field-to-field comparisons: [field1] op [field2].
   * Supports numeric, date, and string values — comparison type is inferred at runtime.
   * @param {string} conditionString - e.g. "[@L244] <> [@L245]"
   * @returns {Array<{ field1: string, op: string, field2: string }>}
   */
  function extractFieldToFieldComparisons(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') return [];
    const results = [];
    const re = /\[([^\]]+)\]\s*(<=|>=|<>|<|>|=)\s*\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(conditionString)) !== null) {
      results.push({ field1: m[1].trim(), op: m[2], field2: m[3].trim() });
    }
    return results;
  }

  /**
   * Extract arithmetic expression comparisons (expr) op N for suggested values.
   * Only matches when expr contains arithmetic operators (excludes DateDiff, IsDate, etc.).
   * When the whole condition is (expr) op N, capture the full expr so divide-by-12 and
   * other sub-expressions are included (e.g. (BR*12 sum) + ((BR*24 sum) / 12) >= 2).
   * @param {string} conditionString - e.g. "([#FR0112#2] + ([#FR0124#2] / 12)) >= 2"
   * @returns {Array<{ type: 'arithmetic', expr: string, op: string, value: number, fieldIds: string[] }>}
   */
  function extractArithmeticComparisons(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') return [];
    const results = [];
    const trimmed = conditionString.trim();
    // When the whole condition is (expr) op N with arithmetic, capture full expr first
    // so we get all field IDs including those in divide-by-12 sub-expressions
    const fullMatch = trimmed.match(/^\(\s*([\s\S]+)\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (fullMatch && /[+\-*\/]/.test(fullMatch[1]) && /\[[^\]]+\]/.test(fullMatch[1])) {
      const expr = fullMatch[1].trim();
      const value = parseFloat(fullMatch[3]);
      if (Number.isFinite(value)) {
        const fieldIds = [...expr.matchAll(/\[([^\]]+)\]/g)].map((f) => f[1].trim());
        results.push({ type: 'arithmetic', expr, op: fullMatch[2], value, fieldIds });
        return results;
      }
    }
    // Fallback: find inner (expr) op N patterns for non-wrapped conditions
    const re = /\(\s*([^()]*(?:\([^()]*\)[^()]*)*)\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(conditionString)) !== null) {
      const expr = m[1].trim();
      if (!/[+\-*\/]/.test(expr)) continue;
      const value = parseFloat(m[3]);
      if (Number.isFinite(value)) {
        const fieldIds = [...expr.matchAll(/\[([^\]]+)\]/g)].map((f) => f[1].trim());
        results.push({ type: 'arithmetic', expr, op: m[2], value, fieldIds });
      }
    }
    return results;
  }

  /**
   * Compute suggested test value for a comparison operator and target value (condition=true branch).
   * @param {string} op - comparison operator
   * @param {number} value - target value from condition
   * @returns {number}
   */
  function suggestedValueForOp(op, value) {
    const v = value;
    switch (op) {
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
   * Compute suggested test value from a numeric comparison (for condition=true branch).
   * @param {{ fieldId: string, op: string, value: number }} comp
   * @returns {number}
   */
  function suggestedValueForComparison(comp) {
    return suggestedValueForOp(comp.op, comp.value);
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
          if (isInInputFields(norm, inputFields)) {
            suggested[norm] = val;
          }
        }
        const nElseCycle = ['', 'N', 'Y'];
        const nVal = nElseCycle[scenarioIndex % 3];
        for (const norm of nFields) {
          if (isInInputFields(norm, inputFields)) {
            suggested[norm] = nVal;
          }
        }
        for (const norm of notNothingFields) {
          if (isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
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
      if (norm && isInInputFields(norm, inputFields)) {
        const val = suggestedValueForComparison(c);
        suggested[norm] = Number.isFinite(val) ? val : '';
      }
    }
    const arithComps = extractArithmeticComparisons(scenario.condition);
    for (let i = 0; i < arithComps.length; i++) {
      const ac = arithComps[i];
      for (let j = 0; j < ac.fieldIds.length; j++) {
        const fid = ac.fieldIds[j];
        const norm = normalizeFieldIdForLookup(fid);
        if (norm && isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
          suggested[norm] = (ac.op === '>=' || ac.op === '>') && j === 0 ? ac.value : 0;
        }
      }
    }
    const strComps = extractStringComparisons(scenario.condition);
    for (let i = 0; i < strComps.length; i++) {
      const sc = strComps[i];
      const norm = normalizeFieldIdForLookup(sc.fieldId);
      if (norm && isInInputFields(norm, inputFields)) {
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
        if (norm && isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
          suggested[norm] = cv.negated ? '' : '01/15/2025';
        }
      } else if (cv.type === 'contains') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
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
        if (norm && isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
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
        if (norm1 && isInInputFields(norm1, inputFields) && suggested[norm1] === undefined) {
          suggested[norm1] = sv.val1;
        }
        if (norm2 && isInInputFields(norm2, inputFields) && suggested[norm2] === undefined) {
          suggested[norm2] = sv.val2;
        }
      } else if (cv.type === 'nothing') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
          suggested[norm] = cv.negated ? 'Y' : '';
        }
      } else if (cv.type === 'isEmpty') {
        const norm = normalizeFieldIdForLookup(cv.fieldId);
        if (norm && isInInputFields(norm, inputFields) && suggested[norm] === undefined) {
          // IsEmpty condition true: suggest empty; Not IsEmpty: suggest a value
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
   * Optionally strip trailing #n (Encompass borrower pair suffix) for builder/live scenario.
   * @param {string} fieldId - e.g. "353", "@353", "#FR0112#2", "CX.TEST"
   * @param {{ stripBorrowerPair?: boolean }} [opts] - if true, strip trailing #1..#6 (borrower pair)
   * @returns {string}
   */
  function normalizeFieldIdForLookup(fieldId, opts) {
    if (!fieldId || typeof fieldId !== 'string') return '';
    let s = String(fieldId).trim().replace(/^[@#]+/, '');
    if (opts && opts.stripBorrowerPair) {
      s = s.replace(/#[1-6]$/, '');
    }
    return s;
  }

  /**
   * True if normalized field ID is in the input fields list.
   * @param {string} norm - normalized field ID
   * @param {string[]} inputFields - field IDs referenced in formula
   * @returns {boolean}
   */
  function isInInputFields(norm, inputFields) {
    if (!norm || !inputFields || !Array.isArray(inputFields)) return false;
    return inputFields.some((f) => normalizeFieldIdForLookup(f) === norm);
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
   * Extract positive numeric literals (not inside [...]) from an expression.
   * Used to seed suggested values for pure-calc (non-IIf) formulas.
   * @param {string} expression - e.g. "Diff([CX.BASELINELOCKEDAMT], 50000)"
   * @returns {number[]}
   */
  function extractNumericLiterals(expression) {
    if (!expression || typeof expression !== 'string') return [];
    const cleaned = expression.replace(/\[[^\]]+\]/g, '');
    const matches = cleaned.match(/\b\d+(?:\.\d+)?\b/g) || [];
    return matches.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  }

  /**
   * Pre-pass: resolve VB date-extraction functions BEFORE [field] refs are cast to numbers.
   * Must run while field values are still date strings.
   * Handles: Month(), Day(), Year(), Now(), Today() — including nested Month(Now()).
   * @param {string} expr - raw expression
   * @param {Record<string, string|number>} values - fieldId -> value
   * @returns {string} - expression with date functions replaced by their numeric results
   */
  function evaluateDatePrePass(expr, values) {
    if (!expr || typeof expr !== 'string') return expr;
    let e = expr;

    // Replace Now() and Today() with today's date string so Month(Now()) etc. resolve
    const todayStr = formatDateWithOffset(0);
    e = e.replace(/\bNow\s*\(\s*\)/gi, '"' + todayStr + '"');
    e = e.replace(/\bToday\s*\(\s*\)/gi, '"' + todayStr + '"');

    const resolveArg = (fieldId, literal) =>
      fieldId !== undefined ? String(getFieldValue(fieldId.trim(), values)) : (literal !== undefined ? literal : '');

    for (let pass = 0; pass < 3; pass++) {
      const prev = e;
      e = e.replace(/\bMonth\s*\(\s*(?:\[([^\]]+)\]|"([^"]*)")\s*\)/gi, (_, fid, lit) => {
        const d = new Date(resolveArg(fid, lit));
        return Number.isNaN(d.getTime()) ? '0' : String(d.getMonth() + 1);
      });
      e = e.replace(/\bDay\s*\(\s*(?:\[([^\]]+)\]|"([^"]*)")\s*\)/gi, (_, fid, lit) => {
        const d = new Date(resolveArg(fid, lit));
        return Number.isNaN(d.getTime()) ? '0' : String(d.getDate());
      });
      e = e.replace(/\bYear\s*\(\s*(?:\[([^\]]+)\]|"([^"]*)")\s*\)/gi, (_, fid, lit) => {
        const d = new Date(resolveArg(fid, lit));
        return Number.isNaN(d.getTime()) ? '0' : String(d.getFullYear());
      });
      if (e === prev) break;
    }
    return e;
  }

  /**
   * Preprocess Encompass/VB built-in function calls into JS equivalents.
   * Runs multiple passes to handle lightly-nested calls.
   * Numeric:  Diff, Abs, Max, Min, Round, Sum, Avg, Int, Fix, Sqr
   * Operator: VB Mod → JS %
   * @param {string} expr - expression (after [field] refs substituted with numbers)
   * @returns {string}
   */
  function preprocessEncompassFunctions(expr) {
    if (!expr || typeof expr !== 'string') return expr;
    let e = expr;
    for (let pass = 0; pass < 4; pass++) {
      const prev = e;
      // Numeric / math
      e = e.replace(/\bAbs\s*\(([^()]+)\)/gi, 'Math.abs($1)');
      e = e.replace(/\bMax\s*\(([^()]+)\)/gi, 'Math.max($1)');
      e = e.replace(/\bMin\s*\(([^()]+)\)/gi, 'Math.min($1)');
      e = e.replace(/\bSqr\s*\(([^()]+)\)/gi, 'Math.sqrt($1)');
      // VB Int(n) rounds toward -Infinity (same as Math.floor for positive numbers)
      e = e.replace(/\bInt\s*\(([^()]+)\)/gi, 'Math.floor($1)');
      // VB Fix(n) truncates toward zero
      e = e.replace(/\bFix\s*\(([^()]+)\)/gi, 'Math.trunc($1)');
      e = e.replace(/\bDiff\s*\(([^(),]+),\s*([^()]+)\)/gi, 'Math.abs(($1)-($2))');
      e = e.replace(/\bRound\s*\(([^(),]+),\s*([^()]+)\)/gi, '(Math.round(($1)*Math.pow(10,($2)))/Math.pow(10,($2)))');
      e = e.replace(/\bSum\s*\(([^()]+)\)/gi, (_, args) =>
        '(' + args.split(',').map((a) => '(' + a.trim() + ')').join('+') + ')'
      );
      e = e.replace(/\bAvg\s*\(([^()]+)\)/gi, (_, args) => {
        const parts = args.split(',');
        return '((' + parts.map((a) => '(' + a.trim() + ')').join('+') + ')/' + parts.length + ')';
      });
      // VB Mod operator → JS %
      e = e.replace(/\bMod\b/gi, '%');
      if (e === prev) break;
    }
    return e;
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
   * Extract the number of decimal places from an Encompass format string.
   * e.g. "#,##0.00" → 2, "#,##0.000%" → 3, "Percent" → 3, "#,##0" → 0, "" → null
   * @param {string} format
   * @returns {number|null} - decimal places, or null if format is unknown/not applicable
   */
  function getDecimalPlacesFromFormat(format) {
    if (!format || typeof format !== 'string') return null;
    const f = format.trim();
    if (/^percent$/i.test(f)) return 3;
    if (/^currency$/i.test(f)) return 2;
    const m = f.match(/0\.(\d+)%?$/);
    if (m) return m[1].length;
    if (/^#[,#0]+$/.test(f)) return 0;
    return null;
  }

  /**
   * True if a fieldMetadata dataType string represents a non-numeric type
   * (date, string, Y/N, boolean) that should not receive numeric pure-calc suggestions.
   * @param {string} dataType
   * @returns {boolean}
   */
  function isNonNumericDataType(dataType) {
    if (!dataType || typeof dataType !== 'string') return false;
    const t = dataType.toLowerCase().trim();
    return t === 'string' || t === 'date' || t === 'datetime' || t === 'yn' ||
           t === 'boolean' || t === 'yesno' || t === 'y/n';
  }

  /**
   * Build suggested input-value maps for a pure-calc (non-IIf) formula.
   * Uses numeric literals found in the expression as a base, then varies across scenarios.
   * Skips fields whose metadata declares a non-numeric type (Date, String, Y/N).
   * @param {string} expression - e.g. "Diff([CX.BASELINELOCKEDAMT], 50000)"
   * @param {string[]} inputFields - field IDs referenced in expression
   * @param {number} scenarioCount - number of test columns to generate
   * @param {Record<string, { dataType: string, format: string }>} [fieldMetadata]
   * @returns {Array<Record<string, number>>} - one value-map per scenario
   */
  function buildPureCalcSuggestions(expression, inputFields, scenarioCount, fieldMetadata) {
    const literals = extractNumericLiterals(expression);
    const multipliers = [1, 1.5, 0.5, 2, 0];
    const result = [];
    for (let idx = 0; idx < scenarioCount; idx++) {
      const m = multipliers[idx % multipliers.length];
      const vals = {};
      for (let k = 0; k < inputFields.length; k++) {
        const displayId = normalizeFieldIdForLookup(inputFields[k]);
        // Skip fields declared as non-numeric (date, string, Y/N, etc.)
        const meta = fieldMetadata && (fieldMetadata[displayId] || fieldMetadata[inputFields[k]]);
        if (meta && isNonNumericDataType(meta.dataType)) continue;
        // Also skip by notation — @ prefix means date field
        if (isDateFieldByNotation(inputFields[k])) continue;
        const base = literals.length > k ? literals[k] : (literals[0] || 100);
        vals[displayId] = Math.round(base * m * 100) / 100;
      }
      result.push(vals);
    }
    return result;
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

    // For pure-calc formulas (no IIf) that contain numeric literals (e.g. Diff([CX.X], 50000)),
    // seed suggested input values and auto-evaluate the COMPARE row.
    // Skip when no literals are found so date-field heuristics (CX.SUNRISE.*) still apply.
    const pureCalcSuggested = (!scenarios && inputFields.length > 0 && extractNumericLiterals(expression).length > 0)
      ? buildPureCalcSuggestions(expression, inputFields, scenarioCount, fieldMetadata)
      : null;
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

    // Track SET values per scenario so COMPARE can auto-evaluate for pure-calc formulas
    const scenarioInputValues = Array.from({ length: scenarioCount }, () => ({}));

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
        // Pure-calc numeric suggestions (e.g. Diff([CX.X], 50000))
        if ((val === undefined || val === '') && pureCalcSuggested && pureCalcSuggested[idx]) {
          const pcVal = pureCalcSuggested[idx][displayId];
          if (pcVal !== undefined) val = pcVal;
        }
        // Date suggestions: CX.SUNRISE.* fields
        if ((val === undefined || val === '') && isSunriseField(displayId)) {
          val = formatDateWithOffset(idx - Math.floor((scenarioCount - 1) / 2));
        }
        // Date suggestions: any @ date-notation field (e.g. @3570) used in Month/Day/Year calcs
        if ((val === undefined || val === '') && isDateFieldByNotation(inputField)) {
          val = formatDateWithOffset(idx - Math.floor((scenarioCount - 1) / 2));
        }
        const strVal = val !== undefined && val !== '' ? String(val) : '';
        setRow['Test ' + (idx + 1)] = strVal;
        // Track for COMPARE auto-evaluation
        if (strVal !== '') scenarioInputValues[idx][displayId] = strVal;
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
        // IIf scenario: use result field or literal
        const resultField = extractSingleResultField(s.result);
        const literalResult = extractLiteralResult(s.result);
        if (resultField && isInInputFields(resultField, inputFields)) {
          const suggestedMap = getSuggestedValuesForScenario(s, inputFields, { fieldMetadata, scenarioIndex: idx });
          const val = suggestedMap[resultField];
          suggested = val !== undefined && val !== '' ? String(val) : '';
        } else if (literalResult !== null) {
          suggested = literalResult;
        }
      } else if (!s && Object.keys(scenarioInputValues[idx]).length > 0) {
        // Pure-calc (no IIf): evaluate expression with tracked SET values.
        // Covers numeric calcs (Diff, Round, …) AND date-extraction calcs (Month, Day, Year).
        const evalResult = evaluateExpression(expression, scenarioInputValues[idx]);
        if (evalResult !== null && evalResult !== undefined) {
          const fmt = (outMeta && outMeta.format) || outMetaFromField.format || '';
          const dp = getDecimalPlacesFromFormat(fmt);
          const num = typeof evalResult === 'number' ? evalResult : parseFloat(String(evalResult));
          if (Number.isFinite(num) && dp !== null) {
            suggested = num.toFixed(dp);
          } else {
            suggested = String(evalResult);
          }
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

    const scenarioDescs = scenarios && scenarios.length > 0
      ? scenarios.slice(0, scenarioCount).map((s, idx) => ({
          testNumber: String(idx + 1),
          description: 'Scenario ' + (idx + 1)
        }))
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
   * Fallback: if not found, tries lookup with borrower pair suffix stripped (for builder/live).
   * @param {string} fieldId - e.g. "353", "@353", "#FR0112#2"
   * @param {Record<string, string|number>} values - fieldId -> value
   * @returns {string|number}
   */
  function getFieldValue(fieldId, values) {
    if (!values || typeof values !== 'object') return '';
    const raw = String(fieldId || '').trim();
    const norm = normalizeFieldIdForLookup(raw);
    let v = values[norm] ?? values[raw] ?? values[fieldId];
    if (v === undefined || v === '') {
      const normNoPair = normalizeFieldIdForLookup(raw, { stripBorrowerPair: true });
      if (normNoPair !== norm) v = values[normNoPair];
    }
    return v ?? '';
  }

  /**
   * Normalize curly/smart quotes to ASCII so regex extraction matches Excel/Word pastes.
   * @param {string} str
   * @returns {string}
   */
  function normalizeConditionQuotes(str) {
    if (!str || typeof str !== 'string') return str;
    return str
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  }

  /**
   * Parse flexible loan date values used by Scenario Builder and Encompass formulas.
   * Supports:
   * - MM/DD/YYYY
   * - MM/DD/YYYY HH:mm[:ss] [AM|PM]
   * - YYYY-MM-DD / YYYY-MM-DDTHH:mm[:ss]
   * - UI placeholders like "MM/DD/YYYY --:-- --" (treated as date-only)
   * @param {string|number|null|undefined} rawValue
   * @returns {Date|null}
   */
  function parseLoanDateValue(rawValue) {
    if (rawValue === null || rawValue === undefined) return null;
    let s = String(rawValue).trim();
    if (!s) return null;

    // Word/Excel often paste en/em dashes (– —) instead of hyphen-minus; breaks placeholder strip & ISO dates
    s = s.replace(/[\u2013\u2014]/g, '-');

    // Scenario Builder datetime placeholder (e.g. "01/01/2022 --:-- --")
    s = s.replace(/\s+--:--\s+--\s*$/i, '').trim();
    if (!s) return null;

    // ISO date-only from <input type="date"> should be local-midnight stable
    const isoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
      const y = parseInt(isoDateOnly[1], 10);
      const m = parseInt(isoDateOnly[2], 10) - 1;
      const d = parseInt(isoDateOnly[3], 10);
      const out = new Date(y, m, d, 0, 0, 0, 0);
      return Number.isNaN(out.getTime()) ? null : out;
    }

    // US format: MM/DD/YYYY with optional time
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (us) {
      const month = parseInt(us[1], 10) - 1;
      const day = parseInt(us[2], 10);
      const year = parseInt(us[3], 10);
      let hour = us[4] ? parseInt(us[4], 10) : 0;
      const minute = us[5] ? parseInt(us[5], 10) : 0;
      const second = us[6] ? parseInt(us[6], 10) : 0;
      const ampm = (us[7] || '').toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      const out = new Date(year, month, day, hour, minute, second, 0);
      return Number.isNaN(out.getTime()) ? null : out;
    }

    // Fallback to JS parser for ISO datetime and other valid formats
    const out = new Date(s);
    return Number.isNaN(out.getTime()) ? null : out;
  }

  /**
   * Evaluate an arithmetic expression with [field] refs, substituting values.
   * Used for conditions like ([#FR0112#2] + ([#FR0124#2] / 12)) >= 2.
   * @param {string} expr - e.g. "[#FR0112#2] + ([#FR0124#2] / 12)"
   * @param {Record<string, string|number>} values
   * @returns {number|null} - numeric result or null if invalid
   */
  function evaluateArithmeticInCondition(expr, values) {
    if (!expr || typeof expr !== 'string') return null;
    let e = expr.trim();
    if (!e) return null;
    const fieldRefs = [...e.matchAll(/\[([^\]]+)\]/g)];
    for (let i = 0; i < fieldRefs.length; i++) {
      const m = fieldRefs[i];
      const fieldId = m[1].trim();
      const val = getFieldValue(fieldId, values);
      const num = (val === '' || val === null || val === undefined)
        ? 0
        : typeof val === 'number' ? val : parseFloat(val);
      const replacement = Number.isFinite(num) ? String(num) : '0';
      e = e.replace(m[0], replacement);
    }
    if (!/^[\d\s+\-*/().]+$/.test(e)) return null;
    try {
      const result = Function('"use strict"; return (' + e + ')')();
      return typeof result === 'number' && Number.isFinite(result) ? result : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Apply numeric comparison operator (<=, >=, <, >, =, <>).
   * @param {string} op - comparison operator
   * @param {number} lhs - left-hand side value
   * @param {number} rhs - right-hand side value
   * @returns {boolean}
   */
  function applyNumericComparison(op, lhs, rhs) {
    switch (op) {
      case '<=': return lhs <= rhs;
      case '>=': return lhs >= rhs;
      case '<': return lhs < rhs;
      case '>': return lhs > rhs;
      case '=': return lhs === rhs;
      case '<>': return lhs !== rhs;
      default: return false;
    }
  }

  /**
   * Evaluate a single atomic condition (no AndAlso/OrElse).
   * @param {string} cond - e.g. "[353] <= 200", "([#FR0112#2] + ([#FR0124#2]/12)) >= 2"
   * @param {Record<string, string|number>} values
   * @returns {boolean}
   */
  function evaluateAtomicCondition(cond, values) {
    if (!cond || typeof cond !== 'string') return false;
    const c = cond.trim();
    if (!c) return false;

    // DateDiff("d", [a], [b]) op N — whole condition (IIf); must run before generic numeric compares
    const soloDiff = c.match(
      /^\s*DateDiff\s*\(\s*["']([^"']+)["']\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/i
    );
    if (soloDiff) {
      const interval = String(soloDiff[1] || 'd').toLowerCase().trim();
      const v1 = String(getFieldValue(soloDiff[2].trim(), values) ?? '');
      const v2 = String(getFieldValue(soloDiff[3].trim(), values) ?? '');
      const d1 = parseLoanDateValue(v1);
      const d2 = parseLoanDateValue(v2);
      if (!d1 || !d2) return false;
      const diff = computeDateDiffNumeric(interval, d1, d2);
      if (diff === null) return false;
      const target = parseFloat(soloDiff[5]);
      if (!Number.isFinite(target)) return false;
      return applyNumericComparison(soloDiff[4], diff, target);
    }

    // Arithmetic expression comparison: (expr) op number  OR  expr op number (e.g. (A) + (B) >= 2)
    // Use [\s\S] instead of . so newlines (Encompass paste) are matched
    const arithMatchParen = c.match(/^\(\s*([\s\S]+)\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (arithMatchParen) {
      const num = evaluateArithmeticInCondition(arithMatchParen[1].trim(), values);
      if (num === null) return false;
      const target = parseFloat(arithMatchParen[3]);
      if (!Number.isFinite(target)) return false;
      return applyNumericComparison(arithMatchParen[2], num, target);
    }
    const arithMatchNoParen = c.match(/^([\s\S]+)\s*(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (arithMatchNoParen && /[+\-*\/]/.test(arithMatchNoParen[1]) && /\[[^\]]+\]/.test(arithMatchNoParen[1])) {
      const num = evaluateArithmeticInCondition(arithMatchNoParen[1].trim(), values);
      if (num === null) return false;
      const target = parseFloat(arithMatchNoParen[3]);
      if (!Number.isFinite(target)) return false;
      return applyNumericComparison(arithMatchNoParen[2], num, target);
    }

    const comps = extractComparisonValues(c);
    if (comps.length > 0) {
      for (let i = 0; i < comps.length; i++) {
        const comp = comps[i];
        const val = getFieldValue(comp.fieldId, values);
        const num = (val === '' || val === null || val === undefined) ? 0 : (typeof val === 'number' ? val : parseFloat(val));
        const target = comp.value;
        if (!applyNumericComparison(comp.op, num, target)) return false;
      }
      return true;
    }

    // Field-to-field comparisons: [field1] op [field2]
    // (must come before string comparisons so date fields are handled correctly)
    const fieldComps = extractFieldToFieldComparisons(c);
    if (fieldComps.length > 0) {
      for (let i = 0; i < fieldComps.length; i++) {
        const fc = fieldComps[i];
        const raw1 = String(getFieldValue(fc.field1, values) ?? '').trim();
        const raw2 = String(getFieldValue(fc.field2, values) ?? '').trim();
        const n1 = parseFloat(raw1);
        const n2 = parseFloat(raw2);
        if (Number.isFinite(n1) && Number.isFinite(n2)) {
          if (!applyNumericComparison(fc.op, n1, n2)) return false;
        } else {
          // Try date comparison
          const d1 = new Date(raw1);
          const d2 = new Date(raw2);
          if (!Number.isNaN(d1.getTime()) && !Number.isNaN(d2.getTime())) {
            if (!applyNumericComparison(fc.op, d1.getTime(), d2.getTime())) return false;
          } else {
            // String comparison
            const cmp = raw1 < raw2 ? -1 : raw1 > raw2 ? 1 : 0;
            if (fc.op === '=' && cmp !== 0) return false;
            if (fc.op === '<>' && cmp === 0) return false;
            if (fc.op === '<' && cmp >= 0) return false;
            if (fc.op === '>' && cmp <= 0) return false;
            if (fc.op === '<=' && cmp > 0) return false;
            if (fc.op === '>=' && cmp < 0) return false;
          }
        }
      }
      return true;
    }

    const strComps = extractStringComparisons(c);
    if (strComps.length > 0) {
      for (let i = 0; i < strComps.length; i++) {
        const sc = strComps[i];
        const val = String(getFieldValue(sc.fieldId, values) ?? '').trim();
        const target = (sc.value ?? '').trim();
        const match = val === target;
        if (sc.op === '=' && !match) return false;
        if (sc.op === '<>' && match) return false;
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
        const raw = getFieldValue(cv.fieldId, values);
        const hay = String(raw ?? '').toLowerCase();
        const needle = String(cv.substring ?? '').toLowerCase();
        const hasSubstring = needle !== '' && hay.includes(needle);
        if (cv.negated ? hasSubstring : !hasSubstring) return false;
      } else if (cv.type === 'startsWith') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '').toLowerCase();
        const prefix = (cv.prefix ?? '').toLowerCase();
        if (!val.startsWith(prefix)) return false;
      } else if (cv.type === 'nothing') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '').trim();
        const isEmpty = val === '';
        if (cv.negated ? isEmpty : !isEmpty) return false;
      } else if (cv.type === 'isEmpty') {
        const val = String(getFieldValue(cv.fieldId, values) ?? '').trim();
        const empty = val === '';
        // IsEmpty → true when field is empty; Not IsEmpty → true when field has a value
        if (cv.negated ? empty : !empty) return false;
      } else if (cv.type === 'dateDiff') {
        const v1 = String(getFieldValue(cv.field1, values) ?? '');
        const v2 = String(getFieldValue(cv.field2, values) ?? '');
        const d1 = parseLoanDateValue(v1);
        const d2 = parseLoanDateValue(v2);
        if (!d1 || !d2) return false;
        const interval = (cv.interval || 'd').toLowerCase().trim();
        const diff = computeDateDiffNumeric(interval, d1, d2);
        if (diff === null) return false;
        if (!applyNumericComparison(cv.op, diff, cv.value)) return false;
      }
    }
    return condVals.length > 0 || (c === 'true' || c === 'True');
  }

  /**
   * Split a condition by top-level OrElse/Or (no AndAlso suffix redistribution).
   * Respects paren depth and quotes. Used for correct VB precedence in evaluation.
   * OrElse/Or has lower precedence than AndAlso/And.
   * @param {string} condition
   * @returns {string[]}
   */
  function splitTopLevelOrElse(condition) {
    if (!condition || typeof condition !== 'string') return [condition || ''];
    const str = condition.trim();
    if (!str) return [str];
    const orElseRe = /^\s+OrElse\s+/i;
    const orOnlyRe = /^\s+Or\b\s*/i;
    let minDepth = -1;
    let depth = 0;
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) inQuote = !inQuote;
      if (!inQuote) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else {
          const chunk = str.substring(i);
          const mo = orElseRe.test(chunk);
          const mo2 = !mo && orOnlyRe.test(chunk);
          if ((mo || mo2) && (minDepth < 0 || depth < minDepth)) minDepth = depth;
        }
      }
    }
    if (minDepth < 0) return [str];
    const parts = [];
    depth = 0; inQuote = false;
    let current = '';
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) { inQuote = !inQuote; current += ch; i++; continue; }
      if (!inQuote) {
        if (ch === '(') { depth++; current += ch; i++; continue; }
        if (ch === ')') { depth--; current += ch; i++; continue; }
        if (depth === minDepth) {
          const chunk = str.substring(i);
          const moe = chunk.match(/^(\s+OrElse\s+)/i);
          const mo = !moe && chunk.match(/^(\s+Or\b\s*)/i);
          const match = moe || mo;
          if (match) { parts.push(current.trim()); current = ''; i += match[1].length; continue; }
        }
      }
      current += ch; i++;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.length > 1 ? parts : [str];
  }

  /**
   * Split a condition by top-level AndAlso/And.
   * Respects paren depth and quotes. AndAlso has higher precedence than OrElse.
   * @param {string} condition
   * @returns {string[]}
   */
  function splitTopLevelAndAlso(condition) {
    if (!condition || typeof condition !== 'string') return [condition || ''];
    const str = condition.trim();
    if (!str) return [str];
    const andAlsoRe = /^\s+AndAlso\s+/i;
    const andOnlyRe = /^\s+And\b\s*/i;
    let minDepth = -1;
    let depth = 0;
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) inQuote = !inQuote;
      if (!inQuote) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else {
          const chunk = str.substring(i);
          const ma = andAlsoRe.test(chunk);
          const ma2 = !ma && andOnlyRe.test(chunk);
          if ((ma || ma2) && (minDepth < 0 || depth < minDepth)) minDepth = depth;
        }
      }
    }
    if (minDepth < 0) return [str];
    const parts = [];
    depth = 0; inQuote = false;
    let current = '';
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) { inQuote = !inQuote; current += ch; i++; continue; }
      if (!inQuote) {
        if (ch === '(') { depth++; current += ch; i++; continue; }
        if (ch === ')') { depth--; current += ch; i++; continue; }
        if (depth === minDepth) {
          const chunk = str.substring(i);
          const mae = chunk.match(/^(\s+AndAlso\s+)/i);
          const ma = !mae && chunk.match(/^(\s+And\b\s*)/i);
          const match = mae || ma;
          if (match) { parts.push(current.trim()); current = ''; i += match[1].length; continue; }
        }
      }
      current += ch; i++;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.length > 1 ? parts : [str];
  }

  /**
   * Find minimum depth at which OrElse/Or appears.
   * @param {string} str
   * @returns {number} -1 if not found
   */
  function minDepthOrElse(str) {
    let minDepth = -1;
    let depth = 0;
    let inQuote = false;
    const orElseRe = /^\s+OrElse\s+/i;
    const orOnlyRe = /^\s+Or\b\s*/i;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) inQuote = !inQuote;
      if (!inQuote) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else {
          const chunk = str.substring(i);
          if ((orElseRe.test(chunk) || orOnlyRe.test(chunk)) && (minDepth < 0 || depth < minDepth)) minDepth = depth;
        }
      }
    }
    return minDepth;
  }

  /**
   * Find minimum depth at which AndAlso/And appears.
   * @param {string} str
   * @returns {number} -1 if not found
   */
  function minDepthAndAlso(str) {
    let minDepth = -1;
    let depth = 0;
    let inQuote = false;
    const andAlsoRe = /^\s+AndAlso\s+/i;
    const andOnlyRe = /^\s+And\b\s*/i;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) inQuote = !inQuote;
      if (!inQuote) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else {
          const chunk = str.substring(i);
          if ((andAlsoRe.test(chunk) || andOnlyRe.test(chunk)) && (minDepth < 0 || depth < minDepth)) minDepth = depth;
        }
      }
    }
    return minDepth;
  }

  /**
   * Evaluate a full condition (supports AndAlso, OrElse) with correct VB precedence.
   * AndAlso/And binds tighter than OrElse/Or. Split by the operator at shallowest depth.
   * @param {string} condition - e.g. "[353] <= 200 AndAlso [19] = \"Y\""
   * @param {Record<string, string|number>} values
   * @returns {boolean}
   */
  function evaluateCondition(condition, values) {
    if (!condition || typeof condition !== 'string') return false;
    const c = normalizeConditionQuotes(condition).trim();
    if (!c) return false;

    const dOr = minDepthOrElse(c);
    const dAnd = minDepthAndAlso(c);

    // Split by the operator at shallowest depth (AndAlso has higher precedence)
    if (dAnd >= 0 && (dOr < 0 || dAnd <= dOr)) {
      const andParts = splitTopLevelAndAlso(c);
      if (andParts.length > 1) {
        return andParts.every((p) => evaluateCondition(p, values));
      }
    }
    if (dOr >= 0) {
      const orParts = splitTopLevelOrElse(c);
      if (orParts.length > 1) {
        return orParts.some((p) => evaluateCondition(p, values));
      }
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
   * Evaluate VB DateAdd(interval, number, date) — adds interval to date.
   * Supports: "d" day, "m" month, "y"/"yyyy" year, "h" hour, "n" minute, "s" second, "w" weekday, "ww" week.
   * @param {string} expr - e.g. 'DateAdd("m", 4, [@2336])'
   * @param {Record<string, string|number>} values
   * @returns {string|null} - formatted date string or null
   */
  function evaluateDateAdd(expr, values) {
    if (!expr || typeof expr !== 'string') return null;
    const trimmed = expr.trim();
    if (!/^DateAdd\s*\(/i.test(trimmed)) return null;
    const match = trimmed.match(
      /^DateAdd\s*\(\s*["']([^"']+)["']\s*,\s*(-?\d+)\s*,\s*(?:\[([^\]]+)\]|["']([^"']*)["'])\s*\)\s*$/i
    );
    if (!match) return null;
    const interval = (match[1] || '').toLowerCase();
    const number = parseInt(match[2], 10);
    const fieldId = match[3];
    const literal = match[4];
    const dateStr = fieldId !== undefined && fieldId !== ''
      ? String(getFieldValue(fieldId.trim(), values) ?? '')
      : (literal !== undefined ? literal : '');
    if (!dateStr.trim()) return null;
    const d = parseLoanDateValue(dateStr);
    if (!d) return null;
    switch (interval) {
      case 'yyyy':
      case 'y':
        d.setFullYear(d.getFullYear() + number);
        break;
      case 'm':
        d.setMonth(d.getMonth() + number);
        break;
      case 'd':
        d.setDate(d.getDate() + number);
        break;
      case 'ww':
        d.setDate(d.getDate() + (number * 7));
        break;
      case 'w':
        d.setDate(d.getDate() + number);
        break;
      case 'h':
        d.setHours(d.getHours() + number);
        break;
      case 'n':
        d.setMinutes(d.getMinutes() + number);
        break;
      case 's':
        d.setSeconds(d.getSeconds() + number);
        break;
      default:
        return null;
    }
    const hasTime = /:\d{2}\s*(?:AM|PM)?$/i.test(dateStr) || dateStr.includes(':');
    if (hasTime) {
      const h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ' ' + h12 + ':' + m + ' ' + ampm;
    }
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }

  /**
   * VB DateDiff interval count between two parsed dates (shared by evaluateDateDiff and IIf conditions).
   * @param {string} intervalRaw - e.g. "d", "m", "yyyy"
   * @param {Date} d1
   * @param {Date} d2
   * @returns {number|null}
   */
  function computeDateDiffNumeric(intervalRaw, d1, d2) {
    const interval = String(intervalRaw || 'd').toLowerCase().trim();
    if (!d1 || !d2 || Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
    switch (interval) {
      case 'd':
        return Math.floor((d2 - d1) / (24 * 60 * 60 * 1000));
      case 'ww':
        return Math.floor((d2 - d1) / (7 * 24 * 60 * 60 * 1000));
      case 'm':
        return ((d2.getFullYear() - d1.getFullYear()) * 12) + (d2.getMonth() - d1.getMonth());
      case 'yyyy':
      case 'y':
        return d2.getFullYear() - d1.getFullYear();
      case 'h':
        return Math.floor((d2 - d1) / (60 * 60 * 1000));
      case 'n':
        return Math.floor((d2 - d1) / (60 * 1000));
      case 's':
        return Math.floor((d2 - d1) / 1000);
      default:
        return null;
    }
  }

  /**
   * Evaluate VB DateDiff(interval, date1, date2) for direct expressions.
   * Returns the number of interval boundaries between two dates.
   * @param {string} expr - e.g. 'DateDiff("m", [682], [ULDD.X58])'
   * @param {Record<string, string|number>} values
   * @returns {number|null}
   */
  function evaluateDateDiff(expr, values) {
    if (!expr || typeof expr !== 'string') return null;
    const trimmed = expr.trim();
    if (!/^DateDiff\s*\(/i.test(trimmed)) return null;
    const match = trimmed.match(
      /^DateDiff\s*\(\s*["']([^"']+)["']\s*,\s*(?:\[([^\]]+)\]|["']([^"']*)["'])\s*,\s*(?:\[([^\]]+)\]|["']([^"']*)["'])\s*\)\s*$/i
    );
    if (!match) return null;

    const interval = (match[1] || '').toLowerCase().trim();
    const date1Raw = match[2] !== undefined && match[2] !== ''
      ? getFieldValue(match[2].trim(), values)
      : (match[3] !== undefined ? match[3] : '');
    const date2Raw = match[4] !== undefined && match[4] !== ''
      ? getFieldValue(match[4].trim(), values)
      : (match[5] !== undefined ? match[5] : '');

    const d1 = parseLoanDateValue(date1Raw);
    const d2 = parseLoanDateValue(date2Raw);
    if (!d1 || !d2) return null;
    return computeDateDiffNumeric(interval, d1, d2);
  }

  /**
   * Field IDs that appear as DateDiff date1/date2 in an expression (for Scenario Builder date inputs).
   * @param {string} expression
   * @returns {string[]} - normalized field IDs
   */
  function collectDateDiffFieldIdsFromExpression(expression) {
    if (!expression || typeof expression !== 'string') return [];
    const s = normalizeConditionQuotes(expression);
    const ids = new Set();
    const re = /DateDiff\s*\(\s*["'][^"']+["']\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*\)/gi;
    let m;
    while ((m = re.exec(s)) !== null) {
      ids.add(normalizeFieldIdForLookup(m[1].trim()));
      ids.add(normalizeFieldIdForLookup(m[2].trim()));
    }
    return [...ids];
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
    // Whole-formula normalize so IIf comma scanning, quoted literals, and & splits see ASCII ".
    const expr = normalizeConditionQuotes(expression).trim();
    if (!expr) return null;

    const dateAddResult = evaluateDateAdd(expr, values);
    if (dateAddResult !== null) return dateAddResult;

    const dateDiffResult = evaluateDateDiff(expr, values);
    if (dateDiffResult !== null) return dateDiffResult;

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
    preprocessEncompassFunctions: preprocessEncompassFunctions,
    extractNumericLiterals: extractNumericLiterals,
    evaluateDatePrePass: evaluateDatePrePass,
    extractFieldToFieldComparisons: extractFieldToFieldComparisons,
    splitTopLevelOrElse: splitTopLevelOrElse,
    splitTopLevelAndAlso: splitTopLevelAndAlso,
    getDecimalPlacesFromFormat: getDecimalPlacesFromFormat,
    isNonNumericDataType: isNonNumericDataType,
    splitByTopLevelAmpersand: splitByTopLevelAmpersand,
    parseIIfScenarios: parseIIfScenarios,
    parseAllIIfScenarios: parseAllIIfScenarios,
    expandOrElseScenarios: expandOrElseScenarios,
    extractComparisonValues: extractComparisonValues,
    extractArithmeticComparisons: extractArithmeticComparisons,
    extractConditionValues: extractConditionValues,
    extractStringComparisons: extractStringComparisons,
    getSuggestedValuesForScenario: getSuggestedValuesForScenario,
    evaluateSimpleExpression: evaluateSimpleExpression,
    evaluateExpression: evaluateExpression,
    evaluateCondition: evaluateCondition,
    evaluateArithmeticInCondition: evaluateArithmeticInCondition,
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
    computeDateDiffNumeric: computeDateDiffNumeric,
    collectDateDiffFieldIdsFromExpression: collectDateDiffFieldIdsFromExpression,
  };
})(typeof window !== 'undefined' ? window : globalThis);
