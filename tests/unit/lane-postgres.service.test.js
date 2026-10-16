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
  getDirectDescendantLineIdsFromPostgres,
  queryLaneRelationshipsFromPostgres,
  getLaneRelationshipStatsFromPostgres
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

  test('relationship explorer query filters on book provenance with bound params', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            relationship_id: 7,
            relation: 'father',
            source_person_id: 20,
            target_person_id: 10,
            source_name: 'John Lane',
            source_birth_year: 1685,
            target_name: 'William Lane (II)',
            target_birth_year: 1659,
            provenance: { familyNo: 3, childOrder: 'I', pdfPage: 22 }
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const out = await queryLaneRelationshipsFromPostgres({
      relation: 'father',
      section: 'boston',
      familyNo: 3,
      q: "O'Brien",
      bookOnly: true,
      limit: 5000
    });

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("r.payload ? 'provenance'");
    expect(sql).toContain("r.payload->'provenance'->>'familyNo' = $3");
    expect(sql).toContain('LIMIT 500 OFFSET 0');
    expect(sql).not.toContain("O'Brien");
    expect(params).toEqual(['father', 'boston', '3', "%o'brien%"]);
    expect(out).toEqual({
      total: 1,
      limit: 500,
      offset: 0,
      relationships: [
        {
          id: 7,
          relation: 'father',
          source: { id: 20, name: 'John Lane', birthYear: 1685 },
          target: { id: 10, name: 'William Lane (II)', birthYear: 1659 },
          provenance: { familyNo: 3, childOrder: 'I', pdfPage: 22 }
        }
      ]
    });
  });

  test('relationship stats split book-coded vs legacy links', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ relation: 'father', total: 10, from_book: 4, confirmed: 2 }] })
      .mockResolvedValueOnce({ rows: [{ coded: 6 }] });
    await expect(getLaneRelationshipStatsFromPostgres()).resolves.toEqual({
      byRelation: [{ relation: 'father', total: 10, fromBook: 4, confirmed: 2 }],
      codedPeople: 6
    });
  });
});
