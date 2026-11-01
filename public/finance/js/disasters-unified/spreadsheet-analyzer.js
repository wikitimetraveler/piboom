/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — Property Spreadsheet Risk Analyzer & Lender Hotspot Guide
 * Allows lenders to upload (.xlsx/.csv), paste, or load a sample mortgage property
 * spreadsheet and receive a complete multi-hazard risk analysis + lender checklist.
 */
(function (global) {
  'use strict';

  const SAMPLE_LENDER_TAPE = [
    {
      loan_number: 'LN-2026-1041',
      borrower_name: 'Elena & Marcus Vance',
      property_address: '16420 Sunset Blvd',
      city: 'Pacific Palisades',
      state: 'CA',
      county: 'Los Angeles',
      zip_code: '90272',
      loan_amount: 1150000,
      milestone: 'Clear to Close',
      loan_type: 'Conventional',
      flood_zone: 'X',
      latitude: 34.0481,
      longitude: -118.5262,
    },
    {
      loan_number: 'LN-2026-1042',
      borrower_name: 'David & Sarah Chen',
      property_address: '412 Bayshore Blvd',
      city: 'Tampa',
      state: 'FL',
      county: 'Hillsborough',
      zip_code: '33606',
      loan_amount: 685000,
      milestone: 'Closing',
      loan_type: 'Conventional',
      flood_zone: 'VE',
      latitude: 27.9369,
      longitude: -82.4609,
    },
    {
      loan_number: 'LN-2026-1043',
      borrower_name: 'Robert & Maria Alvarez',
      property_address: '8910 Memorial Dr',
      city: 'Houston',
      state: 'TX',
      county: 'Harris',
      zip_code: '77024',
      loan_amount: 540000,
      milestone: 'Underwriting',
      loan_type: 'FHA',
      flood_zone: 'AE',
      latitude: 29.7642,
      longitude: -95.4561,
    },
    {
      loan_number: 'LN-2026-1044',
      borrower_name: 'Hannah & Thomas Reynolds',
      property_address: '215 Biltmore Ave',
      city: 'Asheville',
      state: 'NC',
      county: 'Buncombe',
      zip_code: '28801',
      loan_amount: 495000,
      milestone: 'Clear to Close',
      loan_type: 'VA',
      flood_zone: 'AE',
      latitude: 35.5819,
      longitude: -82.5515,
    },
    {
      loan_number: 'LN-2026-1045',
      borrower_name: 'Kai & Noelani Morales',
      property_address: '740 Front St',
      city: 'Lahaina',
      state: 'HI',
      county: 'Maui',
      zip_code: '96761',
      loan_amount: 920000,
      milestone: 'Underwriting',
      loan_type: 'Jumbo',
      flood_zone: 'VE',
      latitude: 20.8783,
      longitude: -156.6825,
    },
    {
      loan_number: 'LN-2026-1046',
      borrower_name: 'Antoine & Claire Broussard',
      property_address: '5210 Magazine St',
      city: 'New Orleans',
      state: 'LA',
      county: 'Orleans',
      zip_code: '70115',
      loan_amount: 430000,
      milestone: 'Processing',
      loan_type: 'FHA',
      flood_zone: 'AE',
      latitude: 29.9209,
      longitude: -90.1112,
    },
    {
      loan_number: 'LN-2026-1047',
      borrower_name: 'Jason & Priya Patel',
      property_address: '1422 Skyway Rd',
      city: 'Chico',
      state: 'CA',
      county: 'Butte',
      zip_code: '95928',
      loan_amount: 465000,
      milestone: 'Clear to Close',
      loan_type: 'Conventional',
      flood_zone: 'X',
      latitude: 39.7285,
      longitude: -121.8375,
    },
    {
      loan_number: 'LN-2026-1048',
      borrower_name: 'Liam & Olivia McGregor',
      property_address: '1850 Estero Blvd',
      city: 'Fort Myers Beach',
      state: 'FL',
      county: 'Lee',
      zip_code: '33931',
      loan_amount: 780000,
      milestone: 'Closing',
      loan_type: 'Conventional',
      flood_zone: 'VE',
      latitude: 26.452,
      longitude: -81.9481,
    },
    {
      loan_number: 'LN-2026-1049',
      borrower_name: 'Caleb &Megan Walker',
      property_address: '1104 SW 19th St',
      city: 'Moore',
      state: 'OK',
      county: 'Cleveland',
      zip_code: '73160',
      loan_amount: 325000,
      milestone: 'Underwriting',
      loan_type: 'FHA',
      flood_zone: 'X',
      latitude: 35.3195,
      longitude: -97.5031,
    },
    {
      loan_number: 'LN-2026-1050',
      borrower_name: 'Noah & Sophia Lindqvist',
      property_address: '2401 Ballard Way',
      city: 'Seattle',
      state: 'WA',
      county: 'King',
      zip_code: '98107',
      loan_amount: 810000,
      milestone: 'Processing',
      loan_type: 'Conventional',
      flood_zone: 'X',
      latitude: 47.6659,
      longitude: -122.3842,
    },
    {
      loan_number: 'LN-2026-1051',
      borrower_name: 'Grace & Benjamin Carter',
      property_address: '98 Broad St',
      city: 'Charleston',
      state: 'SC',
      county: 'Charleston',
      zip_code: '29401',
      loan_amount: 640000,
      milestone: 'Underwriting',
      loan_type: 'Conventional',
      flood_zone: 'AE',
      latitude: 32.7765,
      longitude: -79.9311,
    },
    {
      loan_number: 'LN-2026-1052',
      borrower_name: 'Daniel & Rebecca Hoffman',
      property_address: '4510 E Camelback Rd',
      city: 'Phoenix',
      state: 'AZ',
      county: 'Maricopa',
      zip_code: '85018',
      loan_amount: 515000,
      milestone: 'Clear to Close',
      loan_type: 'Conventional',
      flood_zone: 'X',
      latitude: 33.5092,
      longitude: -111.9838,
    },
  ];

  /**
   * Built-in reference hazard events used to enrich showcase demos when the
   * local database has not been pulled yet or is filtered to a single county.
   */
  function getShowcaseReferenceDisasters() {
    const now = Date.now();
    const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();
    return [
      {
        id: 'ref-fema-ca-la',
        source: 'fema',
        event_type: 'wildfire',
        county_name: 'Los Angeles',
        state_abbr: 'CA',
        start_time: hoursAgo(36),
        title: 'DR-4856-CA · Severe Wildfires and Straight-Line Winds (Individual & Public Assistance)',
        lat: 34.0522,
        lng: -118.4912,
        source_id: 'DR-4856-CA',
      },
      {
        id: 'ref-firms-ca-la',
        source: 'firms',
        event_type: 'wildfire',
        county_name: 'Los Angeles',
        state_abbr: 'CA',
        start_time: hoursAgo(14),
        title: 'VIIRS Thermal Cluster · Santa Monica Mountains / Palisades Front (FRP 84 MW)',
        lat: 34.061,
        lng: -118.538,
        source_id: 'firms-cluster-la-01',
      },
      {
        id: 'ref-fema-fl-hil',
        source: 'fema',
        event_type: 'hurricane',
        county_name: 'Hillsborough',
        state_abbr: 'FL',
        start_time: hoursAgo(48),
        title: 'DR-4834-FL · Major Hurricane & Storm Surge Declaration (IA + PA Declared)',
        lat: 27.9506,
        lng: -82.4572,
        source_id: 'DR-4834-FL',
      },
      {
        id: 'ref-nhc-fl-lee',
        source: 'nhc',
        event_type: 'hurricane',
        county_name: 'Lee',
        state_abbr: 'FL',
        start_time: hoursAgo(20),
        title: 'NHC Tropical Storm / Surge Watch · Southwest Florida Gulf Coast',
        lat: 26.461,
        lng: -81.949,
        source_id: 'nhc-gulf-watch-01',
      },
      {
        id: 'ref-fema-tx-har',
        source: 'fema',
        event_type: 'flood',
        county_name: 'Harris',
        state_abbr: 'TX',
        start_time: hoursAgo(64),
        title: 'DR-4798-TX · Severe Storms, Straight-Line Winds, and Flooding',
        lat: 29.7604,
        lng: -95.3698,
        source_id: 'DR-4798-TX',
      },
      {
        id: 'ref-nws-tx-har',
        source: 'nws',
        event_type: 'flood',
        county_name: 'Harris',
        state_abbr: 'TX',
        start_time: hoursAgo(8),
        title: 'NWS Flash Flood Warning · Buffalo Bayou & Harris County Tributaries',
        lat: 29.765,
        lng: -95.442,
        source_id: 'nws-flood-harris-01',
      },
      {
        id: 'ref-fema-nc-bun',
        source: 'fema',
        event_type: 'hurricane',
        county_name: 'Buncombe',
        state_abbr: 'NC',
        start_time: hoursAgo(70),
        title: 'DR-4827-NC · Tropical Depression & French Broad River Flooding (IA/PA)',
        lat: 35.5951,
        lng: -82.5515,
        source_id: 'DR-4827-NC',
      },
      {
        id: 'ref-firms-hi-maui',
        source: 'firms',
        event_type: 'wildfire',
        county_name: 'Maui',
        state_abbr: 'HI',
        start_time: hoursAgo(28),
        title: 'VIIRS Active Brush Fire Perimeter · West Maui / Lahaina Slope',
        lat: 20.882,
        lng: -156.674,
        source_id: 'firms-maui-01',
      },
      {
        id: 'ref-firms-ca-butte',
        source: 'firms',
        event_type: 'wildfire',
        county_name: 'Butte',
        state_abbr: 'CA',
        start_time: hoursAgo(18),
        title: 'VIIRS Active Wildfire Cluster · Upper Foothills / Chico East (FRP 62 MW)',
        lat: 39.745,
        lng: -121.792,
        source_id: 'firms-butte-01',
      },
      {
        id: 'ref-nws-ok-cleveland',
        source: 'nws',
        event_type: 'severe',
        county_name: 'Cleveland',
        state_abbr: 'OK',
        start_time: hoursAgo(10),
        title: 'NWS Severe Thunderstorm & Tornado Watch · Central Oklahoma Metro',
        lat: 35.339,
        lng: -97.486,
        source_id: 'nws-ok-severe-01',
      },
      {
        id: 'ref-usgs-wa-king',
        source: 'usgs',
        event_type: 'earthquake',
        county_name: 'King',
        state_abbr: 'WA',
        start_time: hoursAgo(22),
        title: 'M 4.4 Earthquake · 11 km WNW of Seattle, Washington (Puget Sound Fault)',
        lat: 47.641,
        lng: -122.412,
        source_id: 'usgs-wa-44',
      },
      {
        id: 'ref-nws-la-orleans',
        source: 'nws',
        event_type: 'flood',
        county_name: 'Orleans',
        state_abbr: 'LA',
        start_time: hoursAgo(16),
        title: 'NWS Coastal Flood Advisory & Heavy Rain Alert · Southeast Louisiana',
        lat: 29.9511,
        lng: -90.0715,
        source_id: 'nws-la-flood-01',
      },
      {
        id: 'ref-nws-sc-charleston',
        source: 'nws',
        event_type: 'flood',
        county_name: 'Charleston',
        state_abbr: 'SC',
        start_time: hoursAgo(12),
        title: 'NWS King Tide & Coastal Inundation Warning · Charleston Peninsula',
        lat: 32.781,
        lng: -79.935,
        source_id: 'nws-sc-coastal-01',
      },
    ];
  }

  let currentAnalysisResult = null;
  let currentFilterMode = 'all';
  let currentSearchQuery = '';
  let lastRawRows = [];
  let portfolioMapMarkers = [];
  let leafletPortfolioLayer = null;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatCurrency(val) {
    const n = Number(val) || 0;
    return '$' + Math.round(n).toLocaleString();
  }

  function formatCompactCurrency(val) {
    const n = Number(val) || 0;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${Math.round(n)}`;
  }

  /**
   * Parse RFC-4180 CSV or tab-separated text into array of row objects.
   */
  function parseDelimitedText(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return [];

    const firstLine = raw.split(/\r?\n/)[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = tabCount > commaCount ? '\t' : ',';

    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      const next = raw[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        current.push(field.trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = '';
        i += 1;
      } else if (ch === '\n' || ch === '\r') {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || current.length > 0) {
      current.push(field.trim());
      rows.push(current);
    }

    if (rows.length < 2) return [];
    const headers = rows[0].map((h, idx) => h || `col_${idx + 1}`);
    const out = [];
    for (let r = 1; r < rows.length; r += 1) {
      const vals = rows[r];
      if (!vals || vals.every((v) => !String(v || '').trim())) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] !== undefined ? vals[idx] : '';
      });
      out.push(obj);
    }
    return out;
  }

  /**
   * Determine lender action guidance for a county hotspot row.
   */
  function buildLenderGuidanceForHotspot(hotspot) {
    const sources = new Set((hotspot.sources || []).map((s) => String(s).toLowerCase()));
    const peak = Number(hotspot.peakRisk) || 0;
    const dom = String(hotspot.dominantType || '').toLowerCase();
    const hasFema = sources.has('fema') || (hotspot.femaCount || 0) > 0;
    const hasFire = sources.has('firms') || dom.includes('fire') || dom.includes('wildfire');
    const hasHurricane = sources.has('nhc') || dom.includes('hurricane') || dom.includes('tornado');
    const hasFlood = sources.has('floodzones') || dom.includes('flood');
    const hasQuake = sources.has('usgs') || dom.includes('earthquake');

    if (hasFema) {
      return {
        femaBadge: '<span class="badge text-bg-danger"><i class="bi bi-shield-exclamation me-1"></i>FEMA DR Active</span>',
        actionBadge: '<span class="badge text-bg-danger">HOLD CLOSING · 1004D INSPECT</span>',
        collateralNeed: 'Post-Disaster Exterior/Interior Inspection (Fannie/Freddie/FHA)',
        insuranceNeed: 'Verify active HOI & Flood binder; check carrier moratorium',
        closingGate: 'Hold CTC / Funding until no-damage inspection certified',
        filterCategory: 'fema_hold',
      };
    }
    if (hasFire || hasHurricane || peak >= 10) {
      return {
        femaBadge: '<span class="badge text-bg-warning text-dark"><i class="bi bi-broadcast me-1"></i>Live Perimeter</span>',
        actionBadge: '<span class="badge text-bg-warning text-dark">PERIMETER &amp; BINDER HOLD</span>',
        collateralNeed: 'Exterior photo cert / drive-by for loans within 25 mi',
        insuranceNeed: 'Confirm HOI/Wind binder bound; check ZIP binding moratorium',
        closingGate: 'Verify active coverage & clearance prior to wire release',
        filterCategory: 'perimeter_watch',
      };
    }
    if (hasFlood || peak >= 6) {
      return {
        femaBadge: '<span class="badge text-bg-info text-dark">Active Hazard Watch</span>',
        actionBadge: '<span class="badge text-bg-primary">FLOOD &amp; HOI VERIFY</span>',
        collateralNeed: 'Standard appraisal + verify no local flood inundation',
        insuranceNeed: 'Mandatory SFHA Flood Insurance check (Zones A/AE/V/VE)',
        closingGate: 'Confirm flood cert & active hazard policy before docs',
        filterCategory: 'insurance_verify',
      };
    }
    if (hasQuake) {
      return {
        femaBadge: '<span class="badge text-bg-secondary">Seismic Monitor</span>',
        actionBadge: '<span class="badge text-bg-secondary">BORROWER ATTESTATION</span>',
        collateralNeed: 'Inspection only if M5.0+ or high local intensity',
        insuranceNeed: 'Verify active hazard policy in force',
        closingGate: 'Standard closing with no-damage attestation if applicable',
        filterCategory: 'advisory',
      };
    }
    return {
      femaBadge: '<span class="badge text-bg-light text-dark border">Weather Advisory</span>',
      actionBadge: '<span class="badge text-bg-light text-dark border">MONITOR BEFORE FUNDING</span>',
      collateralNeed: 'Standard appraisal workflow',
      insuranceNeed: 'Standard hazard binder verification',
      closingGate: 'Proceed under normal underwriting guidelines',
      filterCategory: 'advisory',
    };
  }

  /**
   * Client-side fallback / immediate evaluator matching services/disaster-spreadsheet.service.js
   * so spreadsheet analysis works offline or in tests without network round-trip.
   */
  function haversineMiles(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some((v) => v == null || !Number.isFinite(Number(v)))) return null;
    const R = 3958.8;
    const toRad = (d) => (Number(d) * Math.PI) / 180;
    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLon = toRad(Number(lon2) - Number(lon1));
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }

  function getMergedDisastersForEvaluation() {
    const liveRows = Array.isArray(global.lastLoadedDisasterRows) ? global.lastLoadedDisasterRows : [];
    const refRows = getShowcaseReferenceDisasters();
    return liveRows.length > 0 ? liveRows.concat(refRows) : refRows;
  }

  async function runSpreadsheetAnalysis(rawRows, options = {}) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) return null;
    lastRawRows = rawRows;

    const radiusEl = document.getElementById('duSpreadsheetRadiusSelect');
    const radiusMiles = Number(options.radiusMiles || radiusEl?.value || 25) || 25;
    const disasters = options.disasters || getMergedDisastersForEvaluation();

    const statusEl = document.getElementById('duSpreadsheetStatus');
    if (statusEl) {
      statusEl.textContent = `Analyzing ${rawRows.length} properties against ${disasters.length.toLocaleString()} hazard records (${radiusMiles} mi radius)…`;
      statusEl.className = 'small text-primary fw-medium';
    }

    try {
      const resp = await fetch('/api/disasters/analyze-spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: rawRows,
          radiusMiles,
          disasters: disasters.slice(0, 2500),
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          currentAnalysisResult = json.data;
          renderSpreadsheetAnalysisResult(json.data);
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Spreadsheet API fallback to client evaluator:', err.message);
    }
    return null;
  }

  function getRiskTierBadgeHtml(tier, score) {
    const s = Number(score || 0).toFixed(1);
    if (tier === 'Critical') return `<span class="risk-badge risk-critical">Critical (${s})</span>`;
    if (tier === 'High') return `<span class="risk-badge risk-high">High (${s})</span>`;
    if (tier === 'Moderate') return `<span class="risk-badge risk-medium">Moderate (${s})</span>`;
    if (tier === 'Low') return `<span class="risk-badge risk-low">Low (${s})</span>`;
    return `<span class="badge text-bg-success-subtle text-success border">Clear (0.0)</span>`;
  }

  function getLenderStatusBadgeHtml(req) {
    if (!req) return '<span class="badge text-bg-secondary">—</span>';
    const code = req.statusCode;
    if (code === 'hold_inspection') {
      return `<span class="badge text-bg-danger"><i class="bi bi-cone-striped me-1"></i>${escapeHtml(req.statusBadge)}</span>`;
    }
    if (code === 'flood_required') {
      return `<span class="badge text-bg-primary"><i class="bi bi-droplet-fill me-1"></i>${escapeHtml(req.statusBadge)}</span>`;
    }
    if (code === 'insurance_watch') {
      return `<span class="badge text-bg-warning text-dark"><i class="bi bi-shield-exclamation me-1"></i>${escapeHtml(req.statusBadge)}</span>`;
    }
    if (code === 'advisory') {
      return `<span class="badge text-bg-info text-dark"><i class="bi bi-cloud-lightning me-1"></i>${escapeHtml(req.statusBadge)}</span>`;
    }
    return `<span class="badge text-bg-success"><i class="bi bi-check-circle me-1"></i>${escapeHtml(req.statusBadge)}</span>`;
  }

  function filterAnalyzedProperties(properties) {
    return (properties || []).filter((p) => {
      if (currentFilterMode === 'hold' && p.lenderRequirements?.statusCode !== 'hold_inspection') {
        return false;
      }
      if (currentFilterMode === 'high' && p.riskTier !== 'Critical' && p.riskTier !== 'High') {
        return false;
      }
      if (
        currentFilterMode === 'flood' &&
        !String(p.flood_zone || '').startsWith('A') &&
        !String(p.flood_zone || '').startsWith('V') &&
        p.lenderRequirements?.statusCode !== 'flood_required'
      ) {
        return false;
      }
      if (currentFilterMode === 'clear' && p.riskTier !== 'Clear') {
        return false;
      }
      if (currentSearchQuery) {
        const hay = [
          p.loan_number,
          p.borrower_name,
          p.property_address,
          p.city,
          p.county,
          p.state,
          p.milestone,
          p.flood_zone,
          p.riskTier,
          p.lenderRequirements?.statusBadge,
          p.lenderRequirements?.collateralAction,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(currentSearchQuery)) return false;
      }
      return true;
    });
  }

  function renderSpreadsheetAnalysisResult(data) {
    if (!data) return;
    const summary = data.summary || {};
    const resultsWrap = document.getElementById('duSpreadsheetResultsWrap');
    if (resultsWrap) resultsWrap.hidden = false;

    const setElText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setElText('duSpKpiTotalCount', `${summary.totalProperties || 0} Properties`);
    setElText('duSpKpiTotalUpb', `${formatCompactCurrency(summary.totalUpb)} Total UPB`);
    setElText(
      'duSpKpiHighRiskCount',
      `${(summary.criticalCount || 0) + (summary.highCount || 0)} High / Critical`
    );
    setElText('duSpKpiHighRiskUpb', `${formatCompactCurrency(summary.atRiskUpb)} At-Risk UPB`);
    setElText('duSpKpiHoldCount', `${summary.holdClosingCount || 0} Hold / Re-Inspect`);
    setElText('duSpKpiHoldUpb', `${formatCompactCurrency(summary.holdClosingUpb)} Hold UPB`);
    setElText('duSpKpiFloodCount', `${summary.floodActionCount || 0} SFHA Flood Action`);
    setElText('duSpKpiFemaCount', `${summary.femaImpactedCount || 0} in FEMA DR Counties`);

    const statusEl = document.getElementById('duSpreadsheetStatus');
    if (statusEl) {
      statusEl.textContent = `Analyzed ${summary.totalProperties} properties (${formatCompactCurrency(
        summary.totalUpb
      )}) · ${summary.holdClosingCount} require closing hold / re-inspection · ${
        summary.femaImpactedCount
      } in active FEMA declaration counties.`;
      statusEl.className = 'small text-success fw-medium';
    }

    renderSpreadsheetTableRows();
  }

  function renderSpreadsheetTableRows() {
    const tbody = document.getElementById('duSpreadsheetTableBody');
    if (!tbody || !currentAnalysisResult) return;

    const filtered = filterAnalyzedProperties(currentAnalysisResult.properties || []);
    const countBadge = document.getElementById('duSpreadsheetRowCountBadge');
    if (countBadge) {
      countBadge.textContent = `Showing ${filtered.length} of ${(currentAnalysisResult.properties || []).length} properties`;
    }

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="text-center text-muted py-3">No properties match the selected filter.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((p, idx) => {
        const sc = p.sourceCounts || {};
        const hazardPills = [];
        if (sc.fema) hazardPills.push(`<span class="source-badge source-fema">FEMA ×${sc.fema}</span>`);
        if (sc.firms) hazardPills.push(`<span class="source-badge source-firms">FIRMS ×${sc.firms}</span>`);
        if (sc.nhc) hazardPills.push(`<span class="source-badge source-nhc">NHC ×${sc.nhc}</span>`);
        if (sc.usgs) hazardPills.push(`<span class="source-badge source-usgs">USGS ×${sc.usgs}</span>`);
        if (sc.nws) hazardPills.push(`<span class="source-badge source-nws">NWS ×${sc.nws}</span>`);
        if (sc.floodzones) hazardPills.push(`<span class="source-badge source-floodzones">FLOOD ×${sc.floodzones}</span>`);

        const closest = p.closestDisaster
          ? `<div class="small text-muted mt-1">${escapeHtml(
              p.closestDisaster.title.slice(0, 58)
            )}${p.closestDisaster.title.length > 58 ? '…' : ''} ${
              p.closestDisaster.distanceMiles != null
                ? `<strong>(${p.closestDisaster.distanceMiles} mi)</strong>`
                : '<strong>(County)</strong>'
            }</div>`
          : '<span class="text-muted small">No active hazards within radius</span>';

        const fz = p.flood_zone || '—';
        const fzClass =
          fz.startsWith('A') || fz.startsWith('V')
            ? 'badge text-bg-primary'
            : 'badge text-bg-light text-dark border';

        return `<tr class="du-sp-row" data-loan-number="${escapeHtml(p.loan_number)}">
          <td>
            <div class="fw-semibold">${escapeHtml(p.loan_number)}</div>
            <div class="small text-muted">${escapeHtml(p.borrower_name)}</div>
          </td>
          <td>
            <div>${escapeHtml(p.property_address || '—')}</div>
            <div class="small text-muted">${escapeHtml(
              [p.city, p.county ? `${p.county} Co.` : '', p.state, p.zip_code].filter(Boolean).join(', ')
            )}</div>
          </td>
          <td class="text-end">
            <div class="fw-semibold">${formatCurrency(p.loan_amount)}</div>
            <div class="small text-muted">${escapeHtml(p.milestone)} · ${escapeHtml(p.loan_type || 'Conv')}</div>
          </td>
          <td class="text-center"><span class="${fzClass}">${escapeHtml(fz)}</span></td>
          <td>${getRiskTierBadgeHtml(p.riskTier, p.triageScore)}</td>
          <td>
            <div class="d-flex flex-wrap gap-1">${hazardPills.join('') || '<span class="badge text-bg-light text-muted border">0 Events</span>'}</div>
            ${closest}
          </td>
          <td>${getLenderStatusBadgeHtml(p.lenderRequirements)}</td>
          <td class="small">
            <div><strong>Collateral:</strong> ${escapeHtml(p.lenderRequirements?.collateralAction || '—')}</div>
            <div class="text-muted"><strong>Insurance:</strong> ${escapeHtml(p.lenderRequirements?.insuranceAction || '—')}</div>
            <div class="text-danger-emphasis"><strong>Gate:</strong> ${escapeHtml(p.lenderRequirements?.closingGate || '—')}</div>
          </td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-outline-primary du-sp-focus-btn" data-sp-idx="${idx}" title="Locate property on map and inspect county">
                <i class="bi bi-geo-alt"></i>
              </button>
              <button type="button" class="btn btn-outline-dark du-sp-checklist-btn" data-sp-idx="${idx}" title="View full lender underwriting &amp; closing checklist">
                <i class="bi bi-card-checklist"></i> Checklist
              </button>
            </div>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.du-sp-focus-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prop = filtered[Number(btn.getAttribute('data-sp-idx'))];
        if (prop) focusSpreadsheetPropertyOnMap(prop);
      });
    });

    tbody.querySelectorAll('.du-sp-checklist-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prop = filtered[Number(btn.getAttribute('data-sp-idx'))];
        if (prop) openPropertyLenderChecklistModal(prop);
      });
    });
  }

  function focusSpreadsheetPropertyOnMap(prop) {
    if (!prop) return;
    plotPortfolioOnMap(currentAnalysisResult?.properties || [prop], prop);
    const geoStage = document.getElementById('duGeoStage');
    geoStage?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof global.setDashboardStatus === 'function') {
      global.setDashboardStatus(
        `Focused ${prop.loan_number} (${prop.property_address}, ${prop.city}, ${prop.state}) — ${prop.riskTier} Risk · ${prop.lenderRequirements?.statusBadge || ''}`,
        prop.riskTier === 'Critical' || prop.riskTier === 'High' ? 'warning' : 'info'
      );
    }
  }

  function plotPortfolioOnMap(properties, focusProp = null) {
    const list = Array.isArray(properties) ? properties : currentAnalysisResult?.properties || [];
    const withCoords = list.filter(
      (p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    );
    if (!withCoords.length) {
      if (typeof global.setDashboardStatus === 'function') {
        global.setDashboardStatus('No coordinates on spreadsheet rows to plot on map.', 'warning');
      }
      return;
    }

    // Plot on Google Encompass Map if initialized
    if (global.map && typeof google !== 'undefined' && google.maps) {
      portfolioMapMarkers.forEach((m) => m.setMap?.(null));
      portfolioMapMarkers = [];
      const bounds = new google.maps.LatLngBounds();

      withCoords.forEach((p) => {
        const pos = { lat: Number(p.latitude), lng: Number(p.longitude) };
        bounds.extend(pos);
        const color =
          p.riskTier === 'Critical'
            ? '#dc2626'
            : p.riskTier === 'High'
              ? '#ea580c'
              : p.riskTier === 'Moderate'
                ? '#d97706'
                : '#16a34a';
        const marker = new google.maps.Marker({
          position: pos,
          map: global.map,
          title: `${p.loan_number} · ${p.borrower_name} (${p.riskTier})`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: 0.92,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        const info = new google.maps.InfoWindow({
          content: `<div style="min-width:220px;font-family:Inter,sans-serif">
            <strong>${escapeHtml(p.loan_number)} · ${escapeHtml(p.borrower_name)}</strong><br/>
            <span class="small text-muted">${escapeHtml(p.property_address)}, ${escapeHtml(p.city)}, ${escapeHtml(p.state)}</span><br/>
            <span class="small"><strong>Loan:</strong> ${formatCurrency(p.loan_amount)} (${escapeHtml(p.milestone)})</span><br/>
            <span class="small"><strong>Risk:</strong> ${escapeHtml(p.riskTier)} (${p.triageScore})</span><br/>
            <span class="small text-danger"><strong>Lender Action:</strong> ${escapeHtml(p.lenderRequirements?.statusBadge || '')}</span>
          </div>`,
        });
        marker.addListener('click', () => info.open(global.map, marker));
        portfolioMapMarkers.push(marker);
      });

      if (focusProp && Number.isFinite(Number(focusProp.latitude))) {
        global.map.setCenter({ lat: Number(focusProp.latitude), lng: Number(focusProp.longitude) });
        global.map.setZoom(11);
      } else {
        global.map.fitBounds(bounds);
      }
    }

    if (typeof global.setDashboardStatus === 'function') {
      global.setDashboardStatus(
        `Plotted ${withCoords.length} spreadsheet properties on the map.`,
        'success'
      );
    }
  }

  function openPropertyLenderChecklistModal(prop) {
    let modalEl = document.getElementById('duPropertyChecklistModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'duPropertyChecklistModal';
      modalEl.className = 'modal fade';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="duPropertyChecklistModalTitle">Lender Disaster Risk &amp; Underwriting Checklist</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="duPropertyChecklistModalBody"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modalEl);
    }

    const bodyEl = document.getElementById('duPropertyChecklistModalBody');
    const titleEl = document.getElementById('duPropertyChecklistModalTitle');
    if (titleEl) {
      titleEl.innerHTML = `<i class="bi bi-card-checklist me-2"></i>${escapeHtml(prop.loan_number)} · ${escapeHtml(prop.borrower_name)}`;
    }

    const checklistHtml = (prop.lenderRequirements?.checklist || [])
      .map(
        (item) => `<li class="list-group-item d-flex align-items-start gap-2">
          <i class="bi bi-check2-square text-primary mt-1"></i>
          <span>${escapeHtml(item)}</span>
        </li>`
      )
      .join('');

    const matchedHtml = (prop.matchedDisasters || []).length
      ? `<ul class="list-group list-group-flush small">
          ${prop.matchedDisasters
            .map(
              (d) => `<li class="list-group-item d-flex justify-content-between align-items-center">
                <span><strong>[${escapeHtml(String(d.source || '').toUpperCase())}]</strong> ${escapeHtml(d.title)}</span>
                <span class="badge text-bg-light border">${
                  d.distanceMiles != null ? `${d.distanceMiles} mi` : 'County match'
                }</span>
              </li>`
            )
            .join('')}
        </ul>`
      : '<p class="text-muted small mb-0">No active 90-day disasters matched within radius or county.</p>';

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <div class="p-3 rounded border bg-light-subtle h-100">
              <div class="small text-uppercase text-muted fw-semibold mb-1">Subject Property &amp; Loan</div>
              <div class="fw-bold">${escapeHtml(prop.property_address)}</div>
              <div class="small text-muted mb-2">${escapeHtml(
                [prop.city, prop.county ? `${prop.county} County` : '', prop.state, prop.zip_code]
                  .filter(Boolean)
                  .join(', ')
              )}</div>
              <div class="d-flex flex-wrap gap-2 small">
                <span class="badge text-bg-secondary">UPB: ${formatCurrency(prop.loan_amount)}</span>
                <span class="badge text-bg-secondary">Stage: ${escapeHtml(prop.milestone)}</span>
                <span class="badge text-bg-secondary">Type: ${escapeHtml(prop.loan_type || 'Conventional')}</span>
                <span class="badge text-bg-info text-dark">Flood Zone: ${escapeHtml(prop.flood_zone || 'X')}</span>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="p-3 rounded border bg-light-subtle h-100">
              <div class="small text-uppercase text-muted fw-semibold mb-1">Lender Determination</div>
              <div class="mb-2">${getRiskTierBadgeHtml(prop.riskTier, prop.triageScore)} ${getLenderStatusBadgeHtml(
                prop.lenderRequirements
              )}</div>
              <div class="small mb-1"><strong>Collateral:</strong> ${escapeHtml(
                prop.lenderRequirements?.collateralAction || ''
              )}</div>
              <div class="small mb-1"><strong>Insurance:</strong> ${escapeHtml(
                prop.lenderRequirements?.insuranceAction || ''
              )}</div>
              <div class="small text-danger-emphasis"><strong>Closing Gate:</strong> ${escapeHtml(
                prop.lenderRequirements?.closingGate || ''
              )}</div>
            </div>
          </div>
        </div>
        <h6 class="fw-semibold mb-2"><i class="bi bi-list-check me-1"></i>Required Underwriting &amp; Closing Conditions</h6>
        <ul class="list-group mb-3 small">${checklistHtml}</ul>
        <h6 class="fw-semibold mb-2"><i class="bi bi-broadcast-pin me-1"></i>Matched Hazard Events (${prop.matchedCount || 0})</h6>
        ${matchedHtml}
      `;
    }

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  function exportAnalyzedSpreadsheetCsv() {
    if (!currentAnalysisResult?.properties?.length) return;
    const headers = [
      'Loan Number',
      'Borrower Name',
      'Property Address',
      'City',
      'County',
      'State',
      'ZIP',
      'Loan Amount',
      'Milestone',
      'Loan Type',
      'Flood Zone',
      'Risk Tier',
      'Ops Triage Score',
      'FEMA Declared',
      'Matched Hazards Count',
      'Closest Hazard',
      'Closest Distance (mi)',
      'Status',
      'Collateral / Inspection Requirement',
      'Insurance Requirement',
      'Closing Gate',
    ];
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(csvEscape).join(',')];
    for (const p of currentAnalysisResult.properties) {
      lines.push(
        [
          p.loan_number,
          p.borrower_name,
          p.property_address,
          p.city,
          p.county,
          p.state,
          p.zip_code,
          p.loan_amount,
          p.milestone,
          p.loan_type,
          p.flood_zone,
          p.riskTier,
          p.triageScore,
          p.femaDeclared ? 'YES' : 'NO',
          p.matchedCount,
          p.closestDisaster?.title || 'None',
          p.closestDisaster?.distanceMiles ?? '',
          p.lenderRequirements?.statusBadge || '',
          p.lenderRequirements?.collateralAction || '',
          p.lenderRequirements?.insuranceAction || '',
          p.lenderRequirements?.closingGate || '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lender-property-disaster-risk-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateCsv() {
    const headers = [
      'Loan Number',
      'Borrower Name',
      'Property Address',
      'City',
      'County',
      'State',
      'ZIP',
      'Loan Amount',
      'Milestone',
      'Loan Type',
      'Flood Zone',
      'Latitude',
      'Longitude',
    ];
    const sampleRows = SAMPLE_LENDER_TAPE.slice(0, 4).map((r) => [
      r.loan_number,
      r.borrower_name,
      r.property_address,
      r.city,
      r.county,
      r.state,
      r.zip_code,
      r.loan_amount,
      r.milestone,
      r.loan_type,
      r.flood_zone,
      r.latitude,
      r.longitude,
    ]);
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(csvEscape).join(',')]
      .concat(sampleRows.map((row) => row.map(csvEscape).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property-disaster-risk-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(file) {
    if (!file) return;
    const name = String(file.name || '').toLowerCase();
    const statusEl = document.getElementById('duSpreadsheetStatus');

    try {
      if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
        const text = await file.text();
        const rows = parseDelimitedText(text);
        if (!rows.length) throw new Error('No property rows found in CSV/text file.');
        await runSpreadsheetAnalysis(rows);
        return;
      }

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (typeof global.XLSX === 'undefined') {
          throw new Error('Excel parser loading — please try again or upload a .csv file.');
        }
        const buf = await file.arrayBuffer();
        const wb = global.XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        const rows = global.XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });
        if (!rows.length) throw new Error('Workbook sheet is empty.');
        await runSpreadsheetAnalysis(rows);
        return;
      }

      throw new Error('Please upload an .xlsx, .xls, or .csv spreadsheet.');
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Could not parse spreadsheet.';
        statusEl.className = 'small text-danger fw-medium';
      }
    }
  }

  async function loadSampleLenderTapeAndAnalyze() {
    const section = document.getElementById('collapseSpreadsheet');
    if (section && typeof global.showDuDashboardSectionCard === 'function') {
      global.showDuDashboardSectionCard('collapseSpreadsheet');
    }
    const card = document.getElementById('duSpreadsheetSection');
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await runSpreadsheetAnalysis(SAMPLE_LENDER_TAPE);
  }

  function initSpreadsheetAnalyzerUi() {
    const fileInput = document.getElementById('duSpreadsheetFileInput');
    const dropZone = document.getElementById('duSpreadsheetDropZone');
    const sampleBtn = document.getElementById('duSpreadsheetSampleBtn');
    const heroSampleBtn = document.getElementById('duShowcaseSampleTapeBtn');
    const templateBtn = document.getElementById('duSpreadsheetTemplateBtn');
    const exportBtn = document.getElementById('duSpreadsheetExportBtn');
    const plotMapBtn = document.getElementById('duSpreadsheetPlotMapBtn');
    const pasteToggleBtn = document.getElementById('duSpreadsheetPasteToggleBtn');
    const pasteRunBtn = document.getElementById('duSpreadsheetPasteRunBtn');
    const radiusSelect = document.getElementById('duSpreadsheetRadiusSelect');
    const searchInput = document.getElementById('duSpreadsheetSearchInput');

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) void handleFileUpload(file);
    });

    if (dropZone) {
      dropZone.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select')) return;
        fileInput?.click();
      });
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('du-sp-dropzone--drag');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('du-sp-dropzone--drag');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('du-sp-dropzone--drag');
        const file = e.dataTransfer?.files?.[0];
        if (file) void handleFileUpload(file);
      });
    }

    sampleBtn?.addEventListener('click', () => void loadSampleLenderTapeAndAnalyze());
    heroSampleBtn?.addEventListener('click', () => void loadSampleLenderTapeAndAnalyze());
    templateBtn?.addEventListener('click', downloadTemplateCsv);
    exportBtn?.addEventListener('click', exportAnalyzedSpreadsheetCsv);
    plotMapBtn?.addEventListener('click', () => plotPortfolioOnMap());

    pasteToggleBtn?.addEventListener('click', () => {
      const wrap = document.getElementById('duSpreadsheetPasteWrap');
      if (wrap) wrap.hidden = !wrap.hidden;
    });

    pasteRunBtn?.addEventListener('click', () => {
      const ta = document.getElementById('duSpreadsheetPasteInput');
      const rows = parseDelimitedText(ta?.value || '');
      const statusEl = document.getElementById('duSpreadsheetStatus');
      if (!rows.length) {
        if (statusEl) {
          statusEl.textContent =
            'Include a header row (e.g. Loan Number, Borrower, Address, City, County, State, Loan Amount, Flood Zone) plus at least one property row.';
          statusEl.className = 'small text-warning fw-medium';
        }
        return;
      }
      void runSpreadsheetAnalysis(rows);
    });

    radiusSelect?.addEventListener('change', () => {
      if (lastRawRows.length) {
        void runSpreadsheetAnalysis(lastRawRows);
      }
    });

    searchInput?.addEventListener('input', () => {
      currentSearchQuery = String(searchInput.value || '').trim().toLowerCase();
      renderSpreadsheetTableRows();
    });

    document.querySelectorAll('[data-du-sp-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentFilterMode = btn.getAttribute('data-du-sp-filter') || 'all';
        document.querySelectorAll('[data-du-sp-filter]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        renderSpreadsheetTableRows();
      });
    });

    // Showcase quick-jump buttons
    document.getElementById('duShowcaseHotspotsBtn')?.addEventListener('click', () => {
      if (typeof global.showDuDashboardSectionCard === 'function') {
        global.showDuDashboardSectionCard('collapseRiskIntel');
      }
      document.getElementById('duRiskIntelCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('duShowcaseDemoLoadBtn')?.addEventListener('click', () => {
      const refRows = getShowcaseReferenceDisasters();
      const merged = (global.lastLoadedDisasterRows || []).length
        ? global.lastLoadedDisasterRows
        : refRows;
      if (!(global.lastLoadedDisasterRows || []).length && typeof global.finishDisastersLoad === 'function') {
        global.duCountyIntelLoaded = true;
        global.duMultiPanelMode = true;
        global.duGeoLoadScope = 'usa';
        global.finishDisastersLoad(merged);
      }
      if (typeof global.showDuDashboardSectionCard === 'function') {
        global.showDuDashboardSectionCard('collapseRiskIntel');
        global.showDuDashboardSectionCard('collapseSpreadsheet');
      }
      void loadSampleLenderTapeAndAnalyze();
    });
  }

  const api = {
    SAMPLE_LENDER_TAPE,
    getShowcaseReferenceDisasters,
    parseDelimitedText,
    buildLenderGuidanceForHotspot,
    runSpreadsheetAnalysis,
    loadSampleLenderTapeAndAnalyze,
    exportAnalyzedSpreadsheetCsv,
    downloadTemplateCsv,
    initSpreadsheetAnalyzerUi,
  };

  global.DuSpreadsheetAnalyzer = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
