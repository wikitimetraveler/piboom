/**
 * Development work by David Lane
 *
 * Condition Manager — drives the dry-run conversion of the legacy ConditionsTemplate.xml
 * CDO into Enhanced Conditions payloads. The conversion itself runs server-side in
 * services/encompass-conditions-migration.service.js; this file is presentation only.
 */
const statusChip = document.getElementById('statusChip');
const errorBox = document.getElementById('errorBox');
const emptyState = document.getElementById('emptyState');
const accordion = document.getElementById('resultsAccordion');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const narrationToggle = document.getElementById('narrationToggle');
const stopSpeechBtn = document.getElementById('stopSpeechBtn');
const metricGrid = document.getElementById('metricGrid');
const briefingText = document.getElementById('briefingText');
const inputFormatNote = document.getElementById('inputFormatNote');
const aclDetail = document.getElementById('aclDetail');
const personaHint = document.getElementById('personaHint');
const personaProvisional = document.getElementById('personaProvisional');
const personaSourceInput = document.getElementById('personaSource');
const downloadButtons = document.getElementById('downloadButtons');
const reportPreview = document.getElementById('reportPreview');

let cdoPayload = null;
let personaPayload = null;
let bundle = null;
let reportMarkdown = '';

function setStatus(text, tone = 'ok', icon = 'bi-check-circle') {
  statusChip.className = `status-chip ${tone === 'ok' ? '' : tone}`.trim();
  statusChip.innerHTML = `<i class="bi ${icon}"></i> ${text}`;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('d-none');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('d-none');
}

/* ---------------------------------------------------------------- file input */

/**
 * Decodes dropped bytes to text. `File.text()` always assumes UTF-8, which turns a
 * UTF-16 export into interleaved NULs, so the byte order mark is honoured here instead.
 */
function decodeFileBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return new TextDecoder('utf-8').decode(bytes);
}

/** Chunked so a multi-megabyte CDO does not blow the argument limit on `fromCharCode`. */
function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Anything the server can recognise is sent as text; anything else (gzip, unknown binary)
 * goes over as base64 so the bytes arrive intact for the server to sniff.
 */
function prepareCdoPayload(buffer) {
  const text = decodeFileBytes(buffer).trim();
  const looksTextual = /^[[{<"]/.test(text) || /^[A-Za-z0-9+/=\s-]+$/.test(text.slice(0, 256));
  if (!looksTextual || text.includes('\u0000') || text.includes('\ufffd')) {
    return { payload: bytesToBase64(buffer), kind: 'raw bytes' };
  }
  if (text.startsWith('{') || text.startsWith('[')) {
    const parsed = JSON.parse(text);
    return { payload: Array.isArray(parsed) ? parsed[0] : parsed, kind: 'response JSON' };
  }
  return { payload: text, kind: text.startsWith('<') ? 'XML' : 'text' };
}

function wireDropzone(zoneId, inputId, labelId, onFile) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);

  const handle = async (file) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      onFile(buffer, file);
      label.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    } catch (error) {
      showError(`Could not read ${file.name}: ${error.message}`);
    }
  };

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => handle(input.files?.[0]));

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');
    handle(event.dataTransfer?.files?.[0]);
  });
}

function acceptCdoPayload(payload, kind) {
  cdoPayload = payload;
  convertBtn.disabled = false;
  setStatus(`CDO ready — ${kind}`, 'ok', 'bi-file-earmark-check');
}

wireDropzone('cdoDrop', 'cdoFile', 'cdoFileName', (buffer) => {
  clearError();
  try {
    const { payload, kind } = prepareCdoPayload(buffer);
    acceptCdoPayload(payload, kind);
  } catch (error) {
    cdoPayload = null;
    convertBtn.disabled = true;
    showError(`Could not read that CDO file: ${error.message}`);
  }
});

const cdoPaste = document.getElementById('cdoPaste');
cdoPaste?.addEventListener('input', () => {
  const text = cdoPaste.value.trim();
  if (!text) return;
  clearError();
  try {
    const encoded = new TextEncoder().encode(text);
    const { payload, kind } = prepareCdoPayload(encoded.buffer);
    acceptCdoPayload(payload, `${kind} (pasted)`);
    document.getElementById('cdoFileName').textContent = `Pasted (${Math.round(text.length / 1024)} KB)`;
  } catch (error) {
    cdoPayload = null;
    convertBtn.disabled = true;
    showError(`Could not read pasted CDO: ${error.message}`);
  }
});

wireDropzone('personaDrop', 'personaFile', 'personaFileName', (buffer) => {
  clearError();
  try {
    personaPayload = JSON.parse(decodeFileBytes(buffer));
  } catch (error) {
    personaPayload = null;
    showError(`Persona list is not valid JSON: ${error.message}`);
  }
});

/* -------------------------------------------------------------------- grids */

const gridApis = {};

const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  flex: 1,
  minWidth: 120,
};

function createGrid(hostId, options) {
  const host = document.getElementById(hostId);
  if (!host) return null;
  const gridOptions = {
    theme: 'legacy',
    defaultColDef,
    animateRows: true,
    rowData: [],
    ...options,
  };
  const api = typeof agGrid.createGrid === 'function'
    ? agGrid.createGrid(host, gridOptions)
    : (new agGrid.Grid(host, gridOptions), gridOptions.api);
  return api;
}

function setRows(api, rows) {
  if (!api) return;
  if (typeof api.setGridOption === 'function') api.setGridOption('rowData', rows);
  else if (typeof api.setRowData === 'function') api.setRowData(rows);
}

const GRID_BUILDERS = {
  templatesGrid: () => ({
    columnDefs: [
      { colId: 'internalId', headerName: 'Code', field: 'internalId', minWidth: 130 },
      { colId: 'title', headerName: 'Title', field: 'title', minWidth: 260 },
      { colId: 'conditionType', headerName: 'Condition type', field: 'conditionType', minWidth: 150 },
      { colId: 'category', headerName: 'Category', field: 'category', minWidth: 160 },
      { colId: 'source', headerName: 'Source', field: 'source', minWidth: 130 },
      { colId: 'recipient', headerName: 'Recipient', field: 'recipient', minWidth: 150 },
      { colId: 'printDefinitions', headerName: 'Print', field: 'printDefinitions', minWidth: 170 },
      { colId: 'internalDescription', headerName: 'Description', field: 'internalDescription', minWidth: 400 },
    ],
    rows: () => bundle.conditionTemplates.map((template) => ({
      ...template,
      printDefinitions: (template.printDefinitions || []).join(', '),
    })),
  }),
  reviewGrid: () => ({
    columnDefs: issueColumnDefs(),
    rows: () => bundle.issues.filter((issue) => issue.severity === 'needs_review').map(issueRow),
  }),
  fixedGrid: () => ({
    columnDefs: issueColumnDefs(),
    rows: () => bundle.issues.filter((issue) => issue.severity === 'auto_fixed').map(issueRow),
  }),
  aclGrid: () => ({
    columnDefs: [
      { colId: 'profileId', headerName: 'Profile', field: 'profileId', minWidth: 110 },
      { colId: 'conditionCount', headerName: 'Conditions', field: 'conditionCount', filter: 'agNumberColumnFilter', minWidth: 120 },
      { colId: 'distinctPersonas', headerName: 'Personas', field: 'distinctPersonas', filter: 'agNumberColumnFilter', minWidth: 110 },
      { colId: 'addCount', headerName: 'Can add', field: 'addCount', filter: 'agNumberColumnFilter', minWidth: 110 },
      { colId: 'waiveCount', headerName: 'Can waive', field: 'waiveCount', filter: 'agNumberColumnFilter', minWidth: 120 },
    ],
    onRowClicked: (event) => renderAclDetail(event.data?.profileId),
    rows: () => bundle.aclProfiles.map((profile) => {
      const lists = Object.values(profile.permissions);
      return {
        profileId: profile.profileId,
        conditionCount: profile.conditionCount,
        distinctPersonas: new Set(lists.flat()).size,
        addCount: (profile.permissions.Add || []).length,
        waiveCount: (profile.permissions.SetStatusWaived || []).length,
      };
    }),
  }),
  personaGrid: () => ({
    columnDefs: [
      { colId: 'role', headerName: 'Role name in CDO', field: 'role', minWidth: 220 },
      { colId: 'status', headerName: 'Status', field: 'status', minWidth: 130 },
      { colId: 'cause', headerName: 'Likely cause', field: 'cause', minWidth: 180 },
      { colId: 'candidates', headerName: 'Candidates in Encompass', field: 'candidates', minWidth: 300 },
    ],
    rows: () => personaRows(),
  }),
};

function humanize(type) {
  return String(type || '').replace(/_/g, ' ');
}

function issueColumnDefs() {
  return [
    { colId: 'type', headerName: 'Type', field: 'type', minWidth: 200 },
    { colId: 'codes', headerName: 'Condition codes', field: 'codes', minWidth: 220 },
    { colId: 'occurrences', headerName: 'Occurrences', field: 'occurrences', filter: 'agNumberColumnFilter', minWidth: 130 },
    { colId: 'detail', headerName: 'Detail', field: 'detail', minWidth: 420 },
  ];
}

function issueRow(issue) {
  const { severity, type, ...rest } = issue;
  const codes = rest.codes || rest.sampleCodes || (rest.code ? [rest.code] : []);
  const detail = { ...rest };
  delete detail.codes;
  delete detail.sampleCodes;
  delete detail.code;
  delete detail.occurrences;

  return {
    type: humanize(type),
    codes: Array.isArray(codes) ? codes.join(', ') : String(codes),
    occurrences: rest.occurrences ?? '',
    detail: Object.keys(detail).length ? JSON.stringify(detail) : '',
  };
}

function personaRows() {
  const { matched, unmatched } = bundle.personaReconciliation;
  const matchedRows = matched.map((entry) => ({
    role: entry.role,
    status: 'Matched',
    cause: '',
    candidates: entry.persona?.name || '',
  }));
  const unmatchedRows = unmatched.map((entry) => ({
    role: entry.role,
    status: 'Unmatched',
    cause: entry.likelyMerged
      ? 'two names merged'
      : entry.likelyTruncated
        ? 'truncated at 20 chars'
        : 'no match',
    candidates: entry.candidates.map((candidate) => `${candidate.name} (${candidate.score})`).join(', '),
  }));
  return [...unmatchedRows, ...matchedRows];
}

function unresolvedRoleSet() {
  return new Set(bundle.personaReconciliation.unmatched.map((entry) => entry.role));
}

function renderAclDetail(profileId) {
  const profile = bundle.aclProfiles.find((entry) => entry.profileId === profileId);
  if (!profile) return;
  const unresolved = unresolvedRoleSet();
  const suppliedPersonas = bundle.personaReconciliation.personaCount > 0;

  const lists = Object.entries(profile.permissions)
    .map(([permission, roles]) => {
      const chips = roles.length
        ? roles
          .map((role) => {
            const missing = suppliedPersonas && unresolved.has(role);
            return `<span class="persona-chip${missing ? ' missing' : ''}">${escapeHtml(role)}</span>`;
          })
          .join('')
        : '<span class="text-muted small">nobody</span>';
      return `<div class="mb-2"><div class="small fw-semibold">${humanize(permission)}</div>${chips}</div>`;
    })
    .join('');

  aclDetail.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-2">
      <div>
        <div class="fw-semibold">${escapeHtml(profile.profileId)}</div>
        <div class="small text-muted">${escapeHtml(profile.name)}</div>
      </div>
      <span class="badge text-bg-secondary">${profile.conditionCount} conditions</span>
    </div>
    ${lists}
    <div class="small text-muted mt-2">Conditions: ${escapeHtml(profile.conditionCodes.slice(0, 40).join(', '))}${
      profile.conditionCodes.length > 40 ? ` and ${profile.conditionCodes.length - 40} more` : ''
    }</div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

/**
 * AG Grid measures zero width inside a collapsed accordion panel, so each grid is
 * built the first time its section opens rather than up front.
 */
function ensureGrid(hostId) {
  if (!bundle) return;
  const builder = GRID_BUILDERS[hostId];
  if (!builder) return;
  const spec = builder();

  if (!gridApis[hostId]) {
    const { rows, ...options } = spec;
    gridApis[hostId] = createGrid(hostId, {
      ...options,
      overlayNoRowsTemplate: '<span class="text-muted">Nothing to show for this CDO.</span>',
    });
  }
  setRows(gridApis[hostId], spec.rows());
  gridApis[hostId]?.sizeColumnsToFit?.();
}

const SECTION_GRIDS = {
  sectionTemplates: 'templatesGrid',
  sectionReview: 'reviewGrid',
  sectionFixed: 'fixedGrid',
  sectionAcl: 'aclGrid',
  sectionPersonas: 'personaGrid',
};

Object.entries(SECTION_GRIDS).forEach(([sectionId, hostId]) => {
  document.getElementById(sectionId)?.addEventListener('shown.bs.collapse', () => ensureGrid(hostId));
});

/* ---------------------------------------------------------------- narration */

let speechToken = 0;

function stopSpeaking() {
  speechToken += 1;
  window.stopSpeech?.();
  document.querySelectorAll('.listen-btn.is-speaking').forEach((btn) => btn.classList.remove('is-speaking'));
}

async function speak(text, button) {
  if (!narrationToggle.checked || !text) return;
  stopSpeaking();
  const token = speechToken;
  button?.classList.add('is-speaking');
  window.ensureAudioUnlock?.();
  try {
    await window.speakNarrationAwaitEnd?.(text, { isCancelled: () => token !== speechToken });
  } finally {
    button?.classList.remove('is-speaking');
  }
}

function countByType(severity) {
  const counts = new Map();
  for (const issue of bundle.issues) {
    if (issue.severity !== severity) continue;
    counts.set(issue.type, (counts.get(issue.type) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function listTopTypes(severity, limit = 3) {
  const top = countByType(severity).slice(0, limit);
  if (!top.length) return 'nothing';
  return top.map(([type, count]) => `${count} ${humanize(type)}`).join(', ');
}

const NARRATION = {
  briefing: () => {
    const s = bundle.summary;
    return [
      `The custom data object holds ${s.conditionsParsed} conditions.`,
      `They convert into ${s.conditionsConverted} Enhanced Conditions templates under ${s.conditionTypes} condition types.`,
      `${s.autoFixed} cleanups were applied automatically and ${s.needsReview} items need a decision from you.`,
      `The eleven per-condition permission lists collapse into ${s.aclProfiles} distinct access profiles.`,
      s.unresolvedRoles
        ? `${s.unresolvedRoles} of the ${s.distinctRoles} persona names referenced could not be matched.`
        : `All ${s.distinctRoles} persona names matched a persona in Encompass.`,
      bundle.personaSource.supplied && bundle.personaSource.provisional
        ? `That comparison used the ${bundle.personaSource.label || 'unlabelled'} persona list, so it is provisional.`
        : '',
    ].filter(Boolean).join(' ');
  },
  templates: () => {
    if (!bundle.conditionTemplates.length) return 'This CDO produced no condition templates.';
    const byType = new Map();
    for (const template of bundle.conditionTemplates) {
      byType.set(template.conditionType, (byType.get(template.conditionType) || 0) + 1);
    }
    const split = [...byType.entries()].map(([type, count]) => `${count} under ${type}`).join(', and ');
    const external = bundle.conditionTemplates.filter((t) => t.externalId).length;
    return `There are ${bundle.conditionTemplates.length} condition templates: ${split}. `
      + `${external} of them are borrower or third party facing, so they carry an external description as well as an internal one.`;
  },
  review: () => {
    const s = bundle.summary;
    if (!s.needsReview) return 'Nothing in this conversion needs a decision.';
    return `${s.needsReview} items need a decision. The largest groups are ${listTopTypes('needs_review')}. `
      + 'The converter reports these rather than guessing, because each one is a business call.';
  },
  fixed: () => {
    const s = bundle.summary;
    if (!s.autoFixed) return 'No automatic cleanups were needed.';
    return `${s.autoFixed} cleanups were applied automatically, mostly ${listTopTypes('auto_fixed')}. `
      + 'These carry no interpretive risk, so they are applied rather than queued.';
  },
  acl: () => {
    const s = bundle.summary;
    const largest = bundle.aclProfiles[0];
    if (!largest) return 'This CDO carries no per-condition access lists.';
    return `The per-condition access lists collapse into ${s.aclProfiles} distinct profiles. `
      + `The largest covers ${largest.conditionCount} conditions. `
      + `${s.singleUseAclProfiles} profiles are used by a single condition, which usually means drift rather than intent. `
      + 'Enhanced Conditions cannot store these, so each profile is a persona configuration to apply once in admin.';
  },
  personas: () => {
    const rec = bundle.personaReconciliation;
    const source = bundle.personaSource;
    const caveat = source.supplied && source.provisional
      ? ` These matches come from ${source.label || 'an unlabelled list'}, not production, so treat them as provisional.`
      : '';
    if (!rec.personaCount) {
      return `The custom data object references ${rec.roleCount} distinct persona names, but no persona list was supplied, `
        + 'so none of them could be reconciled. Load the personas export to see which names still exist.';
    }
    const truncated = rec.unmatched.filter((entry) => entry.likelyTruncated).length;
    const merged = rec.unmatched.filter((entry) => entry.likelyMerged).length;
    return `Of ${rec.roleCount} persona names, ${rec.matched.length} match a persona in Encompass and ${rec.unmatched.length} do not. `
      + `${truncated} look cut off at the twenty character limit and ${merged} look like two names run together. `
      + `${rec.impact.permissionListsGrantingNobody} permission lists currently grant access to nobody at all.${caveat}`;
  },
  payloads: () => 'This section hands you the same six artifacts the command line converter writes: '
    + 'the condition types, the condition templates, the access profiles, the normalized conditions, '
    + 'and the data quality report as both JSON and Markdown.',
};

document.querySelectorAll('[data-listen]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!bundle) return;
    const builder = NARRATION[button.dataset.listen];
    if (builder) speak(builder(), button);
  });
});

stopSpeechBtn.addEventListener('click', stopSpeaking);
narrationToggle.addEventListener('change', () => {
  if (!narrationToggle.checked) stopSpeaking();
});

/* ---------------------------------------------------------------- downloads */

function download(name, value) {
  const text = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Browser downloads all land in one folder, so the persona source rides in the filename.
 * A UAT reconciliation opened three weeks later should announce itself as one.
 */
function stampFileName(name) {
  const label = bundle.personaSource.label;
  if (!label || !bundle.personaSource.supplied) return name;
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return name;
  const dot = name.lastIndexOf('.');
  return `${name.slice(0, dot)}-${slug}${name.slice(dot)}`;
}

function renderDownloads() {
  const artifacts = [
    ['condition-types.json', () => bundle.conditionTypes],
    ['condition-templates.json', () => bundle.conditionTemplates],
    ['acl-profiles.json', () => ({ profiles: bundle.aclProfiles, assignments: bundle.aclAssignments })],
    ['normalized-conditions.json', () => bundle.conditions],
    ['data-quality-report.json', () => ({
      summary: bundle.summary,
      issues: bundle.issues,
      personaReconciliation: bundle.personaReconciliation,
    })],
    ['data-quality-report.md', () => reportMarkdown],
  ];

  downloadButtons.innerHTML = '';
  for (const [name, build] of artifacts) {
    const fileName = stampFileName(name);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-primary btn-sm';
    button.innerHTML = `<i class="bi bi-download"></i> ${fileName}`;
    button.addEventListener('click', () => download(fileName, build()));
    downloadButtons.appendChild(button);
  }

  reportPreview.textContent = reportMarkdown;
}

/* ----------------------------------------------------------------- rendering */

function metric(label, value, tone = '') {
  return `<div class="metric ${tone}"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

function renderSummary() {
  const s = bundle.summary;
  metricGrid.innerHTML = [
    metric('Conditions in the CDO', s.conditionsParsed),
    metric('Templates generated', s.conditionsConverted),
    metric('Condition types', s.conditionTypes),
    metric('Access profiles', s.aclProfiles),
    metric('Applied automatically', s.autoFixed),
    metric('Needs a decision', s.needsReview, s.needsReview ? 'warn' : ''),
    metric('Unmatched personas', s.unresolvedRoles, s.unresolvedRoles ? 'danger' : ''),
    metric('Lists granting nobody', s.permissionListsGrantingNobody, s.permissionListsGrantingNobody ? 'danger' : ''),
  ].join('');

  briefingText.textContent = NARRATION.briefing();

  document.getElementById('countTemplates').textContent = bundle.conditionTemplates.length;
  document.getElementById('countReview').textContent = s.needsReview;
  document.getElementById('countFixed').textContent = s.autoFixed;
  document.getElementById('countAcl').textContent = s.aclProfiles;
  document.getElementById('countPersonas').textContent = bundle.personaReconciliation.roleCount;

  const source = bundle.personaSource;
  personaHint.classList.toggle('d-none', source.supplied);
  personaProvisional.classList.toggle('d-none', !source.supplied || !source.provisional);
  if (source.supplied && source.provisional) {
    personaProvisional.innerHTML = `These matches come from <strong>${escapeHtml(source.label || 'an unlabelled list')}</strong>, `
      + 'not production. Persona names drift between environments, so re-run against the '
      + 'production list before anyone configures personas from this.';
  }
}

function renderBundle() {
  emptyState.classList.add('d-none');
  accordion.classList.remove('d-none');

  renderSummary();
  renderDownloads();
  aclDetail.innerHTML = '<p class="text-muted mb-0">Select a profile to see its permission lists.</p>';

  // Rebuild any grid whose section is already open; the rest build on first expand.
  Object.entries(SECTION_GRIDS).forEach(([sectionId, hostId]) => {
    if (document.getElementById(sectionId)?.classList.contains('show')) ensureGrid(hostId);
  });
}

/** Shows how the upload had to be unwrapped, so a surprising result can be traced to it. */
function renderInputFormat(notes) {
  const layers = Array.isArray(notes) ? notes : [];
  inputFormatNote.classList.toggle('d-none', !layers.length);
  if (!layers.length) return;
  inputFormatNote.innerHTML = `<i class="bi bi-file-earmark-code"></i> Read as ${escapeHtml(layers.join(' → '))}.`;
}

async function convert() {
  if (!cdoPayload) return;
  clearError();
  stopSpeaking();
  convertBtn.disabled = true;
  setStatus('Converting', 'busy', 'bi-hourglass-split');

  const convertUrl = `${window.location.origin}/api/encompass-conditions/convert`;

  try {
    let response;
    try {
      response = await fetch(convertUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cdo: cdoPayload,
          personas: personaPayload,
          personaSource: personaSourceInput.value,
        }),
      });
    } catch (networkError) {
      throw new Error(
        `Could not reach ${convertUrl} (${networkError.message}). `
        + 'Open this page at http://localhost:3000/finance/condition-manager.html with the Node server running, then hard-refresh.',
      );
    }

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      const looksHtml = /^\s*</.test(raw);
      throw new Error(
        looksHtml
          ? `Convert API at ${convertUrl} returned a web page (${response.status}) instead of JSON — restart the Node server so the conditions route is loaded.`
          : `Convert API returned non-JSON (${response.status}).`,
      );
    }
    if (!response.ok) {
      throw new Error(data.details ? `${data.error}: ${data.details}` : data.error || `Request failed (${response.status})`);
    }

    bundle = data.bundle;
    reportMarkdown = data.reportMarkdown || '';
    renderBundle();
    renderInputFormat(data.inputFormat);
    setStatus(`${bundle.summary.conditionsConverted} conditions converted`, 'ok', 'bi-check-circle');
    speak(NARRATION.briefing(), document.querySelector('[data-listen="briefing"]'));
  } catch (error) {
    console.error('Conditions conversion failed', error);
    showError(error.message);
    setStatus('Conversion failed', 'err', 'bi-exclamation-octagon');
  } finally {
    convertBtn.disabled = false;
  }
}

convertBtn.addEventListener('click', convert);

clearBtn.addEventListener('click', () => {
  stopSpeaking();
  clearError();
  cdoPayload = null;
  personaPayload = null;
  bundle = null;
  reportMarkdown = '';
  document.getElementById('cdoFile').value = '';
  document.getElementById('personaFile').value = '';
  document.getElementById('cdoFileName').textContent = 'No file chosen';
  document.getElementById('personaFileName').textContent = 'No file chosen';
  if (cdoPaste) cdoPaste.value = '';
  inputFormatNote.classList.add('d-none');
  personaSourceInput.value = '';
  convertBtn.disabled = true;
  accordion.classList.add('d-none');
  emptyState.classList.remove('d-none');
  setStatus('Waiting for a CDO', 'ok', 'bi-upload');
});
