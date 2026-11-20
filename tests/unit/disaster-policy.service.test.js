/**
 * Development work by David Lane
 */
import {
  createPolicyEvent,
  listPolicyEvents,
  setPolicyStatus,
  resetDisasterPolicyMemoryForTests,
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
    expect(active.amerihomeTreasuryHold).toBe(true);
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
