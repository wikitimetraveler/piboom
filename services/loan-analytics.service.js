/**
 * Development work by David Lane
 */
import { geocodeAddressAlternative } from './free-geocoding.service.js';

const ENABLE_LOAN_GEOCODING = process.env.ENABLE_LOAN_GEOCODING === 'true';
const geocodeCache = new Map();

const HOUSING_BUCKETS = [
  { id: 'lt25', label: '< 25%', max: 25 },
  { id: '25_30', label: '25% - 30%', min: 25, max: 30 },
  { id: '30_35', label: '30% - 35%', min: 30, max: 35 },
  { id: '35_40', label: '35% - 40%', min: 35, max: 40 },
  { id: 'gt40', label: '40%+', min: 40 },
];

const DTI_BUCKETS = [
  { id: 'lt30', label: '< 30%', max: 30 },
  { id: '30_36', label: '30% - 36%', min: 30, max: 36 },
  { id: '36_43', label: '36% - 43%', min: 36, max: 43 },
  { id: '43_50', label: '43% - 50%', min: 43, max: 50 },
  { id: 'gt50', label: '50%+', min: 50 },
];

const CREDIT_BUCKETS = [
  { id: '760_plus', label: '≥ 760', min: 760 },
  { id: '720_759', label: '720 - 759', min: 720, max: 760 },
  { id: '680_719', label: '680 - 719', min: 680, max: 720 },
  { id: '640_679', label: '640 - 679', min: 640, max: 680 },
  { id: 'sub_640', label: '< 640', max: 640 },
];

const UNKNOWN_BUCKET = { id: 'unknown', label: 'Unknown' };

function bucketize(value, buckets) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return UNKNOWN_BUCKET;
  }
  for (const bucket of buckets) {
    const min = bucket.min ?? -Infinity;
    const max = bucket.max ?? Infinity;
    if (value >= min && value < max) {
      return bucket;
    }
  }
  return buckets[buckets.length - 1] || UNKNOWN_BUCKET;
}

function buildPaymentStack(payments = {}) {
  const stack = [
    { id: 'principalInterest', label: 'Principal & Interest', value: payments.principalInterest },
    { id: 'hazardInsurance', label: 'Hazard Insurance', value: payments.hazardInsurance },
    { id: 'taxes', label: 'Taxes', value: payments.taxes },
    { id: 'mortgageInsurance', label: 'Mortgage Insurance', value: payments.mortgageInsurance },
    { id: 'hoa', label: 'HOA / Dues', value: payments.hoa },
    { id: 'other', label: 'Other', value: payments.other },
  ].filter((entry) => entry.value !== null && entry.value !== undefined);

  const total = stack.reduce((sum, entry) => sum + (entry.value || 0), 0);
  return { stack, total };
}

function computeFundingPressure(metrics = {}) {
  const { fundsRequired, reservesRequired, verifiedFunds, netCashBack } = metrics;
  const reserveGap =
    reservesRequired !== null && reservesRequired !== undefined && verifiedFunds !== null && verifiedFunds !== undefined
      ? reservesRequired - verifiedFunds
      : null;
  return {
    fundsRequired,
    reserveGap,
    netCashBack,
  };
}

function extractPrimaryScore(credit = {}) {
  return credit?.primary?.score ?? credit?.secondary?.score ?? null;
}

export function buildLoanAnalytics(normalizedLoan) {
  if (!normalizedLoan) {
    return {
      ratioBuckets: { housing: UNKNOWN_BUCKET, total: UNKNOWN_BUCKET },
      creditBucket: UNKNOWN_BUCKET.id,
      creditBucketLabel: UNKNOWN_BUCKET.label,
      paymentStack: buildPaymentStack(),
      fundingPressure: computeFundingPressure(),
      timeline: [],
    };
  }

  const ratioBuckets = {
    housing: bucketize(normalizedLoan.metrics?.housingRatio, HOUSING_BUCKETS),
    total: bucketize(normalizedLoan.metrics?.totalDTI, DTI_BUCKETS),
  };

  const creditBucket = bucketize(extractPrimaryScore(normalizedLoan.credit), CREDIT_BUCKETS);
  const paymentStack = buildPaymentStack(normalizedLoan.payments);

  const timeline = [];
  if (normalizedLoan.stage?.milestoneDate) {
    timeline.push({
      label: normalizedLoan.stage.milestone || 'Current Milestone',
      date: normalizedLoan.stage.milestoneDate,
      folder: normalizedLoan.stage.folder,
    });
  }

  return {
    ratioBuckets,
    creditBucket: creditBucket.id,
    creditBucketLabel: creditBucket.label,
    paymentStack,
    fundingPressure: computeFundingPressure(normalizedLoan.metrics),
    timeline,
  };
}

function incrementMap(map, key, amount = 1) {
  if (!key) return;
  const current = map.get(key) || 0;
  map.set(key, current + amount);
}

function mapToArray(map) {
  return Array.from(map.entries()).map(([id, value]) => ({ id, value }));
}

function sortDescending(arr, key = 'value', limit) {
  const sorted = [...arr].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

export function buildCalculatorSummary(loans = []) {
  const totals = {
    count: loans.length,
    volume: 0,
    housingRatioSum: 0,
    dtiSum: 0,
    ratioSamples: 0,
    dtiSamples: 0,
  };
  const ratioCounts = new Map();
  const creditCounts = new Map();
  const stageCounts = new Map();
  const channelCounts = new Map();
  const folderCounts = new Map();
  const actorLoadMaps = {
    loanOfficer: new Map(),
    processor: new Map(),
    underwriter: new Map(),
    closer: new Map(),
  };

  loans.forEach((loan) => {
    const metrics = loan.normalized?.metrics || {};
    const analytics = loan.analytics || {};
    const normalized = loan.normalized || {};

    if (metrics.loanAmount) {
      totals.volume += metrics.loanAmount;
    }

    if (metrics.housingRatio !== null && metrics.housingRatio !== undefined) {
      totals.housingRatioSum += metrics.housingRatio;
      totals.ratioSamples += 1;
    }

    if (metrics.totalDTI !== null && metrics.totalDTI !== undefined) {
      totals.dtiSum += metrics.totalDTI;
      totals.dtiSamples += 1;
    }

    incrementMap(ratioCounts, analytics.ratioBuckets?.total?.id || analytics.ratioBuckets?.housing?.id || 'unknown');
    incrementMap(creditCounts, analytics.creditBucket || 'unknown');
    incrementMap(stageCounts, normalized.stage?.milestone || normalized.stage?.folder || 'Unknown');
    incrementMap(channelCounts, normalized.channel || 'Unknown');
    incrementMap(folderCounts, normalized.stage?.folder || 'Unknown');

    const actorRefs = normalized.actors || {};
    ['loanOfficer', 'processor', 'underwriter', 'closer'].forEach((roleKey) => {
      const actor = actorRefs[roleKey];
      if (actor?.name) {
        incrementMap(actorLoadMaps[roleKey], actor.name);
      }
    });
  });

  const averageLoanAmount = totals.count ? totals.volume / totals.count : 0;
  const averageHousingRatio = totals.ratioSamples ? totals.housingRatioSum / totals.ratioSamples : null;
  const averageDTI = totals.dtiSamples ? totals.dtiSum / totals.dtiSamples : null;

  return {
    totals: {
      count: totals.count,
      totalVolume: Number(totals.volume.toFixed(2)),
      averageLoanAmount: Number(averageLoanAmount.toFixed(2)),
      averageHousingRatio,
      averageDTI,
    },
    ratioBuckets: sortDescending(mapToArray(ratioCounts)),
    creditBuckets: sortDescending(mapToArray(creditCounts)),
    stageBreakdown: sortDescending(mapToArray(stageCounts)),
    channelShare: sortDescending(mapToArray(channelCounts)),
    folderShare: sortDescending(mapToArray(folderCounts)),
    actorLoad: {
      loanOfficer: sortDescending(mapToArray(actorLoadMaps.loanOfficer), 'value', 5),
      processor: sortDescending(mapToArray(actorLoadMaps.processor), 'value', 5),
      underwriter: sortDescending(mapToArray(actorLoadMaps.underwriter), 'value', 5),
      closer: sortDescending(mapToArray(actorLoadMaps.closer), 'value', 5),
    },
  };
}

export function buildRatioSeries(loans = []) {
  const housingScatter = [];
  const dtiScatter = [];
  const housingBuckets = new Map();
  const dtiBuckets = new Map();

  loans.forEach((loan) => {
    const normalized = loan.normalized || {};
    const analytics = loan.analytics || {};
    const metrics = normalized.metrics || {};

    if (metrics.housingRatio !== null && metrics.housingRatio !== undefined) {
      housingScatter.push({
        loanGuid: normalized.guid || loan.loanGuid,
        loanNumber: normalized.number,
        value: metrics.housingRatio,
        bucket: analytics.ratioBuckets?.housing?.id || 'unknown',
        state: normalized.property?.state,
      });
      incrementMap(housingBuckets, analytics.ratioBuckets?.housing?.id || 'unknown');
    }

    if (metrics.totalDTI !== null && metrics.totalDTI !== undefined) {
      dtiScatter.push({
        loanGuid: normalized.guid || loan.loanGuid,
        loanNumber: normalized.number,
        value: metrics.totalDTI,
        bucket: analytics.ratioBuckets?.total?.id || 'unknown',
        state: normalized.property?.state,
      });
      incrementMap(dtiBuckets, analytics.ratioBuckets?.total?.id || 'unknown');
    }
  });

  return {
    housing: housingScatter,
    total: dtiScatter,
    bucketCounts: {
      housing: mapToArray(housingBuckets),
      total: mapToArray(dtiBuckets),
    },
  };
}

async function geocodeProperty(property = {}, geocodeBudget) {
  if (!ENABLE_LOAN_GEOCODING || !property) {
    return null;
  }
  const address = [property.street, property.city, property.state, property.postalCode].filter(Boolean).join(', ');
  if (!address) {
    return null;
  }

  const cacheKey = address.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (geocodeBudget.used >= geocodeBudget.max) {
    return null;
  }

  geocodeBudget.used += 1;
  const result = await geocodeAddressAlternative(address);
  const coordinates =
    result?.latitude && result?.longitude
      ? { latitude: Number(result.latitude), longitude: Number(result.longitude) }
      : null;
  geocodeCache.set(cacheKey, coordinates);
  return coordinates;
}

export async function buildMap3dDataset(loans = [], options = {}) {
  const geocodeBudget = {
    max: typeof options.maxGeocodes === 'number' ? options.maxGeocodes : 15,
    used: 0,
  };

  const features = [];
  for (const loan of loans) {
    const normalized = loan.normalized;
    if (!normalized) continue;

    let coordinates = normalized.property?.geo || null;
    if (!coordinates) {
      coordinates = await geocodeProperty(normalized.property, geocodeBudget);
    }

    if (!coordinates) {
      continue;
    }

    features.push({
      id: normalized.guid || loan.loanGuid,
      coordinates,
      altitude: normalized.metrics?.loanAmount || loan.analytics?.paymentStack?.total || 0,
      colorKey: loan.analytics?.creditBucket || 'unknown',
      properties: {
        loanNumber: normalized.number,
        loanAmount: normalized.metrics?.loanAmount,
        loanPurpose: normalized.loanPurpose,
        loanProgram: normalized.loanProgram,
        state: normalized.property?.state,
        county: normalized.property?.county,
        channel: normalized.channel,
        folder: normalized.stage?.folder,
      },
    });
  }

  return {
    count: features.length,
    features,
    geocodeRequestsUsed: geocodeBudget.used,
    geocodingEnabled: ENABLE_LOAN_GEOCODING,
  };
}

export function buildStackedCubeDataset(loans = []) {
  const groups = new Map();

  loans.forEach((loan) => {
    const normalized = loan.normalized || {};
    const state = normalized.property?.state || 'NA';
    const county = normalized.property?.county || 'Unknown';
    const key = `${state}::${county}`;

    if (!groups.has(key)) {
      groups.set(key, {
        state,
        county,
        loanCount: 0,
        totalLoanAmount: 0,
        paymentTotals: {
          principalInterest: 0,
          hazardInsurance: 0,
          taxes: 0,
          mortgageInsurance: 0,
          hoa: 0,
          other: 0,
        },
      });
    }

    const group = groups.get(key);
    group.loanCount += 1;
    group.totalLoanAmount += normalized.metrics?.loanAmount || 0;

    const paymentStack = loan.analytics?.paymentStack?.stack || [];
    paymentStack.forEach((entry) => {
      if (group.paymentTotals[entry.id] !== undefined) {
        group.paymentTotals[entry.id] += entry.value || 0;
      }
    });
  });

  const tiles = Array.from(groups.values()).map((group) => ({
    state: group.state,
    county: group.county,
    loanCount: group.loanCount,
    totalLoanAmount: Number(group.totalLoanAmount.toFixed(2)),
    averageLoanAmount: group.loanCount ? Number((group.totalLoanAmount / group.loanCount).toFixed(2)) : null,
    paymentStack: Object.entries(group.paymentTotals).map(([id, value]) => ({
      id,
      value: Number(value.toFixed(2)),
    })),
  }));

  return {
    groups: sortDescending(tiles, 'loanCount'),
  };
}

export function buildTimelineSeries(loans = []) {
  const events = loans
    .map((loan) => {
      const normalized = loan.normalized || {};
      if (!normalized.stage?.milestoneDate) {
        return null;
      }
      return {
        loanGuid: normalized.guid || loan.loanGuid,
        loanNumber: normalized.number,
        milestone: normalized.stage.milestone,
        folder: normalized.stage.folder,
        status: normalized.stage.status,
        milestoneDate: normalized.stage.milestoneDate,
        channel: normalized.channel,
        state: normalized.property?.state,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.milestoneDate) - new Date(b.milestoneDate));

  return { events };
}

export default {
  buildLoanAnalytics,
  buildCalculatorSummary,
  buildRatioSeries,
  buildMap3dDataset,
  buildStackedCubeDataset,
  buildTimelineSeries,
};

