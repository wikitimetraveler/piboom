/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { jest } from '@jest/globals';

const backfillMock = jest.fn();
const getGraphMock = jest.fn();
const getDatasetsMock = jest.fn();

await jest.unstable_mockModule('../../services/lane-postgres.service.js', () => ({
  backfillLaneDataFromFilesystem: backfillMock,
  getLaneGraphDataFromPostgres: getGraphMock,
  getAllLaneDatasetsFromPostgres: getDatasetsMock
}));

const {
  refreshGenealogyCachesFromPostgres,
  getAllFamilyData,
  getMuseumContent,
  getLaneBookSayings
} = await import('../../services/genealogy.service.js');

describe('genealogy.service postgres cache hydration', () => {
  beforeEach(() => {
    backfillMock.mockReset();
    getGraphMock.mockReset();
    getDatasetsMock.mockReset();
  });

  test('hydrates genealogy graph + dataset docs from Postgres cache', async () => {
    backfillMock.mockResolvedValue({ imported: 2, graphRebuilt: true });
    getGraphMock.mockResolvedValue({
      nodes: [{ id: 7001, name: 'PG Person', generation: 1 }],
      links: [{ source: 7001, target: 42, relation: 'father' }]
    });
    getDatasetsMock.mockResolvedValue({
      'lane-museum-content': {
        featuredStory: { slug: 'pg-story', title: 'From Postgres', summary: 'Hydrated' }
      },
      'lane-book-sayings': {
        version: 9,
        source: 'postgres',
        entries: [{ id: 's1', quote: 'Hello from PG' }]
      }
    });

    const result = await refreshGenealogyCachesFromPostgres({ bootstrapFromFilesystem: true });
    const family = getAllFamilyData();
    const museum = getMuseumContent();
    const sayings = getLaneBookSayings();

    expect(result.success).toBe(true);
    expect(family.nodes[0].name).toBe('PG Person');
    expect(museum.featuredStory.slug).toBe('pg-story');
    expect(sayings.version).toBe(9);
  });
});
