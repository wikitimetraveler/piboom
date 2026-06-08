/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const poolQuery = jest.fn();
const resolveArtistForGraph = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: poolQuery })
}));

await jest.unstable_mockModule('../../services/music-graph-musicbrainz.service.js', () => ({
  albumExternalId: (mbid, recordId) => (mbid ? mbid : `record:${recordId}`),
  artistExternalId: (mbid, name) => (mbid ? mbid : `slug:${String(name).toLowerCase().replace(/\s+/g, '-')}`),
  slugifyName: (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  resolveArtistForGraph
}));

const {
  initMusicGraphSchema,
  upsertNode,
  upsertEdge,
  seedCollectionGraph,
  getCollectionGraph
} = await import('../../services/music-graph.service.js');

function mockSchemaInit() {
  poolQuery.mockImplementation((sql) => {
    if (String(sql).includes('CREATE TABLE IF NOT EXISTS music_graph_nodes')) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('music-graph.service', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    resolveArtistForGraph.mockReset();
    mockSchemaInit();
  });

  test('initMusicGraphSchema creates music graph tables', async () => {
    await initMusicGraphSchema();

    expect(poolQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS music_graph_nodes'));
    expect(poolQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS music_graph_edges'));
  });

  test('upsertNode inserts artist node', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, node_type: 'artist', external_id: 'abc', label: 'Grateful Dead' }]
    });

    const node = await upsertNode({
      node_type: 'artist',
      external_id: 'abc',
      label: 'Grateful Dead'
    });

    expect(node.label).toBe('Grateful Dead');
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO music_graph_nodes'),
      expect.arrayContaining(['artist', 'abc', 'Grateful Dead'])
    );
  });

  test('upsertEdge validates node ids', async () => {
    await expect(
      upsertEdge({ from_node_id: 'x', to_node_id: 2, edge_type: 'HAS_ALBUM' })
    ).rejects.toThrow('from_node_id and to_node_id must be integers');
  });

  test('seedCollectionGraph skips when album nodes already exist', async () => {
    poolQuery.mockImplementation((sql) => {
      if (String(sql).includes('CREATE TABLE')) return Promise.resolve({ rows: [] });
      if (String(sql).includes('COUNT(*)::int AS count')) return Promise.resolve({ rows: [{ count: 3 }] });
      return Promise.resolve({ rows: [] });
    });

    const result = await seedCollectionGraph({ userId: 'cosmic-turtle', force: false });

    expect(result).toEqual({
      skipped: true,
      reason: 'Graph already seeded for scope',
      existing: { albumNodes: 3 }
    });
    expect(resolveArtistForGraph).not.toHaveBeenCalled();
  });

  test('seedCollectionGraph builds nodes from records', async () => {
    resolveArtistForGraph.mockResolvedValue({
      artist: { name: 'Grateful Dead', mbid: 'dead-mbid', type: 'Group', disambiguation: null },
      members: [{ name: 'Jerry Garcia', mbid: 'jerry-mbid', type: 'Person', instrument: 'guitar', begin: null, end: null }]
    });

    let insertCount = 0;
    poolQuery.mockImplementation((sql) => {
      const text = String(sql);
      if (text.includes('CREATE TABLE')) return Promise.resolve({ rows: [] });
      if (text.includes('COUNT(*)::int AS count')) return Promise.resolve({ rows: [{ count: 0 }] });
      if (text.includes('FROM records')) {
        return Promise.resolve({
          rows: [
            {
              id: 10,
              user_id: 'cosmic-turtle',
              artist: 'Grateful Dead',
              album: 'American Beauty',
              year: '1970',
              genre: 'Rock',
              label: 'Warner',
              musicbrainz_id: null,
              cover_url: null,
              rating: 5,
              storage_zone: 'C',
              storage_slot: 4
            }
          ]
        });
      }
      if (text.includes('FROM grateful_dead_shows')) return Promise.resolve({ rows: [] });
      if (text.includes('SELECT\n      (SELECT COUNT(*)::int FROM music_graph_nodes)')) {
        return Promise.resolve({ rows: [{ node_count: 4, edge_count: 2 }] });
      }
      if (text.includes('INSERT INTO music_graph_nodes') || text.includes('INSERT INTO music_graph_edges')) {
        insertCount += 1;
        return Promise.resolve({ rows: [{ id: insertCount }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await seedCollectionGraph({ userId: 'cosmic-turtle', force: false });

    expect(result.skipped).toBe(false);
    expect(result.recordsProcessed).toBe(1);
    expect(result.albums).toBe(1);
    expect(result.members).toBe(1);
    expect(resolveArtistForGraph).toHaveBeenCalledWith('Grateful Dead', null);
  });

  test('getCollectionGraph returns empty payload when no albums', async () => {
    poolQuery.mockImplementation((sql) => {
      const text = String(sql);
      if (text.includes('CREATE TABLE')) return Promise.resolve({ rows: [] });
      if (text.includes('COUNT(*)::int AS count')) return Promise.resolve({ rows: [{ count: 0 }] });
      if (text.includes('FROM records')) return Promise.resolve({ rows: [] });
      if (text.includes('SELECT id FROM music_graph_nodes')) return Promise.resolve({ rows: [] });
      if (text.includes('node_count')) return Promise.resolve({ rows: [{ node_count: 0, edge_count: 0 }] });
      return Promise.resolve({ rows: [] });
    });

    const graph = await getCollectionGraph('cosmic-turtle', 2);

    expect(graph).toEqual({
      userId: 'cosmic-turtle',
      depth: 2,
      nodes: [],
      edges: [],
      albumCount: 0
    });
  });
});
