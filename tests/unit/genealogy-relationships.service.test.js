/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { jest } from '@jest/globals';

const pgQueryMock = jest.fn();
const pgStatsMock = jest.fn();

const BOOK = { source: 'lanegenealogies01chap.pdf', by: 'lane-genealogy-codes' };
const GRAPH = {
  nodes: [
    { id: 4, name: 'William Lane (I)', birthYear: 1625, gender: 'M', genealogyCode: { section: 'boston', familyNo: 1, familyKey: '1', label: 'No. 1 · Gen 1' } },
    { id: 10, name: 'William Lane (II)', birthYear: 1659, gender: 'M', genealogyCode: { section: 'boston', familyNo: 3, familyKey: '3', label: 'No. 3 · (3) III of No. 1 · Gen 2' } },
    { id: 19, name: 'Sarah Webster', birthYear: 1666, gender: 'F' },
    { id: 20, name: 'John Lane', birthYear: 1685, gender: 'M' },
    { id: 50, name: 'Isaac Lane', birthYear: 1765, gender: 'M' },
    { id: 51, name: 'John Lane', birthYear: 1734, gender: 'M' }
  ],
  links: [
    { source: 10, target: 4, relation: 'father', provenance: { ...BOOK, method: 'carry-forward', section: 'boston', familyNo: 1, childOrder: 'III', carryForwardNo: 3, pdfPage: 20, confirmed: true } },
    { source: 10, target: 19, relation: 'spouse', provenance: { ...BOOK, method: 'family-header', section: 'boston', familyNo: 3, pdfPage: 22 } },
    { source: 20, target: 10, relation: 'father', provenance: { ...BOOK, method: 'child-list', section: 'boston', familyNo: 3, childOrder: 'I', pdfPage: 22 } },
    { source: 20, target: 19, relation: 'mother' },
    { source: 50, target: 51, relation: 'father', provenance: { ...BOOK, method: 'child-list', section: 'buxton', familyNo: 3, childOrder: 'V', pdfPage: 274 } }
  ]
};

const REGISTER = {
  source: 'lanegenealogies01chap.pdf',
  generatedAt: '2026-10-14T00:00:00.000Z',
  legend: { familyNo: 'No. N', carryForwardNo: '(N)' },
  stats: { families: 3 },
  families: [
    { section: 'boston', familyNo: 1, familyKey: '1', pdfPage: 20, generation: 1, head: { name: 'William Lane', personId: 4 }, wives: [{ name: 'Mary', personId: null }], parentLink: null, children: [{ level: 1, order: 'III', name: 'William', birthYear: 1659, carryForwardNo: 3, personId: 10 }] },
    { section: 'boston', familyNo: 3, familyKey: '3', pdfPage: 22, generation: 2, head: { name: 'William Lane', pedigree: '(William)', birthYear: 1659, personId: 10 }, wives: [{ name: 'Sarah (Webster)', order: 1, personId: 19 }], parentLink: { familyNo: 1, childOrder: 'III', carryForwardNo: 3 }, children: [{ level: 1, order: 'I', name: 'John', birthYear: 1685, personId: 20 }, { level: 1, order: 'II', name: 'Sarah', birthYear: 1688, personId: null }] },
    { section: 'buxton', familyNo: 3, familyKey: '3', pdfPage: 274, generation: 3, head: { name: 'John Lane', personId: 51 }, wives: [], parentLink: null, children: [] }
  ],
  review: [
    { type: 'child', family: 'No. 3', name: 'Sarah', birthYear: 1688 },
    { type: 'child', family: 'Part II · Buxton Lane family · No. 3', name: 'Abig' }
  ]
};

await jest.unstable_mockModule('../../services/lane-postgres.service.js', () => ({
  backfillLaneDataFromFilesystem: jest.fn(async () => ({ imported: 0 })),
  getLaneGraphDataFromPostgres: jest.fn(async () => GRAPH),
  getAllLaneDatasetsFromPostgres: jest.fn(async () => ({ 'lane-genealogy-codes': REGISTER })),
  getLaneRelationshipStatsFromPostgres: pgStatsMock,
  queryLaneRelationshipsFromPostgres: pgQueryMock
}));

const {
  refreshGenealogyCachesFromPostgres,
  listRelationships,
  getRelationshipStats,
  getGenealogyCodeRegister,
  getFamilyStats,
  getRelationships
} = await import('../../services/genealogy.service.js');

describe('genealogy relationships API (service layer)', () => {
  beforeAll(async () => {
    const res = await refreshGenealogyCachesFromPostgres({ bootstrapFromFilesystem: false });
    expect(res.success).toBe(true);
  });

  beforeEach(() => {
    pgQueryMock.mockReset();
    pgStatsMock.mockReset();
  });

  test('listRelationships uses Postgres with normalized filters', async () => {
    pgQueryMock.mockResolvedValue({ total: 1, limit: 500, offset: 0, relationships: [{ id: 9, relation: 'father' }] });
    const out = await listRelationships({ relation: 'FATHER', section: 'boston', familyNo: '3', limit: '9999', bookOnly: '1', bogus: 'x' });
    expect(out.backend).toBe('postgres');
    expect(out.total).toBe(1);
    expect(pgQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ relation: 'father', section: 'boston', familyNo: 3, bookOnly: true, limit: 500, offset: 0 })
    );
  });

  test('listRelationships drops unknown relation/section values', async () => {
    pgQueryMock.mockResolvedValue({ total: 0, limit: 100, offset: 0, relationships: [] });
    const out = await listRelationships({ relation: 'cousin', section: 'mars' });
    expect(out.filters.relation).toBeNull();
    expect(out.filters.section).toBeNull();
  });

  test('listRelationships falls back to the in-memory graph when Postgres is unavailable', async () => {
    pgQueryMock.mockResolvedValue(null);
    const all = await listRelationships({ section: 'boston', familyNo: 3 });
    expect(all.backend).toBe('memory');
    expect(all.relationships.map((r) => [r.source.id, r.relation, r.target.id])).toEqual([
      [10, 'spouse', 19],
      [20, 'father', 10]
    ]);
    expect(all.relationships[1].provenance).toMatchObject({ childOrder: 'I', pdfPage: 22 });

    pgQueryMock.mockRejectedValue(new Error('db down'));
    const legacy = await listRelationships({ relation: 'mother' });
    expect(legacy.backend).toBe('memory');
    expect(legacy.relationships).toHaveLength(1);
    expect(legacy.relationships[0].provenance).toBeNull();

    const bookOnly = await listRelationships({ bookOnly: 'true', q: 'isaac' });
    expect(bookOnly.relationships.map((r) => r.source.id)).toEqual([50]);
  });

  test('getRelationshipStats: Postgres first, then in-memory breakdown', async () => {
    pgStatsMock.mockResolvedValue({ byRelation: [{ relation: 'father', total: 2, fromBook: 2, confirmed: 1 }], codedPeople: 2 });
    expect((await getRelationshipStats()).backend).toBe('postgres');

    pgStatsMock.mockResolvedValue(null);
    const mem = await getRelationshipStats();
    expect(mem.backend).toBe('memory');
    expect(mem.codedPeople).toBe(2);
    expect(mem.byRelation).toEqual([
      { relation: 'father', total: 3, fromBook: 3, confirmed: 1 },
      { relation: 'mother', total: 1, fromBook: 0, confirmed: 0 },
      { relation: 'spouse', total: 1, fromBook: 1, confirmed: 0 }
    ]);
  });

  test('/stats payload includes relationship breakdown and coded-people count', () => {
    const stats = getFamilyStats();
    expect(stats.totalRelationships).toBe(5);
    expect(stats.relationshipBreakdown.find((r) => r.relation === 'father')).toMatchObject({ total: 3, fromBook: 3 });
    expect(stats.genealogyCodes).toEqual({ codedPeople: 2, source: 'lanegenealogies01chap.pdf' });
  });

  test('person relationships carry book provenance for the modal', () => {
    const rels = getRelationships(10);
    const toFather = rels.find((r) => r.relation === 'father' && r.direction === 'from');
    expect(toFather.person.id).toBe(4);
    expect(toFather.provenance).toMatchObject({ carryForwardNo: 3, familyNo: 1 });
  });

  test('register index lists families with heads and parent family numbers', () => {
    const reg = getGenealogyCodeRegister({});
    expect(reg.source).toBe('lanegenealogies01chap.pdf');
    expect(reg.families).toHaveLength(3);
    expect(reg.families[1]).toMatchObject({ section: 'boston', familyKey: '3', parentFamilyNo: 1, childCount: 2, head: { personId: 10 } });
    expect(reg.sections.buxton).toMatch(/Buxton/);
  });

  test('register family detail resolves people, parent/child families, and section-scoped review', () => {
    const fam = getGenealogyCodeRegister({ section: 'boston', familyNo: '3' });
    expect(fam.family.head.person).toMatchObject({ id: 10, name: 'William Lane (II)' });
    expect(fam.family.wives[0].person).toMatchObject({ id: 19, name: 'Sarah Webster' });
    expect(fam.family.children[0].person).toMatchObject({ id: 20 });
    expect(fam.family.children[1].person).toBeNull();
    expect(fam.parentFamily).toMatchObject({ familyNo: 1, head: 'William Lane' });
    expect(fam.review).toEqual([{ type: 'child', family: 'No. 3', name: 'Sarah', birthYear: 1688 }]);

    const fromIndex = getGenealogyCodeRegister({ section: 'boston', familyNo: '1' });
    expect(fromIndex.childFamilies).toEqual([{ familyNo: 3, familyKey: '3', head: 'William Lane', pdfPage: 22 }]);

    expect(getGenealogyCodeRegister({ section: 'buxton', familyNo: '99' })).toBeNull();
  });
});
