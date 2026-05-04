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
  ]
};

function agencyKind(agency) {
  return String(agency || '').toLowerCase().includes('freddie') ? 'freddie' : 'fannie';
}

export function evaluateProduct(scenario, productRow) {
  const { rules } = productRow;
  const reasons = [];
  const warnings = [...GUIDE_WARNINGS[agencyKind(productRow.agency)]];
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

  let status = 'fit';
  if (hardFails >= 2) status = 'unlikely-fit';
  else if (hardFails === 1 || softNotes > 0) status = 'possible-fit';

  let score = 100 - hardFails * 25 - softNotes * 8;
  if (status === 'unlikely-fit') score = Math.min(score, 35);
  if (status === 'possible-fit') score = Math.min(score, 85);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    agency: productRow.agency,
    product: productRow.name,
    productId: productRow.productId,
    status,
    score,
    reasons,
    warnings,
    sourceRefs: productRow.sourceRefs || []
  };
}
