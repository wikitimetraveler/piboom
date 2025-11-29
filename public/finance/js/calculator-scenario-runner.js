/**
 * Calculator Scenario Runner
 *
 * Injects a lightweight control panel so each calculator can quickly load
 * prebuilt Encompass sample loans (defined inside encompass-test-loans.js).
 * Selecting a scenario automatically populates the matching calculator inputs,
 * triggers existing change handlers, and surfaces any expected outputs so the
 * user can validate the math.
 */
(function () {
  const ready = document.readyState;
  if (ready === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  function initialize() {
    const body = document.body;
    if (!body) return;

    const calculatorType = body.dataset?.calculator;
    if (!calculatorType) return;

    const allScenarios =
      typeof ALL_SCENARIOS !== 'undefined' && Array.isArray(ALL_SCENARIOS)
        ? ALL_SCENARIOS
        : null;

    if (!allScenarios) {
      console.warn(
        `[scenario-runner] Missing ALL_SCENARIOS. Include js/encompass-test-loans.js before calculator-scenario-runner.js.`
      );
      return;
    }

    const scenarios = allScenarios.filter(
      (scenario) => scenario.calculator === calculatorType
    );

    if (!scenarios.length) {
      // Nothing to do for this calculator.
      return;
    }

    const host = document.querySelector('.container') || body;
    const panel = buildPanel(calculatorType, scenarios);
    const anchor = host.firstElementChild;

    if (anchor) {
      host.insertBefore(panel, anchor);
    } else {
      host.appendChild(panel);
    }
  }

  function buildPanel(calculatorType, scenarios) {
    const panel = document.createElement('div');
    panel.className = 'alert alert-secondary scenario-runner mb-4';
    panel.innerHTML = `
      <div class="d-flex flex-wrap align-items-center">
        <strong class="mr-2 mb-2 mb-md-0">Sample Loan Data</strong>
        <select class="custom-select custom-select-sm mr-2 mb-2 mb-md-0" data-scenario-select>
          <option value="">Select a scenario…</option>
        </select>
        <button type="button" class="btn btn-sm btn-primary mr-2 mb-2 mb-md-0" data-action="apply" disabled>Apply</button>
        <button type="button" class="btn btn-sm btn-outline-secondary mb-2 mb-md-0" data-action="clear">Clear</button>
      </div>
      <div class="mt-2 text-muted small" data-scenario-message>
        Use curated ${escapeHtml(
          calculatorType
        )} scenarios to populate every required field instantly.
      </div>
      <div class="mt-3 small" data-scenario-details></div>
    `;

    const select = panel.querySelector('[data-scenario-select]');
    const applyBtn = panel.querySelector('[data-action="apply"]');
    const clearBtn = panel.querySelector('[data-action="clear"]');
    const messageEl = panel.querySelector('[data-scenario-message]');
    const detailsEl = panel.querySelector('[data-scenario-details]');

    const scenarioMap = new Map();
    scenarios.forEach((scenario) => {
      const option = document.createElement('option');
      option.value = scenario.name;
      option.textContent = scenario.name;
      select.appendChild(option);
      scenarioMap.set(scenario.name, scenario);
    });

    let selectedScenario = null;

    select.addEventListener('change', () => {
      const value = select.value;
      selectedScenario = scenarioMap.get(value) || null;
      applyBtn.disabled = !selectedScenario;

      if (selectedScenario) {
        messageEl.textContent = `Ready to apply “${selectedScenario.name}”.`;
        detailsEl.innerHTML = renderScenarioDetails(selectedScenario, []);
      } else {
        resetPanelState(messageEl, detailsEl);
      }
    });

    applyBtn.addEventListener('click', () => {
      if (!selectedScenario) return;

      const result = applyScenarioToForm(selectedScenario);
      const statusParts = [`Applied ${result.applied}/${result.total} fields.`];

      if (result.missing.length) {
        statusParts.push(
          `Missing ${result.missing.length} field${result.missing.length === 1 ? '' : 's'} in the current layout.`
        );
      }

      messageEl.textContent = statusParts.join(' ');
      detailsEl.innerHTML = renderScenarioDetails(selectedScenario, result.missing);
      applyBtn.blur();
    });

    clearBtn.addEventListener('click', () => {
      select.value = '';
      selectedScenario = null;
      applyBtn.disabled = true;
      resetPanelState(messageEl, detailsEl);
      clearBtn.blur();
    });

    return panel;
  }

  function resetPanelState(messageEl, detailsEl) {
    messageEl.textContent =
      'Use curated scenarios to populate fields and verify calculator outputs.';
    detailsEl.innerHTML = '';
  }

  function applyScenarioToForm(scenario) {
    const inputs = scenario.inputs || {};
    const keys = Object.keys(inputs);
    const missing = [];
    let applied = 0;

    keys.forEach((fieldId) => {
      const element = document.getElementById(fieldId);
      if (!element) {
        missing.push(fieldId);
        return;
      }
      setElementValue(element, inputs[fieldId]);
      applied += 1;
    });

    return { applied, total: keys.length, missing };
  }

  function setElementValue(element, value) {
    const type = (element.type || '').toLowerCase();
    const isCheckbox = type === 'checkbox';
    const isRadio = type === 'radio';

    if (isCheckbox) {
      const normalized =
        typeof value === 'string'
          ? value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
          : Boolean(value);
      element.checked = normalized;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (isRadio) {
      const radios = document.querySelectorAll(`input[name="${element.name}"]`);
      radios.forEach((radio) => {
        radio.checked = radio.value === String(value);
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return;
    }

    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function renderScenarioDetails(scenario, missingFields) {
    const parts = [];

    if (scenario.description) {
      parts.push(`<div class="mb-1"><strong>Description:</strong> ${escapeHtml(scenario.description)}</div>`);
    }

    if (scenario.loanType) {
      parts.push(`<div class="mb-1"><strong>Loan Type:</strong> ${escapeHtml(scenario.loanType)}</div>`);
    }

    if (missingFields.length) {
      parts.push(
        `<div class="text-danger mb-2"><strong>Missing fields:</strong> ${missingFields
          .map((field) => `<code>${escapeHtml(field)}</code>`)
          .join(', ')}</div>`
      );
    }

    const expected = scenario.expectedResults || {};
    const expectedKeys = Object.keys(expected);
    if (expectedKeys.length) {
      const rows = expectedKeys
        .map(
          (field) =>
            `<li><code>${escapeHtml(field)}</code>: ${escapeHtml(formatValue(expected[field]))}</li>`
        )
        .join('');
      parts.push(`<div><strong>Expected results</strong><ul class="mb-0">${rows}</ul></div>`);
    } else {
      parts.push('<div class="text-muted">No expected results were defined for this scenario.</div>');
    }

    return parts.join('');
  }

  function formatValue(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value);
  }

  function escapeHtml(input) {
    return String(input).replace(/[&<>"]/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return char;
      }
    });
  }
})();


