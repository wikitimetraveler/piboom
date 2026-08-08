/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const poolQuery = jest.fn();
const isPostgisAvailable = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: poolQuery }),
  isPostgisAvailable,
  ensurePgvectorExtension: jest.fn().mockResolvedValue(false),
  isPgvectorAvailable: jest.fn().mockResolvedValue(false)
}));

await jest.unstable_mockModule('../../services/disasters.service.js', () => ({
  DISASTER_ROLLING_WINDOW_DAYS: 90
}));

await jest.unstable_mockModule('../../services/disaster-spatial.service.js', () => ({
  milesToMeters: (m) => m * 1609.34
}));

const { getDisasterEgoGraph } = await import('../../services/disaster-impact-graph.service.js');

function mockPoolForEgo({
  disasterNode,
  disasterNodeByExternalId,
  disastersLookup,
  traversal,
  nodes,
  edges,
  disasterCoords,
  loans
}) {
  poolQuery.mockImplementation(async (sql, params) => {
    const s = String(sql);
    if (s.includes('CREATE TABLE') || s.includes('CREATE INDEX') || s.includes('ALTER TABLE')) {
      return { rows: [] };
    }
    // Skip reseed when graph already has rows
    if (s.includes('AS node_count') && s.includes('AS edge_count')) {
      return { rows: [{ node_count: 1, edge_count: 1 }] };
    }
    if (s.includes("node_type = 'disaster_event'") && s.includes('external_id')) {
      const key = String(params?.[0] ?? '');
      if (disasterNodeByExternalId && Object.prototype.hasOwnProperty.call(disasterNodeByExternalId, key)) {
        const row = disasterNodeByExternalId[key];
        return { rows: row ? [row] : [] };
      }
      if (disasterNode && String(disasterNode.external_id) === key) {
        return { rows: [disasterNode] };
      }
      if (disasterNode && !disasterNodeByExternalId) {
        return { rows: key === String(disasterNode.external_id) ? [disasterNode] : [] };
      }
      return { rows: [] };
    }
    if (s.includes('FROM disasters') && s.includes('source_id') && s.includes('SELECT id, source_id, source')) {
      return { rows: disastersLookup ? [disastersLookup] : [] };
    }
    if (s.includes('WITH RECURSIVE walk')) {
      return { rows: traversal || [] };
    }
    if (s.includes('FROM graph_nodes WHERE id = ANY')) {
      return { rows: nodes || [] };
    }
    if (s.includes('FROM graph_edges WHERE id = ANY')) {
      return { rows: edges || [] };
    }
    if (s.includes('FROM disasters') && s.includes('lat')) {
      return { rows: disasterCoords ? [disasterCoords] : [] };
    }
    if (s.includes('FROM loans')) {
      return { rows: loans || [] };
    }
    return { rows: [] };
  });
}

describe('getDisasterEgoGraph', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    isPostgisAvailable.mockReset();
    isPostgisAvailable.mockResolvedValue(false);
  });

  test('returns found:false when disaster_event node missing', async () => {
    mockPoolForEgo({ disasterNode: null, disastersLookup: null });
    const result = await getDisasterEgoGraph('missing-event');
    expect(result.found).toBe(false);
    expect(result.nearLinks).toEqual([]);
    expect(result.disasterId).toBe('missing-event');
  });

  test('resolves via disasters.id when graph external_id is source_id', async () => {
    const seededAt = '2026-08-01T12:00:00.000Z';
    const disasterNode = {
      id: 10,
      node_type: 'disaster_event',
      external_id: '75407492',
      label: 'M 3.2 - Test',
      source: 'usgs',
      metadata_json: {}
    };
    mockPoolForEgo({
      disasterNodeByExternalId: {
        '99': null,
        '75407492': disasterNode
      },
      disastersLookup: { id: 99, source_id: '75407492', source: 'usgs' },
      traversal: [
        {
          node_id: 10,
          start_node_id: 10,
          depth: 0,
          node_path: [10],
          edge_path: [],
          via_edge_id: null
        }
      ],
      nodes: [disasterNode],
      edges: [],
      disasterCoords: { lat: 34.05, lng: -118.25 },
      loans: []
    });

    const result = await getDisasterEgoGraph('99', 2);
    expect(result.found).toBe(true);
    expect(result.disasterId).toBe('75407492');
    expect(result.requestedDisasterId).toBe('99');
    expect(result.startNodeId).toBe(10);
    expect(result.seededAtMax).toBeNull();
  });

  test('keeps explicit confidence 0 on NEAR edges (no NULLIF remap)', async () => {
    const seededAt = '2026-08-01T12:00:00.000Z';
    mockPoolForEgo({
      disasterNode: {
        id: 10,
        node_type: 'disaster_event',
        external_id: 'evt-1',
        label: 'Test Fire',
        source: 'firms',
        metadata_json: {}
      },
      traversal: [
        {
          node_id: 10,
          start_node_id: 10,
          depth: 0,
          node_path: [10],
          edge_path: [],
          via_edge_id: null
        },
        {
          node_id: 20,
          start_node_id: 10,
          depth: 1,
          node_path: [10, 20],
          edge_path: [100],
          via_edge_id: 100
        }
      ],
      nodes: [
        {
          id: 10,
          node_type: 'disaster_event',
          external_id: 'evt-1',
          label: 'Test Fire',
          source: 'firms',
          metadata_json: {}
        },
        {
          id: 20,
          node_type: 'loan',
          external_id: 'LN-1',
          label: 'Loan LN-1',
          source: 'loan-pipeline',
          metadata_json: {}
        }
      ],
      edges: [
        {
          id: 100,
          from_node_id: 10,
          to_node_id: 20,
          edge_type: 'NEAR',
          confidence: 0,
          source: 'postgis-spatial',
          metadata_json: {
            seeded_at: seededAt,
            distance_meters: 1609.34,
            proximity_channel: 'graph_near_seed'
          }
        }
      ],
      disasterCoords: { lat: 34.05, lng: -118.25 },
      loans: [
        {
          loan_number: 'LN-1',
          id: 1,
          latitude: 34.1,
          longitude: -118.3,
          disaster_risk_score: 4
        }
      ]
    });

    const result = await getDisasterEgoGraph('evt-1', 2);
    expect(result.found).toBe(true);
    expect(result.seededAtMax).toBe(seededAt);
    expect(result.edges[0].confidence).toBe(0);
    expect(result.nearLinks).toHaveLength(1);
    expect(result.nearLinks[0].confidence).toBe(0);
    expect(result.nearLinks[0].from.lat).toBe(34.05);
    expect(result.nearLinks[0].to.lat).toBe(34.1);
  });
});
