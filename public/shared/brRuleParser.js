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

      // Main rule condition (gates when the rule applies)
      let mainCondition = null;
      const mainCondEl = doc.querySelector('Conditions > Condition[conditionTypeId="9"], Conditions > Condition[conditionType="Advanced Conditions"]');
      if (mainCondEl) {
        const condValue = mainCondEl.getAttribute('conditionValue') || mainCondEl.getAttribute('conditionValueId') || '';
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
          expression: condValue.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim(),
          fields,
        };
      }

      // Advanced conditions in MilestoneRequirements
      const advancedConditions = [];
      doc.querySelectorAll('MilestoneRequirements AdvancedConditions AdvancedCondition').forEach((ac) => {
        const valueEl = ac.querySelector('Value');
        const value = valueEl ? valueEl.textContent.trim() : '';
        const milestoneEl = ac.querySelector('AffectedMilestone XRef');
        const milestone = milestoneEl
          ? { entityId: milestoneEl.getAttribute('EntityID') || '', entityUid: milestoneEl.getAttribute('EntityUID') || '' }
          : null;
        const fields = [];
        ac.querySelectorAll('AffectedField XRef').forEach((xref) => {
          fields.push({
            entityId: xref.getAttribute('EntityID') || '',
            entityUid: xref.getAttribute('EntityUID') || '',
          });
        });
        advancedConditions.push({ value, milestone, fields });
      });

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
   * Generate unit test rows from parsed BR rule.
   * Creates SET rows for affected fields and COMPARE scenarios (pass/fail) per advanced condition.
   * @param {object} parsed - Result of parseBRXml
   * @returns {{ headers: string[], rows: object[], testDescriptions: object[] }|null}
   */
  function generateUnitTestFromBRRule(parsed) {
    if (!parsed || parsed.error) return null;
    const { rule, mainCondition, advancedConditions, requiredFields } = parsed;
    if (!advancedConditions || advancedConditions.length === 0) {
      return null;
    }

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
            Description: 'Rule condition: ' + (f.entityUid || f.entityId),
            'Test 1': '',
            'Test 2': '',
          });
        }
      });
    }

    // For each advanced condition: SET affected fields, then COMPARE
    advancedConditions.forEach((ac, idx) => {
      const condLabel = 'Advanced condition ' + (idx + 1);
      const milestoneLabel = ac.milestone ? ac.milestone.entityUid || ac.milestone.entityId : 'Milestone';

      ac.fields.forEach((f) => {
        if (f.entityId) {
          rows.push({
            Step: step++,
            Action: 'SET',
            Target: '[' + f.entityId + ']',
            Description: condLabel + ' @ ' + milestoneLabel + ': ' + (f.entityUid || f.entityId),
            'Test 1': 'Valid (pass)',
            'Test 2': 'Invalid (fail)',
          });
        }
      });

      rows.push({
        Step: step++,
        Action: 'COMPARE',
        Target: '[Log.MS.LastCompleted]',
        Description: condLabel + ' @ ' + milestoneLabel + ' – expect pass or block',
        'Test 1': 'Pass',
        'Test 2': 'Block/Fail',
      });
    });

    // Add required fields as SET rows
    if (requiredFields.length > 0) {
      requiredFields.forEach((rf) => {
        rows.push({
          Step: step++,
          Action: 'SET',
          Target: '[' + rf.fieldId + ']',
          Description: 'Required at ' + rf.milestone + ': ' + (rf.fieldUid || rf.fieldId),
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
    generateUnitTestFromBRRule,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.brRuleParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
