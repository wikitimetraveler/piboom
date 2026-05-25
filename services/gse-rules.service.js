/**
 * Development work by David Lane
 */
/**
 * Data-driven eligibility hints (not underwriting).
 * @param {object} scenario normalized scenario
 * @param {object} productRow from fannie-products / freddie-products (full rules)
 */

const GUIDE_WARNINGS = {
  fannie: [
    'Confirm current Fannie Mae Selling Guide and SPC eligibility for this scenario.',
    'Do not rely on this tool for DU findings or approval.'
  ],
  freddie: [
    'Confirm current Freddie Mac Seller/Servicer Guide and bulletin eligibility for this scenario.',
    'Do not rely on this tool for LPA findings or approval.'
  ],
  va: [
    'Confirm current VA Lenders Handbook (VA Pamphlet 26-7) and VA circulars for this scenario.',
    'VA residual income, COE, and funding fee rules are not modeled in this prototype.'
  ],
  fha: [
    'Confirm current HUD FHA Handbook 4000.1 and applicable Mortgagee Letters.',
    'Do not rely on this tool for FHA TOTAL Scorecard or approval.'
  ],
  usda: [
    'Confirm current USDA HB-1-3555 handbook and USDA eligibility tools for this scenario.',
    'Do not rely on this tool for GUS findings or final USDA approval.'
  ]
};

function agencyKind(agency) {
  const a = String(agency || '').toLowerCase();
  if (a.includes('freddie')) return 'freddie';
  if (a.includes('fannie')) return 'fannie';
  if (a === 'va' || a.includes('veterans')) return 'va';
  if (a === 'fha' || a.includes('federal housing')) return 'fha';
  if (a === 'usda' || a.includes('agriculture') || a.includes('rural')) return 'usda';
  return 'fannie';
}

function isAgencyScoped(overlay = {}, agencyName = '') {
  const scopes = Array.isArray(overlay.agencyScope) ? overlay.agencyScope.map((x) => String(x).toLowerCase()) : [];
  if (!scopes.length) return true;
  const an = String(agencyName || '').toLowerCase();
  return scopes.some((s) => an.includes(s) || s.includes(an));
}

function evaluateOverlayCondition(overlay = {}, scenario = {}) {
  const cond = overlay.conditions || {};
  const loan = scenario.loan || {};
  const borrower = scenario.borrower || {};
  const risk = scenario.risk || {};
  const reasons = [];
  let applies = true;
  let passes = true;

  if (Array.isArray(cond.occupancy) && cond.occupancy.length) {
    applies = applies && cond.occupancy.includes(loan.occupancy);
  }
  if (Array.isArray(cond.purpose) && cond.purpose.length) {
    applies = applies && cond.purpose.includes(loan.purpose);
  }
  if (cond.manualUnderwriteOnly === true) {
    applies = applies && risk.manualUnderwrite === true;
  }
  if (cond.ltvAtLeast != null) {
    applies = applies && Number(loan.ltv) >= Number(cond.ltvAtLeast);
  }
  if (!applies) return { applies: false, passes: true, reasons: [] };

  if (cond.minFico != null && Number(borrower.creditScore) < Number(cond.minFico)) {
    passes = false;
    reasons.push(`Credit score ${borrower.creditScore} is below overlay minimum ${cond.minFico}.`);
  }
  if (cond.maxDti != null && Number(risk.dti) > Number(cond.maxDti)) {
    passes = false;
    reasons.push(`DTI ${risk.dti}% exceeds overlay maximum ${cond.maxDti}%.`);
  }
  if (cond.maxLtv != null && Number(loan.ltv) > Number(cond.maxLtv)) {
    passes = false;
    reasons.push(`LTV ${loan.ltv}% exceeds overlay maximum ${cond.maxLtv}%.`);
  }
  if (cond.minReservesMonths != null && Number(risk.reservesMonths) < Number(cond.minReservesMonths)) {
    passes = false;
    reasons.push(`Reserves ${risk.reservesMonths} months is below overlay minimum ${cond.minReservesMonths}.`);
  }
  return { applies: true, passes, reasons };
}

function buildOverlayFindings(scenario, productRow, overlayRows = []) {
  const findings = [];
  for (const row of overlayRows) {
    if (!row || !isAgencyScoped(row, productRow.agency)) continue;
    const out = evaluateOverlayCondition(row, scenario);
    if (!out.applies) continue;
    const severity = String(row.severity || 'advisory');
    const status = out.passes ? 'pass' : severity === 'hard-stop' ? 'hard-fail' : 'soft-fail';
    findings.push({
      id: row.id,
      investor: row.investor,
      title: row.title,
      overlayType: row.overlayType,
      severity,
      status,
      reasons: out.reasons,
      operationsNote: row.operationsNote || '',
      sourceRefs: Array.isArray(row.sourceRefs) ? row.sourceRefs : []
    });
  }
  return findings;
}

export function evaluateProduct(scenario, productRow, options = {}) {
  const { rules } = productRow;
  const overlayRows = Array.isArray(options.overlayRows) ? options.overlayRows : [];
  const reasons = [];
  const warnings = [...GUIDE_WARNINGS[agencyKind(productRow.agency)]];
  const nextSteps = [];
  const r = rules || {};
  let hardFails = 0;
  let softNotes = 0;

  const occ = scenario.loan.occupancy;
  const purpose = scenario.loan.purpose;
  const prop = scenario.loan.propertyType;
  const ltv = Number(scenario.loan.ltv);
  const cltv = Number(scenario.loan.cltv);
  const fico = Number(scenario.borrower.creditScore);
  const dti = Number(scenario.risk.dti);

  if ((r.allowedOccupancy || []).includes(occ)) {
    reasons.push(`Occupancy "${occ}" is commonly permitted for this product path (verify guide).`);
  } else {
    hardFails++;
    reasons.push(`Occupancy "${occ}" may not align with typical ${productRow.name} eligibility.`);
  }

  if ((r.allowedPurpose || []).includes(purpose)) {
    reasons.push(`Purpose "${purpose}" is within common allowed purposes (verify guide).`);
  } else {
    hardFails++;
    reasons.push(`Purpose "${purpose}" may not align with typical ${productRow.name} eligibility.`);
  }

  if ((r.allowedPropertyTypes || []).includes(prop)) {
    reasons.push(`Property type "${prop}" appears in allowed list for this prototype rule pack.`);
  } else {
    hardFails++;
    reasons.push(`Property type "${prop}" may require manual guide review.`);
  }

  const maxLtv = Number(r.maxLtvPrimaryPurchase ?? 97);
  if (purpose === 'purchase' && occ === 'primary' && ltv <= maxLtv) {
    reasons.push(`LTV ${ltv}% is at or below prototype max LTV ${maxLtv}% for primary purchase (confirm MI/LTV overlays in guide).`);
  } else if (ltv <= maxLtv) {
    reasons.push(`LTV ${ltv}% is at or below ${maxLtv}% prototype cap (confirm occupancy/purpose-specific limits in guide).`);
    softNotes++;
  } else {
    hardFails++;
    reasons.push(`LTV ${ltv}% exceeds prototype max ${maxLtv}% for this product.`);
  }

  const maxCltv = Number(r.maxCltv ?? 97);
  if (cltv <= maxCltv) {
    reasons.push(`CLTV ${cltv}% is at or below prototype max ${maxCltv}%.`);
  } else {
    hardFails++;
    reasons.push(`CLTV ${cltv}% exceeds prototype max ${maxCltv}%.`);
  }

  const minFico = Number(r.minFico ?? 620);
  if (fico >= minFico) {
    reasons.push(`Credit score ${fico} meets prototype minimum ${minFico} (guide/AUS may require higher).`);
  } else {
    hardFails++;
    reasons.push(`Credit score ${fico} is below prototype minimum ${minFico}.`);
  }

  const maxDti = Number(r.maxDti ?? 50);
  if (dti <= maxDti) {
    reasons.push(`DTI ${dti}% is at or below prototype max ${maxDti}% (AUS reserves may apply).`);
  } else {
    hardFails++;
    reasons.push(`DTI ${dti}% exceeds prototype max ${maxDti}%.`);
  }

  if (r.maxAmiPercent != null && scenario.borrower.amiPercent != null) {
    const ami = Number(scenario.borrower.amiPercent);
    const maxAmi = Number(r.maxAmiPercent);
    if (ami <= maxAmi) {
      reasons.push(`AMI ${ami}% is at or below ${maxAmi}% for affordable-product prototype check (confirm census tract limits).`);
    } else {
      hardFails++;
      reasons.push(`AMI ${ami}% exceeds prototype ${maxAmi}% threshold for this affordable product (confirm official income limit tools).`);
    }
    if (r.amiNote) warnings.push(r.amiNote);
  } else if (r.maxAmiPercent != null) {
    softNotes++;
    reasons.push('AMI percent not provided; affordable income limit could not be checked against prototype threshold.');
    warnings.push('Provide borrower AMI % (vs area median income) to assess HomeReady / Home Possible income-limit fit.');
  }

  if (r.firstTimeHomebuyerRequired === true && scenario.borrower.firstTimeHomebuyer !== true) {
    hardFails++;
    reasons.push('This product path generally requires first-time homebuyer status.');
  }

  if (r.usdaEligibleAreaRequired === true) {
    if (scenario.loan.usdaEligibleArea === true) {
      reasons.push('USDA-eligible area indicator is present (verify with USDA eligibility tool).');
    } else {
      softNotes++;
      reasons.push('USDA eligible-area flag is missing or false; verify property eligibility before recommending this path.');
      warnings.push('USDA products require current property-eligibility confirmation using USDA official tools.');
    }
  }

  const overlayFindings = buildOverlayFindings(scenario, productRow, overlayRows);
  const hardOverlayFails = overlayFindings.filter((f) => f.status === 'hard-fail').length;
  const softOverlayFails = overlayFindings.filter((f) => f.status === 'soft-fail').length;
  if (hardOverlayFails > 0) {
    hardFails += hardOverlayFails;
    warnings.push('One or more hard-stop investor overlays failed for this scenario.');
    nextSteps.push('Re-price with alternate investor or adjust scenario to satisfy hard-stop overlays.');
  }
  if (softOverlayFails > 0) {
    softNotes += softOverlayFails;
    warnings.push('This product has overlay exceptions/conditions to clear before lock.');
    nextSteps.push('Document compensating factors and obtain investor overlay exception guidance.');
  }

  let status = 'fit';
  if (hardFails >= 2) status = 'unlikely-fit';
  else if (hardFails === 1 || softNotes > 0) status = 'possible-fit';

  let score = 100 - hardFails * 25 - softNotes * 8;
  if (status === 'unlikely-fit') score = Math.min(score, 35);
  if (status === 'possible-fit') score = Math.min(score, 85);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const guidance = productRow.guidance || {};
  if (status !== 'unlikely-fit') {
    nextSteps.push('Run AUS and re-check investor overlay matrix before final product recommendation.');
  }

  return {
    agency: productRow.agency,
    product: productRow.name,
    productId: productRow.productId,
    status,
    score,
    reasons,
    warnings,
    sourceRefs: productRow.sourceRefs || [],
    overlayFindings,
    explanation: {
      whyFit: status === 'fit' ? `Scenario aligns with prototype ${productRow.name} constraints and active overlays reviewed.` : 'Scenario has some qualification friction but remains potentially executable.',
      whyFail: status === 'unlikely-fit' ? 'Multiple hard eligibility and/or overlay failures were detected.' : '',
      nextSteps: [...new Set(nextSteps)],
      overlayImpactSummary: overlayFindings
        .filter((f) => f.status !== 'pass')
        .map((f) => `${f.investor}: ${f.title}`)
    },
    contentGuide: {
      eligibilityNarrative: guidance.eligibilityNarrative || '',
      keyRequirements: guidance.keyRequirements || [],
      documentationExpectations: guidance.documentationExpectations || [],
      edgeCases: guidance.edgeCases || [],
      commonDenialReasons: guidance.commonDenialReasons || [],
      overlayCaveats: guidance.overlayCaveats || [],
      compensatingFactors: guidance.compensatingFactors || [],
      workflowNotes: guidance.workflowNotes || []
    }
  };
}
