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
  resetDisasterPolicyMemoryForTests,
  classifyLoanAreaMatch,
} from '../../services/disaster-policy.service.js';

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
