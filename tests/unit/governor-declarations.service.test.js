/**
 * Development work by David Lane
 */
import {
  listGovernorDeclarations,
  createGovernorDeclaration,
  updateGovernorDeclaration,
  deleteGovernorDeclaration,
  getGovernorDeclaration,
  syncGovernorDeclarationsFromOpenFema,
  aggregateOpenFemaDeclarations,
  resetGovernorDeclarationsMemoryForTests,
  threeMonthsAgoIso,
} from '../../services/governor-declarations.service.js';

describe('governor-declarations.service', () => {
  beforeEach(() => {
    resetGovernorDeclarationsMemoryForTests();
  });

  test('starts empty with no static seed file', async () => {
    const rows = await listGovernorDeclarations({ since: '2026-08-01' });
    expect(rows).toEqual([]);
  });

  test('creates, updates, and deletes a real staff governor order', async () => {
    const created = await createGovernorDeclaration({
      kind: 'governor_order',
      state: 'ca',
      declaredDate: '2026-11-20',
      declarationId: 'EO TEST-1',
      incidentTitle: 'Test flood emergency',
      incidentBeginDate: '2026-11-18',
      areaSummary: 'Los Angeles County',
      notes: 'unit test row',
    });
    expect(created.id).toBeTruthy();
    expect(created.state).toBe('CA');
    expect(created.kind).toBe('governor_order');
    expect(created.source).toBe('manual');

    const updated = await updateGovernorDeclaration(created.id, {
      notes: 'updated note',
      areaSummary: 'Los Angeles and Orange Counties',
    });
    expect(updated.notes).toBe('updated note');
    expect(updated.areaSummary).toContain('Orange');

    const ok = await deleteGovernorDeclaration(created.id);
    expect(ok).toBe(true);
    expect(await getGovernorDeclaration(created.id)).toBeNull();
  });

  test('rejects bad kind and bad date', async () => {
    await expect(
      createGovernorDeclaration({
        kind: 'not_a_kind',
        state: 'FL',
        declaredDate: '2026-11-01',
        incidentTitle: 'x',
      })
    ).rejects.toMatchObject({ code: 'KIND_INVALID' });

    await expect(
      createGovernorDeclaration({
        kind: 'federal_em',
        state: 'FL',
        declaredDate: '11/01/2026',
        incidentTitle: 'x',
      })
    ).rejects.toMatchObject({ code: 'DATE_INVALID' });
  });

  test('aggregateOpenFemaDeclarations collapses county rows', () => {
    const aggregated = aggregateOpenFemaDeclarations([
      {
        femaDeclarationString: 'DR-4955-FL',
        disasterNumber: 4955,
        state: 'FL',
        declarationType: 'DR',
        declarationDate: '2026-10-27T00:00:00.000Z',
        incidentBeginDate: '2026-10-06T00:00:00.000Z',
        declarationTitle: 'HURRICANE ISAIAS',
        designatedArea: 'Bay (County)',
      },
      {
        femaDeclarationString: 'DR-4955-FL',
        disasterNumber: 4955,
        state: 'FL',
        declarationType: 'DR',
        declarationDate: '2026-10-27T00:00:00.000Z',
        incidentBeginDate: '2026-10-06T00:00:00.000Z',
        declarationTitle: 'HURRICANE ISAIAS',
        designatedArea: 'Escambia (County)',
      },
    ]);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].declarationId).toBe('DR-4955-FL');
    expect(aggregated[0].kind).toBe('federal_dr');
    expect(aggregated[0].source).toBe('openfema');
    expect(aggregated[0].areaSummary).toMatch(/Bay|Escambia/);
  });

  test('syncGovernorDeclarationsFromOpenFema upserts live-shaped OpenFEMA rows', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        DisasterDeclarationsSummaries: [
          {
            femaDeclarationString: 'DR-4955-FL',
            disasterNumber: 4955,
            state: 'FL',
            declarationType: 'DR',
            declarationDate: '2026-10-27T00:00:00.000Z',
            incidentBeginDate: '2026-10-06T00:00:00.000Z',
            declarationTitle: 'HURRICANE ISAIAS',
            designatedArea: 'Bay (County)',
          },
          {
            femaDeclarationString: 'EM-3660-NM',
            disasterNumber: 3660,
            state: 'NM',
            declarationType: 'EM',
            declarationDate: '2026-10-26T00:00:00.000Z',
            incidentBeginDate: '2026-10-22T00:00:00.000Z',
            declarationTitle: 'SEVERE STORMS AND FLOODING',
            designatedArea: 'Cibola (County)',
          },
        ],
      }),
    });

    const first = await syncGovernorDeclarationsFromOpenFema({
      since: '2026-08-22',
      fetchImpl,
    });
    expect(first.error).toBeUndefined();
    expect(first.unique).toBe(2);
    expect(first.inserted).toBe(2);

    const listed = await listGovernorDeclarations({ since: '2026-08-22' });
    expect(listed).toHaveLength(2);
    expect(listed.every((r) => r.source === 'openfema')).toBe(true);

    const second = await syncGovernorDeclarationsFromOpenFema({
      since: '2026-08-22',
      fetchImpl,
    });
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(2);
  });

  test('default since filter uses threeMonthsAgoIso', async () => {
    const since = threeMonthsAgoIso(new Date('2026-11-22T12:00:00Z'));
    expect(since).toBe('2026-08-22');
  });
});
