/**
 * Development work by David Lane
 */
/**
 * @deprecated Kept for backward compatibility only. New calculator HTML should use
 * static `.tool-pills` + `worksheets-shell.css` (same pattern as `unit-tests.html` / rollout calculators).
 */
(() => {
  const calculators = [
    { id: 'fha-streamline', label: 'FHA Streamline', href: 'fha-streamline-calculator.html', icon: 'bi-house-heart' },
    { id: 'fha-streamline-loan-amount', label: 'FHA Loan Amount', href: 'fha-streamline-loan-amount-calculator.html', icon: 'bi-cash-coin' },
    { id: 'fha-streamline-ntb', label: 'FHA NTB', href: 'fha-streamline-ntb-calculator.html', icon: 'bi-graph-up' },
    { id: 'asset-qualifier', label: 'Asset Qualifier', href: 'asset-qualifier-calculator.html', icon: 'bi-wallet2' },
    { id: 'cashout-refinance', label: 'Cash-Out', href: 'cashout-refinance-calculator.html', icon: 'bi-currency-dollar' },
    { id: 'dti', label: 'DTI', href: 'dti-calculator.html', icon: 'bi-percent' },
    { id: 'ltv', label: 'LTV', href: 'ltv-calculator.html', icon: 'bi-house-door' },
    { id: 'closing-cost', label: 'Closing Costs', href: 'closing-cost-calculator.html', icon: 'bi-receipt' },
    { id: 'amortization-schedule', label: 'Amortization', href: 'amortization-schedule-calculator.html', icon: 'bi-calendar' },
    { id: 'va-irrrl', label: 'VA IRRRL', href: 'va-irrrl-calculator.html', icon: 'bi-flag' },
  ];

  function injectStyles() {
    if (document.getElementById('calculator-pill-styles')) return;
    const style = document.createElement('style');
    style.id = 'calculator-pill-styles';
    style.textContent = `
      .calculator-pills {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 0.85rem 1rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .calculator-pills .nav { flex-wrap: wrap; }
      .calculator-pills .nav-link {
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        font-weight: 600;
        color: #1f2937;
        background: #f9fafb;
        padding: 0.4rem 0.95rem;
        margin: 0.2rem 0.35rem 0.2rem 0;
        transition: all 0.2s ease;
      }
      .calculator-pills .nav-link:hover {
        background: #e8f1ff;
        border-color: #2563eb;
        color: #2563eb;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        transform: translateY(-1px);
      }
      .calculator-pills .nav-link.active {
        background: #2563eb;
        border-color: #2563eb;
        color: #fff;
        box-shadow: 0 4px 10px rgba(37,99,235,0.25);
      }
      .calculator-pills .nav-link i { margin-right: 6px; }
    `;
    document.head.appendChild(style);
  }

  function renderPills() {
    const currentId = document.body?.dataset?.calculator || '';
    // Skip the pill menu on FHA Streamline to keep its custom layout clean
    if (currentId === 'fha-streamline') return;

    if (document.querySelector('.calculator-pills')) return;

    // Prefer explicit anchor if present, else fall back to the first container
    const anchor =
      document.querySelector('#calculatorPillsAnchor') ||
      document.querySelector('.calculator-pills-anchor') ||
      document.querySelector('.container');

    if (!anchor) return;

    injectStyles();

    const wrapper = document.createElement('div');
    wrapper.className = 'calculator-pills';
    wrapper.innerHTML = `
      <div class="d-flex align-items-center text-muted">
        <i class="bi-grid-3x3-gap-fill text-primary mr-2"></i>
        <span class="font-weight-bold">Switch calculators</span>
      </div>
    `;

    const ul = document.createElement('ul');
    ul.className = 'nav nav-pills';

    calculators.forEach(calc => {
      const li = document.createElement('li');
      li.className = 'nav-item';

      const a = document.createElement('a');
      a.className = 'nav-link';
      a.href = calc.href;
      a.innerHTML = `<i class="${calc.icon}"></i>${calc.label}`;

      if (calc.id === currentId) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }

      li.appendChild(a);
      ul.appendChild(li);
    });

    wrapper.appendChild(ul);
    anchor.prepend(wrapper);
  }

  const bootstrapRender = () => renderPills();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRender);
    window.addEventListener('load', bootstrapRender);
  } else {
    bootstrapRender();
  }
})();

