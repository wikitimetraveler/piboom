/**
 * Development work by David Lane
 */
import {
  createPolicyEvent,
  listPolicyEvents,
  setPolicyStatus,
  updatePolicyEvent,
  deletePolicyEvent,
  removePolicyArea,
  appendPolicyAreas,
  updatePolicyAreas,
  resetDisasterPolicyMemoryForTests,
  classifyLoanAreaMatch,
  findLoanAreaMatches,
  describeImpactedLoans,
  buildImpactReport,
} from '../../services/disaster-policy.service.js';

function isoDaysFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loanRow(overrides = {}) {
  return {
    id: 1,
    loan_number: 'LN0000001',
    borrower_name: 'Test Borrower',
    property_address: '1 Main St',
    city: 'Miami',
    state: 'FL',
    county: 'Miami-Dade',
    zip_code: '33101',
    milestone: 'Processing',
    loan_amount: '250000.00',
    disaster_risk_score: 0,
    county_fips: null,
    ...overrides,
  };
}

describe('disaster-policy.service', () => {
  beforeEach(() => {
    resetDisasterPolicyMemoryForTests();
  });

  test('creates declared event with county areas', async () => {
    const event = await createPolicyEvent({
      kind: 'declared',
      status: 'active',
      eventName: 'Test DR',
      disasterType: 'Hurricane',
      femaDeclarationNumber: 'DR-9999',
      incidentBeginDate: '2026-11-01',
      areas: [
        { state: 'FL', countyCode: '12086', countyName: 'Miami-Dade' },
        { state: 'FL', countyCode: '12011', countyName: 'Broward' },
      ],
    });
    expect(event.id).toBeTruthy();
    expect(event.kind).toBe('declared');
    expect(event.areas).toHaveLength(2);
    expect(event.areas[0].countyCode).toBe('12086');

    const listed = await listPolicyEvents({ kind: 'declared' });
    expect(listed.some((e) => e.id === event.id)).toBe(true);
  });

  test('pending draft then activate sets treasury hold', async () => {
    const draft = await createPolicyEvent({
      kind: 'pending',
      status: 'draft',
      eventName: 'Approaching storm',
      areas: [{ state: 'LA', countyCode: '22071', countyName: 'Orleans' }],
    });
    expect(draft.status).toBe('draft');

    const active = await setPolicyStatus(draft.id, 'active');
    expect(active.status).toBe('active');
    expect(active.acmeTreasuryHold).toBe(true);
  });

  test('classifyLoanAreaMatch prefers FIPS over mismatched county name', () => {
    const areas = [{ state: 'FL', countyCode: '12086', countyName: 'Miami-Dade' }];
    expect(
      classifyLoanAreaMatch(
        { state: 'FL', county: 'Saint Lucie', county_fips: '12086' },
        areas
      )
    ).toBe('fips');
    expect(
      classifyLoanAreaMatch({ state: 'FL', county: 'Miami-Dade', county_fips: null }, areas)
    ).toBe('name');
    expect(
      classifyLoanAreaMatch({ state: 'FL', county: 'Orange', county_fips: '12095' }, areas)
    ).toBeNull();
  });

  test('update delete and area remove support full CRUD', async () => {
    const created = await createPolicyEvent({
      kind: 'declared',
      status: 'active',
      eventName: 'CRUD storm',
      areas: [
        { state: 'TX', countyCode: '48201', countyName: 'Harris' },
        { state: 'TX', countyCode: '48167', countyName: 'Galveston' },
      ],
    });
    const updated = await updatePolicyEvent(created.id, {
      eventName: 'CRUD storm renamed',
      acmeFundingSuspension: true,
    });
    expect(updated.eventName).toBe('CRUD storm renamed');
    expect(updated.acmeFundingSuspension).toBe(true);
    expect(updated.areas).toHaveLength(2);

    const afterRemove = await removePolicyArea(created.id, created.areas[0].id);
    expect(afterRemove.areas).toHaveLength(1);

    await expect(removePolicyArea(created.id, afterRemove.areas[0].id)).rejects.toMatchObject({
      code: 'AREAS_REQUIRED',
    });

    const del = await deletePolicyEvent(created.id);
    expect(del.deleted).toBe(true);
    const listed = await listPolicyEvents();
    expect(listed.some((e) => e.id === created.id)).toBe(false);
  });

  test('stores county and ZIP areas together and drops duplicates', async () => {
    const event = await createPolicyEvent({
      kind: 'declared',
      eventName: 'Mixed areas',
      areas: [
        { state: 'FL', countyCode: '12086', countyName: 'Miami-Dade' },
        { state: 'FL', countyCode: '12011', countyName: 'Broward', zipCode: '33301' },
        { state: 'FL', countyCode: '12011', countyName: 'Broward', zipCode: '33301' },
      ],
    });
    expect(event.areas.map((a) => a.zipCode)).toEqual([null, '33301']);

    const appended = await appendPolicyAreas(event.id, [
      { state: 'FL', countyCode: '12011', countyName: 'Broward', zipCode: '33301' },
      { state: 'FL', countyCode: '12011', countyName: 'Broward', zipCode: '33304' },
    ]);
    expect(appended.areas.map((a) => a.zipCode)).toEqual([null, '33301', '33304']);

    await expect(
      appendPolicyAreas(event.id, [
        { state: 'FL', countyCode: '12011', countyName: 'Broward', zipCode: '333' },
      ])
    ).rejects.toMatchObject({ code: 'ZIP_INVALID' });
  });

  test('a ZIP area matches on the property ZIP only, not the whole county', () => {
    const areas = [{ state: 'FL', countyCode: '12086', countyName: 'Miami-Dade', zipCode: '33101' }];
    expect(
      classifyLoanAreaMatch({ state: 'FL', county: 'Miami-Dade', zip_code: '33101-1234' }, areas)
    ).toBe('zip');
    expect(
      classifyLoanAreaMatch({ state: 'FL', county: 'Miami-Dade', zip_code: '33133' }, areas)
    ).toBeNull();
    expect(
      findLoanAreaMatches({ state: 'GA', county: 'Miami-Dade', zip_code: '33101' }, areas)
    ).toEqual([]);
  });

  test('sets Incident Period End Date per area and rejects a date before the begin date', async () => {
    const event = await createPolicyEvent({
      kind: 'pending',
      status: 'active',
      eventName: 'Hold with end dates',
      incidentBeginDate: '2026-11-10',
      areas: [
        { state: 'LA', countyCode: '22071', countyName: 'Orleans' },
        { state: 'LA', countyCode: '22051', countyName: 'Jefferson' },
      ],
    });
    const [orleans, jefferson] = event.areas;

    const ended = await updatePolicyAreas(event.id, {
      areaIds: [orleans.id],
      incidentEndDate: '2026-11-18',
    });
    expect(ended.areas.find((a) => a.id === orleans.id).incidentEndDate).toBe('2026-11-18');
    expect(ended.areas.find((a) => a.id === jefferson.id).incidentEndDate).toBeNull();

    const cleared = await updatePolicyAreas(event.id, { areaIds: [orleans.id], incidentEndDate: null });
    expect(cleared.areas.find((a) => a.id === orleans.id).incidentEndDate).toBeNull();

    await expect(
      updatePolicyAreas(event.id, { areaIds: [orleans.id], incidentEndDate: '2026-11-01' })
    ).rejects.toMatchObject({ code: 'END_BEFORE_BEGIN' });
    await expect(
      updatePolicyAreas(event.id, { areaIds: ['not-on-event'], incidentEndDate: '2026-11-18' })
    ).rejects.toMatchObject({ code: 'AREA_NOT_FOUND' });
    await expect(
      updatePolicyAreas(event.id, { areaIds: [orleans.id], incidentEndDate: 'soon' })
    ).rejects.toMatchObject({ code: 'DATE_INVALID' });
    await expect(updatePolicyAreas(event.id, { areaIds: [orleans.id] })).rejects.toMatchObject({
      code: 'AREA_PATCH_EMPTY',
    });
  });

  test('holds release for a loan once every area it sits in has passed its end date', () => {
    const areas = [
      { state: 'FL', countyCode: '12086', countyName: 'Miami-Dade', incidentEndDate: isoDaysFromToday(-1) },
      { state: 'FL', countyCode: '12011', countyName: 'Broward', incidentEndDate: isoDaysFromToday(5) },
      { state: 'FL', countyCode: '12099', countyName: 'Palm Beach', incidentEndDate: null },
    ];
    const rows = [
      loanRow({ id: 1, county: 'Miami-Dade' }),
      loanRow({ id: 2, county: 'Broward' }),
      loanRow({ id: 3, county: 'Palm Beach' }),
    ];
    const activeHold = { status: 'active', acmeTreasuryHold: true, acmeFundingSuspension: true };

    const impact = describeImpactedLoans(rows, areas, activeHold);
    expect(impact.loans.map((l) => l.treasuryHold)).toEqual([false, true, true]);
    expect(impact.loans.map((l) => l.fundingSuspension)).toEqual([false, true, true]);
    expect(impact.loans[0].incidentEndDate).toBe(isoDaysFromToday(-1));
    expect(impact.loans[1].incidentEndDate).toBeNull();
    expect(impact.report.totals).toMatchObject({ count: 3, treasuryHold: 2, fundingSuspension: 2 });

    const draft = describeImpactedLoans(rows, areas, { ...activeHold, status: 'draft' });
    expect(draft.loans.some((l) => l.treasuryHold || l.fundingSuspension)).toBe(false);
  });

  test('impact report groups pipeline by channel and milestone, with inventory and servicing apart', () => {
    const areas = [{ state: 'FL', countyCode: '12086', countyName: 'Miami-Dade' }];
    const rows = [
      loanRow({ id: 1, channel: 'Delegated', milestone: 'Underwriting', loan_amount: '100000' }),
      loanRow({ id: 2, channel: 'Non-Delegated', milestone: 'Application', loan_amount: '200000' }),
      loanRow({ id: 3, channel: 'Consumer Direct', milestone: 'Application', loan_amount: '300000' }),
      loanRow({ id: 4, channel: 'delegated', milestone: 'Application', loan_amount: '400000' }),
      loanRow({ id: 5, channel: null, milestone: 'Funded', loan_amount: '500000' }),
      loanRow({ id: 6, channel: 'Delegated', loan_book: 'Inventory', loan_amount: '600000' }),
      loanRow({ id: 7, loan_book: 'servicing', loan_amount: '700000' }),
    ];
    const { report, matchCounts, count } = describeImpactedLoans(rows, areas, { status: 'active' });

    expect(count).toBe(7);
    expect(matchCounts).toEqual({ byZip: 0, byFips: 0, byName: 7 });
    expect(report.totals).toMatchObject({ count: 7, amount: 2800000 });
    expect(report.pipeline).toMatchObject({ count: 5, amount: 1500000 });
    expect(report.pipeline.milestones).toEqual(['Application', 'Underwriting', 'Funded']);
    expect(report.pipeline.channels.map((c) => [c.id, c.count])).toEqual([
      ['delegated', 2],
      ['non_delegated', 1],
      ['consumer', 1],
      ['unassigned', 1],
    ]);
    expect(report.pipeline.channels[0].byMilestone).toEqual({
      Underwriting: { count: 1, amount: 100000 },
      Application: { count: 1, amount: 400000 },
    });
    expect(report.channelNotRecorded).toBe(1);
    expect(report.inventory).toEqual({ count: 1, amount: 600000 });
    expect(report.servicing).toEqual({ count: 1, amount: 700000 });
  });

  test('impact report always lists the three BRD channels and hides the empty catch-all', () => {
    const report = buildImpactReport([]);
    expect(report.pipeline.channels.map((c) => c.id)).toEqual(['delegated', 'non_delegated', 'consumer']);
    expect(report.totals.count).toBe(0);
  });

  test('rejects missing areas and bad kind', async () => {
    await expect(
      createPolicyEvent({ kind: 'declared', eventName: 'X', areas: [] })
    ).rejects.toMatchObject({ code: 'AREAS_REQUIRED' });

    await expect(
      createPolicyEvent({
        kind: 'nope',
        eventName: 'X',
        areas: [{ state: 'CA', countyCode: '06037', countyName: 'Los Angeles' }],
      })
    ).rejects.toMatchObject({ code: 'KIND_INVALID' });
  });
});
