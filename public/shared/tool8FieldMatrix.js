/**
 * Development work by David Lane
 */
/**
 * Tool 8 (Alchemist) — field matrix JSON produced by transformXML().
 * Each row: { FieldID, Label, CType, Calendar, Method } optional Row for DataTables.
 * @see public/finance/js/tool8.js transformXML()
 */
(function (global) {
  'use strict';

  function stripBrackets(id) {
    if (id == null) return '';
    const s = String(id).trim();
    if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).trim();
    return s;
  }

  function ensureBrackets(fieldId) {
    const inner = stripBrackets(fieldId);
    return inner ? '[' + inner + ']' : '';
  }

  function lookupFieldMeta(lookup, entityId) {
    if (!lookup || !entityId) return null;
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    const normFn = g.customFieldCalcParser && g.customFieldCalcParser.normalizeFieldIdForLookup;
    const raw = String(entityId).trim();
    const stripped = raw.replace(/^[@#]+/, '');
    const keys = [raw, stripped];
    if (typeof normFn === 'function') {
      const n = normFn(raw);
      if (n) keys.push(n);
    }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k && lookup[k]) return lookup[k];
    }
    return null;
  }

  /**
   * @param {string} text - JSON string (array of objects)
   * @returns {{ error: string }|{ items: object[], fieldIds: string[] }}
   */
  function parseTool8FieldMatrixJson(text) {
    if (!text || typeof text !== 'string') {
      return { error: 'No JSON provided' };
    }
    const trimmed = text.trim();
    if (!trimmed) return { error: 'Empty JSON' };

    let data;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      return { error: 'Invalid JSON: ' + (e.message || 'parse error') };
    }

    if (!Array.isArray(data)) {
      return { error: 'Tool 8 export must be a JSON array of field rows' };
    }
    if (data.length === 0) {
      return { error: 'JSON array is empty' };
    }

    const items = [];
    const fieldIdSet = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return { error: 'Row ' + (i + 1) + ' must be an object' };
      }
      const raw = row.FieldID != null ? row.FieldID : row.fieldID != null ? row.fieldID : row.fieldId;
      if (raw == null || String(raw).trim() === '') {
        return { error: 'Row ' + (i + 1) + ' missing FieldID' };
      }
      const inner = stripBrackets(raw);
      if (!inner) return { error: 'Row ' + (i + 1) + ' has empty FieldID' };
      fieldIdSet.add(inner);

      items.push({
        FieldID: ensureBrackets(inner),
        Label: row.Label != null ? String(row.Label) : '',
        CType: row.CType != null ? String(row.CType) : '',
        Calendar: row.Calendar != null ? String(row.Calendar) : '',
        Method: row.Method != null ? String(row.Method) : '',
      });
    }

    return {
      items,
      fieldIds: [...fieldIdSet].sort(),
    };
  }

  /**
   * Build unit test grid rows from parsed Tool 8 matrix (SET per field).
   * @param {{ items: object[] }} parsed - from parseTool8FieldMatrixJson
   * @param {object} [options]
   * @param {Record<string, {description?: string, dataType?: string}>} [options.fieldMetadataLookup] - Encompass hub metadata (optional)
   * @returns {{ headers: string[], rows: object[], testDescriptions: object[] }|null}
   */
  function generateUnitTestFromTool8FieldMatrix(parsed, options) {
    if (!parsed || !parsed.items || parsed.items.length === 0) return null;

    const metaLookup = (options && options.fieldMetadataLookup) || null;

    const headers = ['Step', 'Action', 'Target', 'Description', 'Test 1', 'Test 2'];
    const rows = [];
    const testDescriptions = [
      { scenario: 'Test 1', description: 'Scenario 1 (Tool 8 matrix)' },
      { scenario: 'Test 2', description: 'Scenario 2 (Tool 8 matrix)' },
    ];

    let step = 1;
    parsed.items.forEach((item) => {
      const inner = stripBrackets(item.FieldID);
      const meta = metaLookup ? lookupFieldMeta(metaLookup, inner) : null;
      const apiLabel = meta && (meta.description || meta.longDescription || '');
      const label = String(item.Label || '').trim();
      const parts = [];
      if (label) parts.push(label);
      else if (apiLabel) parts.push(apiLabel);
      if (item.Method && String(item.Method).trim()) parts.push(String(item.Method).trim());
      if (item.CType && String(item.CType).trim()) parts.push('CType: ' + String(item.CType).trim());
      if (item.Calendar && String(item.Calendar).trim()) parts.push('Calendar: ' + String(item.Calendar).trim());
      if (meta && meta.dataType && !parts.some((p) => /Date|String|Decimal|Int/i.test(p))) {
        parts.push(String(meta.dataType).trim());
      }
      rows.push({
        Step: step++,
        Action: 'SET',
        Target: item.FieldID,
        Description: parts.length ? parts.join(' · ') : 'Tool 8 (Alchemist) · ' + item.FieldID,
        'Test 1': '',
        'Test 2': '',
      });
    });

    return { headers, rows, testDescriptions };
  }

  const api = {
    parseTool8FieldMatrixJson,
    generateUnitTestFromTool8FieldMatrix,
    stripBrackets,
    ensureBrackets,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.tool8FieldMatrix = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
