/**
 * Parse Encompass Business Rule (BR) XML and extract advanced conditions,
 * associated milestones, affected fields. Generate unit test rows from conditions.
 *
 * Supports MilestoneRules, LoanAccess, and similar RuleType.
 * @see docs/UNIT_TEST_LIBRARY.md
 */
(function (global) {
  'use strict';

  /**
   * Extract unique Encompass field ids from VB-style condition text (e.g. [16], [-ULDD.X160]).
   * @param {string} text
   * @returns {string[]}
   */
  function extractFieldIdsFromConditionText(text) {
    if (!text || typeof text !== 'string') return [];
    const fieldIdSet = new Set();
    const re = /\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const id = m[1].trim();
      if (id) fieldIdSet.add(id);
    }
    return [...fieldIdSet];
  }

  /**
   * Parse a pasted VB advanced condition (If/Then/Fail) without full BR XML.
   * Builds the same shape as parseBRXml for generateUnitTestFromBRRule.
   * Field list is inferred from [FieldId] references in the text.
   * @param {string} snippetText - Raw condition body (multi-line OK)
   * @returns {{ rule: object, mainCondition: object|null, advancedConditions: object[], requiredFields: object[], error?: string }}
   */
  function parseBRConditionSnippet(snippetText) {
    if (!snippetText || typeof snippetText !== 'string') {
      return { error: 'No condition text provided' };
    }
    const value = snippetText.trim();
    if (!value) return { error: 'Empty condition text' };

    const ids = extractFieldIdsFromConditionText(value);
    const fields = ids.map((entityId) => ({ entityId, entityUid: '' }));

    const rule = {
      id: '',
      name: 'Pasted VB condition',
      ruleType: 'MilestoneRules',
      status: '',
    };

    const advancedConditions = [
      {
        value,
        milestone: null,
        fields,
      },
    ];

    return {
      rule,
      mainCondition: null,
      advancedConditions,
      requiredFields: [],
    };
  }

  /**
   * Parse BR XML and extract all advanced conditions with milestones and fields.
   * @param {string} xmlText - Raw BR XML
   * @returns {{ rule: object, mainCondition: object|null, advancedConditions: object[], requiredFields: object[], error?: string }}
   */
  function parseBRXml(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') {
      return { error: 'No XML provided' };
    }
    const trimmed = xmlText.trim();
    if (!trimmed) return { error: 'Empty XML' };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'text/xml');
      if (doc.querySelector('parsererror')) {
        return { error: 'Invalid XML' };
      }

      const ruleEl = doc.querySelector('Rule');
      if (!ruleEl) return { error: 'No Rule element found' };

      const rule = {
        id: ruleEl.getAttribute('ID') || '',
        name: ruleEl.getAttribute('Name') || '',
        ruleType: ruleEl.getAttribute('RuleType') || '',
        status: ruleEl.getAttribute('Status') || '',
      };

      function decodeXmlAttr(s) {
        if (!s || typeof s !== 'string') return '';
        return s
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .trim();
      }

      // Main rule condition (gates when the rule applies)
      let mainCondition = null;
      let mainCondEl = doc.querySelector(
        'Conditions > Condition[conditionTypeId="9"], Conditions > Condition[conditionType="Advanced Conditions"]',
      );
      if (!mainCondEl) {
        doc.querySelectorAll('Conditions > Condition').forEach((c) => {
          if (mainCondEl) return;
          const raw = c.getAttribute('conditionValue') || c.getAttribute('conditionValueId') || '';
          const cv = decodeXmlAttr(raw);
          if (cv && (/\[/.test(cv) || /^\s*If\b/i.test(cv))) {
            mainCondEl = c;
          }
        });
      }
      if (mainCondEl) {
        const condValue =
          mainCondEl.getAttribute('conditionValue') || mainCondEl.getAttribute('conditionValueId') || '';
        const fields = [];
        mainCondEl.querySelectorAll('AdvancedCodeDependencies AffectedField, AffectedField').forEach((af) => {
          const xref = af.querySelector('XRef');
          if (xref) {
            fields.push({
              entityId: xref.getAttribute('EntityID') || '',
              entityUid: xref.getAttribute('EntityUID') || '',
            });
          }
        });
        mainCondition = {
          expression: decodeXmlAttr(condValue),
          fields,
        };
      }

      // Advanced conditions: standard path + any <AdvancedCondition> under Rule (namespaces / layout vary by export)
      const advancedConditions = [];
      const seenAdvanced = new WeakSet();

      function addAdvancedConditionNode(ac) {
        if (!ac || seenAdvanced.has(ac)) return;
        const valueEl = ac.querySelector('Value');
        const value = valueEl ? valueEl.textContent.trim() : '';
        const fields = [];
        ac.querySelectorAll('AffectedField XRef').forEach((xref) => {
          fields.push({
            entityId: xref.getAttribute('EntityID') || '',
            entityUid: xref.getAttribute('EntityUID') || '',
          });
        });
        if (!value && fields.length === 0) return;
        seenAdvanced.add(ac);
        const milestoneEl = ac.querySelector('AffectedMilestone XRef');
        const milestone = milestoneEl
          ? { entityId: milestoneEl.getAttribute('EntityID') || '', entityUid: milestoneEl.getAttribute('EntityUID') || '' }
          : null;
        advancedConditions.push({ value, milestone, fields });
      }

      doc.querySelectorAll('MilestoneRequirements AdvancedConditions AdvancedCondition').forEach(addAdvancedConditionNode);
      doc.querySelectorAll('Rule AdvancedCondition').forEach(addAdvancedConditionNode);

      // Still empty: derive one block from main advanced condition so "Create Test" works.
      // Clear mainCondition.fields afterward so generateUnitTestFromBRRule does not duplicate SET rows.
      if (advancedConditions.length === 0 && mainCondition) {
        const expr = mainCondition.expression || '';
        let fields = (mainCondition.fields || []).filter((f) => f && f.entityId);
        if (fields.length === 0 && expr) {
          fields = extractFieldIdsFromConditionText(expr).map((entityId) => ({
            entityId,
            entityUid: '',
          }));
        }
        if (expr || fields.length > 0) {
          advancedConditions.push({
            value: expr || 'Main rule condition',
            milestone: null,
            fields,
          });
          mainCondition = { expression: expr, fields: [] };
        }
      }

      // Required fields at milestones
      const requiredFields = [];
      doc.querySelectorAll('MilestoneRequirements RequiredFields RequiredField').forEach((rf) => {
        const msEl = rf.querySelector('AffectedMilestone XRef');
        const fEl = rf.querySelector('AffectedField XRef');
        if (msEl && fEl) {
          requiredFields.push({
            milestone: msEl.getAttribute('EntityUID') || '',
            fieldId: fEl.getAttribute('EntityID') || '',
            fieldUid: fEl.getAttribute('EntityUID') || '',
          });
        }
      });

      return { rule, mainCondition, advancedConditions, requiredFields };
    } catch (e) {
      return { error: e.message || 'Parse failed' };
    }
  }

  /**
   * @param {Record<string, {description?: string, dataType?: string, format?: string}>} [lookup]
   * @param {string} entityId
   * @returns {{description?: string, dataType?: string}|null}
   */
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
      const n2 = normFn(stripped);
      if (n2) keys.push(n2);
    }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k && lookup[k]) return lookup[k];
    }
    return null;
  }

  function sanitizeDescriptionText(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw)
      .replace(/\[(?=[^\]\s]*[A-Za-z0-9])[^\]\s]+\]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,;:.!?])/g, '$1')
      .trim();
  }

  /**
   * Human-readable field line for Description column (Encompass metadata optional).
   */
  function describeBrField(f, metaLookup) {
    const id = f.entityId;
    if (!id) return '';
    const meta = lookupFieldMeta(metaLookup, id);
    const apiDesc = sanitizeDescriptionText(
      meta && (meta.description || meta.longDescription || meta.shortDescription),
    );
    const fromXml = f.entityUid && String(f.entityUid).trim();
    const title = sanitizeDescriptionText((fromXml && fromXml !== id ? fromXml : null) || apiDesc || '');
    const typeHint = meta && meta.dataType ? String(meta.dataType).trim() : '';
    if (title && typeHint) return title + ' — ' + typeHint;
    if (title) return title;
    if (typeHint) return 'Field — ' + typeHint;
    return 'Field';
  }

  /**
   * Generate unit test rows from parsed BR rule.
   * Creates SET rows for affected fields and COMPARE scenarios (pass/fail) per advanced condition.
   * @param {object} parsed - Result of parseBRXml
   * @param {object} [options]
   * @param {Record<string, {description?: string, dataType?: string, format?: string}>} [options.fieldMetadataLookup] - from customFieldCalcParser.buildFieldMetadataLookup
   * @returns {{ headers: string[], rows: object[], testDescriptions: object[] }|null}
   */
  function generateUnitTestFromBRRule(parsed, options) {
    if (!parsed || parsed.error) return null;
    const { rule, mainCondition, advancedConditions, requiredFields } = parsed;
    if (!advancedConditions || advancedConditions.length === 0) {
      return null;
    }

    const metaLookup = (options && options.fieldMetadataLookup) || null;

    const headers = ['Step', 'Action', 'Target', 'Description', 'Test 1', 'Test 2'];
    const rows = [];
    const testDescriptions = [
      { scenario: 'Test 1', description: 'Pass: condition should not fail' },
      { scenario: 'Test 2', description: 'Fail: condition should fail (expect milestone block)' },
    ];

    let step = 1;

    // Optional: SET main condition fields if present
    if (mainCondition && mainCondition.fields && mainCondition.fields.length > 0) {
      mainCondition.fields.forEach((f) => {
        if (f.entityId) {
          rows.push({
            Step: step++,
            Action: 'SET',
            Target: '[' + f.entityId + ']',
            Description: 'Rule gate · ' + describeBrField(f, metaLookup),
            'Test 1': '',
            'Test 2': '',
          });
        }
      });
    }

    // For each advanced condition: SET affected fields, then COMPARE
    advancedConditions.forEach((ac, idx) => {
      const condLabel = 'Condition ' + (idx + 1);
      const hasMilestone = !!(ac.milestone && (ac.milestone.entityUid || ac.milestone.entityId));
      const milestoneName = hasMilestone
        ? (ac.milestone.entityUid || ac.milestone.entityId || '').trim()
        : '';

      ac.fields.forEach((f) => {
        if (f.entityId) {
          const fieldLine = describeBrField(f, metaLookup);
          let description;
          if (hasMilestone) {
            description = condLabel + ' @ milestone “' + milestoneName + '”: SET ' + fieldLine;
          } else {
            description = condLabel + ': SET ' + fieldLine + ' (valid vs invalid for rule pass/fail)';
          }
          rows.push({
            Step: step++,
            Action: 'SET',
            Target: '[' + f.entityId + ']',
            Description: description,
            'Test 1': 'Valid (pass)',
            'Test 2': 'Invalid (fail)',
          });
        }
      });

      let compareDesc;
      if (hasMilestone) {
        compareDesc =
          condLabel + ' @ “' + milestoneName + '” — COMPARE [Log.MS.LastCompleted] (pass vs blocked)';
      } else {
        compareDesc =
          condLabel + ' — COMPARE [Log.MS.LastCompleted] (rule passes vs milestone block)';
      }
      rows.push({
        Step: step++,
        Action: 'COMPARE',
        Target: '[Log.MS.LastCompleted]',
        Description: compareDesc,
        'Test 1': 'Pass',
        'Test 2': 'Block/Fail',
      });
    });

    // Add required fields as SET rows
    if (requiredFields.length > 0) {
      requiredFields.forEach((rf) => {
        const pseudo = { entityId: rf.fieldId, entityUid: rf.fieldUid || '' };
        rows.push({
          Step: step++,
          Action: 'SET',
          Target: '[' + rf.fieldId + ']',
          Description: 'Required at milestone “' + rf.milestone + '”: ' + describeBrField(pseudo, metaLookup),
          'Test 1': '',
          'Test 2': '',
        });
      });
    }

    if (rows.length === 0) return null;

    return {
      headers,
      rows,
      testDescriptions,
      rule,
      mainCondition,
      advancedConditions,
      requiredFields,
    };
  }

  const api = {
    parseBRXml,
    parseBRConditionSnippet,
    extractFieldIdsFromConditionText,
    generateUnitTestFromBRRule,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.brRuleParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
