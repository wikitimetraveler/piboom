/**
 * Development work by David Lane
 * TPO Connect knowledge page — search/filter for LoanContractTPO + section helpers.
 */
(function () {
  'use strict';

  /** Properties from Elli.Api.Loans.Model.LoanContractTPO (ICE SDK bindings). */
  const LOAN_CONTRACT_TPO_FIELDS = [
    { name: 'SITEID', type: 'string', group: 'Site' },
    { name: 'RegisterDate', type: 'DateTime?', group: 'Lifecycle' },
    { name: 'SubmitDate', type: 'DateTime?', group: 'Lifecycle' },
    { name: 'InitialApplicationDate', type: 'DateTime?', group: 'Lifecycle' },
    { name: 'InitialSubmitDate', type: 'DateTime?', group: 'Lifecycle' },
    { name: 'DocumentsReadyDate', type: 'DateTime?', group: 'Lifecycle' },
    { name: 'ReadytoDiscloseDateUtc', type: 'DateTime?', group: 'Lifecycle' },
    { name: 'UnderwriterReviewed', type: 'bool?', group: 'Underwriting' },
    { name: 'UnderwritingDelegated', type: 'bool?', group: 'Underwriting' },
    { name: 'FeeReviewStatus', type: 'string', group: 'Fees' },
    { name: 'FeeReviewStatusDate', type: 'DateTime?', group: 'Fees' },
    { name: 'FeeReviewComments', type: 'string', group: 'Fees' },
    { name: 'LEIssuedBy', type: 'string', group: 'Fees' },
    { name: 'Archived', type: 'bool?', group: 'Flags' },
    { name: 'ImportSource', type: 'string', group: 'Flags' },
    { name: 'TestAccountField', type: 'bool?', group: 'Flags' },
    { name: 'WatchListFlag', type: 'bool?', group: 'Flags' },
    { name: 'WatchListReason', type: 'string', group: 'Flags' },
    { name: 'PurchaseStipsReviewed', type: 'bool?', group: 'Purchase' },
    { name: 'PurchaseStipsReadyDate', type: 'DateTime?', group: 'Purchase' },
    { name: 'CompanyName', type: 'string', group: 'Company' },
    { name: 'CompanyID', type: 'string', group: 'Company' },
    { name: 'CompanyOrganizationID', type: 'string', group: 'Company' },
    { name: 'CompanyLegalName', type: 'string', group: 'Company' },
    { name: 'CompanyAddress', type: 'string', group: 'Company' },
    { name: 'CompanyCity', type: 'string', group: 'Company' },
    { name: 'CompanyState', type: 'string', group: 'Company' },
    { name: 'CompanyZip', type: 'string', group: 'Company' },
    { name: 'CompanyPhone', type: 'string', group: 'Company' },
    { name: 'CompanyFax', type: 'string', group: 'Company' },
    { name: 'CompanyDBAName', type: 'string', group: 'Company' },
    { name: 'CompanyRating', type: 'string', group: 'Company' },
    { name: 'CompanyManagerName', type: 'string', group: 'Company' },
    { name: 'CompanyManagerEmail', type: 'string', group: 'Company' },
    { name: 'CompanyAEName', type: 'string', group: 'Company' },
    { name: 'CompanyAEUserName', type: 'string', group: 'Company' },
    { name: 'BranchName', type: 'string', group: 'Branch' },
    { name: 'BranchID', type: 'string', group: 'Branch' },
    { name: 'BranchOrganizationID', type: 'string', group: 'Branch' },
    { name: 'BranchLegalName', type: 'string', group: 'Branch' },
    { name: 'BranchAddress', type: 'string', group: 'Branch' },
    { name: 'BranchCity', type: 'string', group: 'Branch' },
    { name: 'BranchState', type: 'string', group: 'Branch' },
    { name: 'BranchZip', type: 'string', group: 'Branch' },
    { name: 'BranchPhone', type: 'string', group: 'Branch' },
    { name: 'BranchFax', type: 'string', group: 'Branch' },
    { name: 'BranchDBAName', type: 'string', group: 'Branch' },
    { name: 'BranchRating', type: 'string', group: 'Branch' },
    { name: 'BranchManagerName', type: 'string', group: 'Branch' },
    { name: 'BranchManagerEmail', type: 'string', group: 'Branch' },
    { name: 'BranchAEName', type: 'string', group: 'Branch' },
    { name: 'BranchAEUserName', type: 'string', group: 'Branch' },
    { name: 'LOName', type: 'string', group: 'Loan Officer' },
    { name: 'LOID', type: 'string', group: 'Loan Officer' },
    { name: 'LOEmail', type: 'string', group: 'Loan Officer' },
    { name: 'LOStatus', type: 'string', group: 'Loan Officer' },
    { name: 'LOBusinessPhone', type: 'string', group: 'Loan Officer' },
    { name: 'LOBusinessFax', type: 'string', group: 'Loan Officer' },
    { name: 'LOCellPhone', type: 'string', group: 'Loan Officer' },
    { name: 'LOAddress', type: 'string', group: 'Loan Officer' },
    { name: 'LOCity', type: 'string', group: 'Loan Officer' },
    { name: 'LOState', type: 'string', group: 'Loan Officer' },
    { name: 'LOZip', type: 'string', group: 'Loan Officer' },
    { name: 'LONotes', type: 'string', group: 'Loan Officer' },
    { name: 'LOAEName', type: 'string', group: 'Loan Officer' },
    { name: 'LOAEUserName', type: 'string', group: 'Loan Officer' },
    { name: 'LPName', type: 'string', group: 'Loan Processor' },
    { name: 'LPID', type: 'string', group: 'Loan Processor' },
    { name: 'LPEmail', type: 'string', group: 'Loan Processor' },
    { name: 'LPStatus', type: 'string', group: 'Loan Processor' },
    { name: 'LPBusinessPhone', type: 'string', group: 'Loan Processor' },
    { name: 'LPBusinessFax', type: 'string', group: 'Loan Processor' },
    { name: 'LPCellPhone', type: 'string', group: 'Loan Processor' },
    { name: 'LPAddress', type: 'string', group: 'Loan Processor' },
    { name: 'LPCity', type: 'string', group: 'Loan Processor' },
    { name: 'LPState', type: 'string', group: 'Loan Processor' },
    { name: 'LPZip', type: 'string', group: 'Loan Processor' },
    { name: 'LPNotes', type: 'string', group: 'Loan Processor' },
    { name: 'LPAEName', type: 'string', group: 'Loan Processor' },
    { name: 'LPAEUserName', type: 'string', group: 'Loan Processor' },
    { name: 'CFCName', type: 'string', group: 'CFC' },
    { name: 'CFCUserID', type: 'string', group: 'CFC' },
    { name: 'CFCEmail', type: 'string', group: 'CFC' },
    { name: 'CFCStatus', type: 'string', group: 'CFC' },
    { name: 'CFCBusinessPhone', type: 'string', group: 'CFC' },
    { name: 'CFCBusinessFax', type: 'string', group: 'CFC' },
    { name: 'CFCCellPhone', type: 'string', group: 'CFC' },
    { name: 'CFCAddress', type: 'string', group: 'CFC' },
    { name: 'CFCCity', type: 'string', group: 'CFC' },
    { name: 'CFCState', type: 'string', group: 'CFC' },
    { name: 'CFCZip', type: 'string', group: 'CFC' },
    { name: 'CFCNotes', type: 'string', group: 'CFC' },
    { name: 'CFCRepAE', type: 'string', group: 'CFC' },
    { name: 'CFCSRAEUserName', type: 'string', group: 'CFC' },
  ];

  /**
   * TPO-related requests from ICE Encompass Developer Connect Postman collection
   * (knowledge-sources/ice/postman/). Prefer /settings/externalOrganizations paths;
   * legacy /externalOrganizations/tpos routes are marked deprecated in the collection.
   */
  const POSTMAN_APIS = [
    {
      group: 'External organizations',
      method: 'GET',
      name: 'Get List of External Orgs',
      path: '/encompass/v3/settings/externalOrganizations/tpos',
    },
    {
      group: 'External organizations',
      method: 'GET',
      name: 'Get Specific External Org',
      path: '/encompass/v3/settings/externalOrganizations/tpos/{{tpoOrgId}}',
    },
    {
      group: 'External organizations',
      method: 'POST',
      name: 'Create External Org',
      path: '/encompass/v3/settings/externalOrganizations/tpos',
    },
    {
      group: 'External organizations',
      method: 'PATCH',
      name: 'Update External Org',
      path: '/encompass/v3/settings/externalOrganizations/tpos/{{tpoOrgId}}',
    },
    {
      group: 'External organizations',
      method: 'GET',
      name: 'List External Orgs (legacy — slated for deprecation)',
      path: '/encompass/v3/externalOrganizations/tpos',
    },
    {
      group: 'External organizations',
      method: 'GET',
      name: 'Get External Org (legacy — slated for deprecation)',
      path: '/encompass/v3/externalOrganizations/tpos/{{tpoOrgId}}',
    },
    {
      group: 'DBA / warehouse',
      method: 'PATCH',
      name: 'Add / Update / ReOrder / Delete DBA',
      path: '/encompass/v3/settings/externalOrganizations/tpos/{{tpoOrgId}}/dbas',
    },
    {
      group: 'DBA / warehouse',
      method: 'PATCH',
      name: 'Add / Update / Delete Warehouse',
      path: '/encompass/v3/settings/externalOrganizations/tpos/{{tpoOrgId}}/warehouses',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'Company Status',
      path: '/encompass/v3/settings/externalOrganizations/tpoSettings/companyStatus',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'Company Rating',
      path: '/encompass/v3/settings/externalOrganizations/tpoSettings/companyRating',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'Product and Pricing (PriceGroup)',
      path: '/encompass/v3/settings/externalOrganizations/tpoSettings/PriceGroup',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'External Banks',
      path: '/encompass/v3/settings/externalOrganizations/banks',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'TPO Custom Field Definitions',
      path: '/encompass/v3/settings/externalOrganizations/tpoCustomFieldDefinitions',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'TPO Fees',
      path: '/encompass/v3/settings/externalOrganizations/tpoFees',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'TPO Fee by id',
      path: '/encompass/v3/settings/externalOrganizations/tpoFees/{{feeId}}',
    },
    {
      group: 'TPO settings',
      method: 'GET',
      name: 'TPO Late Fees',
      path: '/encompass/v3/settings/externalOrganizations/tpoLateFees',
    },
    {
      group: 'TPO settings',
      method: 'PATCH',
      name: 'Add / Update / Delete External Org Site URLs',
      path: '/encompass/v3/settings/externalOrganizations/tpos/{{orgId}}/externalUrls',
    },
    {
      group: 'External users',
      method: 'GET',
      name: 'List external users',
      path: '/encompass/v3/externalUsers',
    },
    {
      group: 'External users',
      method: 'GET',
      name: 'Get external user',
      path: '/encompass/v3/externalUsers/{{TPOUserId1}}',
    },
    {
      group: 'External users',
      method: 'GET',
      name: 'External user effective rights',
      path: '/encompass/v3/externalUsers/{{TPOUserId1}}/effectiveRights',
    },
    {
      group: 'External users',
      method: 'PATCH',
      name: 'Add / Update / Delete External User',
      path: '/encompass/v3/externalUsers',
    },
    {
      group: 'Loans',
      method: 'POST',
      name: 'Create and Register a TPO Loan',
      path: '/encompass/v3/loans?templateType=templateSet&templatePath=…',
    },
    {
      group: 'Correspondent trades',
      method: 'POST',
      name: 'Create Correspondent Trade',
      path: '/secondary/v1/trades/correspondent',
    },
    {
      group: 'Correspondent trades',
      method: 'GET',
      name: 'Get Trade',
      path: '/secondary/v1/trades/correspondent/{{TradeId}}',
    },
    {
      group: 'Correspondent trades',
      method: 'PUT',
      name: 'Assign loans to Trade',
      path: '/secondary/v1/trades/correspondent/{{TradeId}}/loans',
    },
    {
      group: 'Correspondent trades',
      method: 'PATCH',
      name: 'Update / Publish Trade',
      path: '/secondary/v1/trades/correspondent/{{TradeId}}',
    },
    {
      group: 'Correspondent trades',
      method: 'GET',
      name: 'Trade eventHistory / notes / statistics',
      path: '/secondary/v1/trades/correspondent/{{TradeId}}/…',
    },
    {
      group: 'Correspondent trades',
      method: 'POST',
      name: 'Query Trade Pipeline',
      path: '/secondary/v1/tradePipeline',
    },
    {
      group: 'Webhooks',
      method: 'POST',
      name: 'Correspondent Trade webhook subscription',
      path: '/webhook/v1/subscriptions',
    },
    {
      group: 'Webhooks',
      method: 'POST',
      name: 'External Orgs webhook subscription',
      path: '/webhook/v1/subscriptions',
    },
  ];

  const POSTMAN_ENV_VARS = [
    { key: 'tpoOrgId', use: 'External org id in /tpos/{{tpoOrgId}} paths' },
    { key: 'tpoId', use: 'TPO id (trades / tpoDetails.tpoId)' },
    { key: 'tpoUserId1', use: 'External user id (collection also uses {{TPOUserId1}})' },
    { key: 'tpoCompanyName', use: 'Trade payload tpoDetails.tpoCompanyName' },
    { key: 'OID', use: 'externalOriginatorManagementId on correspondent trades' },
    { key: 'SiteURL1 / SiteURL2 / SiteURL3', use: 'External org site URL samples' },
    { key: 'API_SERVER', use: 'Base host for all Developer Connect calls' },
    { key: 'ACCESS_TOKEN', use: 'Bearer token on Authorization header' },
  ];

  const FIELD_IDS = [
    { id: 'TPO.X5', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X8', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X86', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X87', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X88', note: 'Used in NQM eligibility IIf formulas (Unit Tests)' },
    { id: 'TPO.X91', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X93', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X109', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPO.X119', note: 'Native TPO field (dropdown catalog)' },
    { id: 'TPOCONNECTSTATUSUPDATED', note: 'Misc flag — loan contract miscellaneous' },
  ];

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLoanFields(filter) {
    const tbody = document.getElementById('tpoLoanFieldsBody');
    const countEl = document.getElementById('tpoLoanFieldsCount');
    if (!tbody) return;
    const q = (filter || '').trim().toLowerCase();
    const rows = LOAN_CONTRACT_TPO_FIELDS.filter((f) => {
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.group.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q)
      );
    });
    tbody.innerHTML = rows
      .map(
        (f) =>
          `<tr><td><code>${escapeHtml(f.name)}</code></td><td>${escapeHtml(f.type)}</td><td>${escapeHtml(f.group)}</td></tr>`
      )
      .join('');
    if (countEl) {
      countEl.textContent = `${rows.length} of ${LOAN_CONTRACT_TPO_FIELDS.length}`;
    }
  }

  function renderFieldIds() {
    const list = document.getElementById('tpoFieldIdsList');
    if (!list) return;
    list.innerHTML = FIELD_IDS.map(
      (f) =>
        `<li><code>${escapeHtml(f.id)}</code> <span class="tpo-muted">${escapeHtml(f.note)}</span></li>`
    ).join('');
  }

  function methodBadge(method) {
    const m = String(method || 'GET').toUpperCase();
    return `<span class="tpo-method tpo-method--${escapeHtml(m.toLowerCase())}">${escapeHtml(m)}</span>`;
  }

  function renderPostmanApis(filter) {
    const tbody = document.getElementById('tpoPostmanBody');
    const countEl = document.getElementById('tpoPostmanCount');
    if (!tbody) return;
    const q = (filter || '').trim().toLowerCase();
    const rows = POSTMAN_APIS.filter((r) => {
      if (!q) return true;
      return (
        r.group.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q)
      );
    });
    tbody.innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${methodBadge(r.method)}</td><td>${escapeHtml(r.group)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.path)}</code></td></tr>`
      )
      .join('');
    if (countEl) countEl.textContent = `${rows.length} of ${POSTMAN_APIS.length}`;
  }

  function renderPostmanEnv() {
    const list = document.getElementById('tpoPostmanEnvList');
    if (!list) return;
    list.innerHTML = POSTMAN_ENV_VARS.map(
      (v) =>
        `<li><code>${escapeHtml(v.key)}</code> <span class="tpo-muted">${escapeHtml(v.use)}</span></li>`
    ).join('');
  }

  function initCopyButtons() {
    document.querySelectorAll('[data-copy-target]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sel = btn.getAttribute('data-copy-target');
        const el = sel ? document.querySelector(sel) : null;
        if (!el) return;
        const text = el.textContent || '';
        try {
          await navigator.clipboard.writeText(text);
          const prev = btn.innerHTML;
          btn.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i> Copied';
          setTimeout(() => {
            btn.innerHTML = prev;
          }, 1400);
        } catch (_) {
          /* ignore */
        }
      });
    });
  }

  function initSearch() {
    const input = document.getElementById('tpoLoanFieldSearch');
    if (input) {
      input.addEventListener('input', () => renderLoanFields(input.value));
    }
    const postmanInput = document.getElementById('tpoPostmanSearch');
    if (postmanInput) {
      postmanInput.addEventListener('input', () => renderPostmanApis(postmanInput.value));
    }
  }

  function init() {
    renderLoanFields('');
    renderFieldIds();
    renderPostmanApis('');
    renderPostmanEnv();
    initSearch();
    initCopyButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
