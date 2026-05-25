/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { jest } from '@jest/globals';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({
    query: queryMock
  })
}));

const {
  getRelationshipsForPersonFromPostgres,
  getParentsForPersonFromPostgres,
  getChildrenForPersonFromPostgres,
  getSpousesForPersonFromPostgres,
  getDirectAncestorLineIdsFromPostgres,
  getDirectDescendantLineIdsFromPostgres
} = await import('../../services/lane-postgres.service.js');

describe('lane-postgres.service', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('maps relationship direction and person payload', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { relation: 'father', source_person_id: 10, target_person_id: 2, other_person: { id: 2, name: 'Parent' } },
        { relation: 'spouse', source_person_id: 8, target_person_id: 10, other_person: { id: 8, name: 'Spouse' } }
      ]
    });

    const rels = await getRelationshipsForPersonFromPostgres(10);
    expect(rels).toHaveLength(2);
    expect(rels[0]).toEqual({ relation: 'father', person: { id: 2, name: 'Parent' }, direction: 'from' });
    expect(rels[1]).toEqual({ relation: 'spouse', person: { id: 8, name: 'Spouse' }, direction: 'to' });
  });

  test('derives parents and spouses from relationship rows', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { relation: 'father', source_person_id: 10, target_person_id: 2, other_person: { id: 2, name: 'Parent A' } },
          { relation: 'mother', source_person_id: 10, target_person_id: 3, other_person: { id: 3, name: 'Parent B' } },
          { relation: 'spouse', source_person_id: 10, target_person_id: 9, other_person: { id: 9, name: 'Spouse' } }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { relation: 'father', source_person_id: 10, target_person_id: 2, other_person: { id: 2, name: 'Parent A' } },
          { relation: 'mother', source_person_id: 10, target_person_id: 3, other_person: { id: 3, name: 'Parent B' } },
          { relation: 'spouse', source_person_id: 10, target_person_id: 9, other_person: { id: 9, name: 'Spouse' } }
        ]
      });

    const parents = await getParentsForPersonFromPostgres(10);
    const spouses = await getSpousesForPersonFromPostgres(10);

    expect(parents.map((p) => p.person.name)).toEqual(['Parent A', 'Parent B']);
    expect(spouses.map((p) => p.name)).toEqual(['Spouse']);
  });

  test('gets children from parent-target edge lookup', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ child: { id: 20, name: 'Child A' } }, { child: { id: 21, name: 'Child B' } }]
    });
    const children = await getChildrenForPersonFromPostgres(10);
    expect(children.map((c) => c.name)).toEqual(['Child A', 'Child B']);
  });

  test('returns recursive CTE ids for ancestor/descendant helpers', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ person_id: 10, depth: 0 }, { person_id: 2, depth: 1 }] })
      .mockResolvedValueOnce({ rows: [{ person_id: 10, depth: 0 }, { person_id: 20, depth: 1 }] });

    await expect(getDirectAncestorLineIdsFromPostgres(10)).resolves.toEqual([10, 2]);
    await expect(getDirectDescendantLineIdsFromPostgres(10)).resolves.toEqual([10, 20]);
  });
});
