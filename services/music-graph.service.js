/**
 * Music graph — collection-seeded adjacency list (artist → album → venue → show → member).
 */
import { getPool } from './database.service.js';
import {
  albumExternalId,
  artistExternalId,
  resolveArtistForGraph,
  slugifyName
} from './music-graph-musicbrainz.service.js';

const VALID_NODE_TYPES = new Set(['artist', 'album', 'venue', 'show', 'member']);

const VALID_EDGE_TYPES = new Set([
  'HAS_ALBUM',
  'MEMBER_OF',
  'PERFORMED_AT',
  'PERFORMED_BY',
  'RECORDING_OF'
]);

const DEFAULT_SOURCE = 'music-graph';
const DEFAULT_MAX_DEPTH = 3;
const MAX_GRAPH_DEPTH = 6;

let graphReadyPromise = null;

function normalizeNodeType(nodeType) {
  const normalized = String(nodeType || '').trim().toLowerCase();
  if (!VALID_NODE_TYPES.has(normalized)) {
    throw new Error(`Invalid node_type: ${nodeType}`);
  }
  return normalized;
}

function normalizeEdgeType(edgeType) {
  const normalized = String(edgeType || '').trim().toUpperCase();
  if (!VALID_EDGE_TYPES.has(normalized)) {
    throw new Error(`Invalid edge_type: ${edgeType}`);
  }
  return normalized;
}

function clampDepth(depth = DEFAULT_MAX_DEPTH) {
  const parsed = parseInt(depth, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_DEPTH;
  return Math.max(1, Math.min(MAX_GRAPH_DEPTH, parsed));
}

function parseConfidence(confidence) {
  if (confidence === undefined || confidence === null || confidence === '') return 0.8;
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error('confidence must be a number between 0 and 1');
  }
  return parsed;
}

function ensurePool() {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

function venueExternalId(name, city, state) {
  const parts = [name, city, state].map((v) => String(v || '').trim()).filter(Boolean);
  return `venue:${parts.join('|')}`;
}

function showExternalId(kind, id) {
  return `${kind}:${id}`;
}

export async function initMusicGraphSchema() {
  const pool = ensurePool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS music_graph_nodes (
      id BIGSERIAL PRIMARY KEY,
      node_type TEXT NOT NULL,
      external_id TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '${DEFAULT_SOURCE}',
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_music_graph_nodes_type CHECK (node_type IN (
        'artist', 'album', 'venue', 'show', 'member'
      )),
      CONSTRAINT uq_music_graph_nodes UNIQUE (node_type, external_id, source)
    );

    CREATE TABLE IF NOT EXISTS music_graph_edges (
      id BIGSERIAL PRIMARY KEY,
      from_node_id BIGINT NOT NULL REFERENCES music_graph_nodes(id) ON DELETE CASCADE,
      to_node_id BIGINT NOT NULL REFERENCES music_graph_nodes(id) ON DELETE CASCADE,
      edge_type TEXT NOT NULL,
      confidence NUMERIC(5,4) NOT NULL DEFAULT 0.8000,
      source TEXT NOT NULL DEFAULT '${DEFAULT_SOURCE}',
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_music_graph_edges_type CHECK (edge_type IN (
        'HAS_ALBUM', 'MEMBER_OF', 'PERFORMED_AT', 'PERFORMED_BY', 'RECORDING_OF'
      )),
      CONSTRAINT chk_music_graph_edges_confidence CHECK (confidence >= 0 AND confidence <= 1),
      CONSTRAINT uq_music_graph_edges UNIQUE (from_node_id, to_node_id, edge_type, source)
    );

    CREATE INDEX IF NOT EXISTS idx_music_graph_nodes_type_external
      ON music_graph_nodes(node_type, external_id);
    CREATE INDEX IF NOT EXISTS idx_music_graph_nodes_metadata
      ON music_graph_nodes USING GIN (metadata_json);
    CREATE INDEX IF NOT EXISTS idx_music_graph_edges_from ON music_graph_edges(from_node_id);
    CREATE INDEX IF NOT EXISTS idx_music_graph_edges_to ON music_graph_edges(to_node_id);
    CREATE INDEX IF NOT EXISTS idx_music_graph_edges_type ON music_graph_edges(edge_type);
    CREATE INDEX IF NOT EXISTS idx_music_graph_edges_metadata
      ON music_graph_edges USING GIN (metadata_json);
  `);
}

export async function upsertNode(node) {
  if (!node || typeof node !== 'object') throw new Error('node payload is required');

  const pool = ensurePool();
  const nodeType = normalizeNodeType(node.node_type);
  const externalId = String(node.external_id || '').trim();
  const label = String(node.label || externalId || nodeType).trim();
  if (!label) throw new Error('label is required');
  const source = String(node.source || DEFAULT_SOURCE).trim();
  const metadata = node.metadata_json && typeof node.metadata_json === 'object' ? node.metadata_json : {};

  const { rows } = await pool.query(
    `
    INSERT INTO music_graph_nodes (node_type, external_id, label, source, metadata_json, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
    ON CONFLICT (node_type, external_id, source)
    DO UPDATE SET
      label = EXCLUDED.label,
      metadata_json = music_graph_nodes.metadata_json || EXCLUDED.metadata_json,
      updated_at = NOW()
    RETURNING *;
    `,
    [nodeType, externalId, label, source, JSON.stringify(metadata)]
  );
  return rows[0];
}

export async function upsertEdge(edge) {
  if (!edge || typeof edge !== 'object') throw new Error('edge payload is required');

  const pool = ensurePool();
  const fromNodeId = Number(edge.from_node_id);
  const toNodeId = Number(edge.to_node_id);
  if (!Number.isInteger(fromNodeId) || !Number.isInteger(toNodeId)) {
    throw new Error('from_node_id and to_node_id must be integers');
  }

  const edgeType = normalizeEdgeType(edge.edge_type);
  const confidence = parseConfidence(edge.confidence);
  const source = String(edge.source || DEFAULT_SOURCE).trim();
  const metadata = edge.metadata_json && typeof edge.metadata_json === 'object' ? edge.metadata_json : {};

  const { rows } = await pool.query(
    `
    INSERT INTO music_graph_edges (from_node_id, to_node_id, edge_type, confidence, source, metadata_json)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (from_node_id, to_node_id, edge_type, source)
    DO UPDATE SET
      confidence = EXCLUDED.confidence,
      metadata_json = EXCLUDED.metadata_json
    RETURNING *;
    `,
    [fromNodeId, toNodeId, edgeType, confidence, source, JSON.stringify(metadata)]
  );
  return rows[0];
}

async function getTraversalRows(startNodeId, depth = DEFAULT_MAX_DEPTH) {
  const pool = ensurePool();
  const maxDepth = clampDepth(depth);

  const { rows } = await pool.query(
    `
    WITH RECURSIVE walk AS (
      SELECT
        n.id AS node_id,
        n.id AS start_node_id,
        0::int AS depth,
        ARRAY[n.id]::bigint[] AS node_path,
        ARRAY[]::bigint[] AS edge_path,
        NULL::bigint AS via_edge_id
      FROM music_graph_nodes n
      WHERE n.id = $1

      UNION ALL

      SELECT
        CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END AS node_id,
        w.start_node_id,
        w.depth + 1 AS depth,
        w.node_path || CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END,
        w.edge_path || e.id,
        e.id AS via_edge_id
      FROM walk w
      JOIN music_graph_edges e ON (e.from_node_id = w.node_id OR e.to_node_id = w.node_id)
      WHERE w.depth < $2
        AND NOT (
          CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END = ANY(w.node_path)
        )
    )
    SELECT * FROM walk;
    `,
    [Number(startNodeId), maxDepth]
  );
  return rows;
}

async function buildGraphPayload(startNodeId, depth) {
  const pool = ensurePool();
  const traversalRows = await getTraversalRows(startNodeId, depth);

  if (!traversalRows.length) {
    throw new Error(`Start node not found: ${startNodeId}`);
  }

  const nodeIds = [...new Set(traversalRows.map((row) => Number(row.node_id)).filter(Number.isFinite))];
  const edgeIds = [
    ...new Set(traversalRows.flatMap((row) => row.edge_path || []).map(Number).filter(Number.isFinite))
  ];

  const nodes = nodeIds.length
    ? (await pool.query(`SELECT * FROM music_graph_nodes WHERE id = ANY($1::bigint[]) ORDER BY id`, [nodeIds]))
        .rows
    : [];

  const edges = edgeIds.length
    ? (await pool.query(`SELECT * FROM music_graph_edges WHERE id = ANY($1::bigint[]) ORDER BY id`, [edgeIds]))
        .rows
    : [];

  return {
    startNodeId: Number(startNodeId),
    depth: clampDepth(depth),
    nodes,
    edges,
    paths: traversalRows
      .filter((row) => Number(row.depth) > 0)
      .map((row) => ({
        nodeId: Number(row.node_id),
        depth: Number(row.depth),
        nodePath: row.node_path || [],
        edgePath: row.edge_path || []
      }))
  };
}

export async function getMusicGraph(startNodeId, depth = DEFAULT_MAX_DEPTH) {
  await ensureMusicGraphReady();
  return buildGraphPayload(startNodeId, depth);
}

export async function summarizeMusicGraph(startNodeId, depth = DEFAULT_MAX_DEPTH) {
  await ensureMusicGraphReady();
  const graph = await buildGraphPayload(startNodeId, depth);

  const nodeTypeCounts = {};
  for (const node of graph.nodes) {
    nodeTypeCounts[node.node_type] = (nodeTypeCounts[node.node_type] || 0) + 1;
  }

  const edgeTypeCounts = {};
  for (const edge of graph.edges) {
    edgeTypeCounts[edge.edge_type] = (edgeTypeCounts[edge.edge_type] || 0) + 1;
  }

  return {
    startNodeId: graph.startNodeId,
    depth: graph.depth,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodeTypeCounts,
    edgeTypeCounts
  };
}

async function findNodeByTypeAndExternalId(nodeType, externalId, source = DEFAULT_SOURCE) {
  const pool = ensurePool();
  const { rows } = await pool.query(
    `
    SELECT * FROM music_graph_nodes
    WHERE node_type = $1 AND external_id = $2 AND source = $3
    ORDER BY id LIMIT 1
    `,
    [nodeType, externalId, source]
  );
  return rows[0] || null;
}

export async function findArtistNode(key) {
  await ensureMusicGraphReady();
  const raw = String(key || '').trim();
  if (!raw) return null;

  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    return findNodeByTypeAndExternalId('artist', raw);
  }

  const slugKey = raw.startsWith('slug:') ? raw : `slug:${slugifyName(raw)}`;
  return findNodeByTypeAndExternalId('artist', slugKey);
}

async function countCollectionAlbumNodes(userId) {
  const pool = ensurePool();
  const params = [];
  let where = `node_type = 'album' AND metadata_json ? 'recordId'`;

  if (userId) {
    params.push(userId);
    where += ` AND metadata_json->>'userId' = $1`;
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM music_graph_nodes WHERE ${where}`,
    params
  );
  return rows[0]?.count || 0;
}

async function fetchCollectionRecords(userId) {
  const pool = ensurePool();
  const params = [];
  let where = '';

  if (userId) {
    params.push(userId);
    where = 'WHERE user_id = $1';
  }

  const { rows } = await pool.query(
    `
    SELECT id, user_id, artist, album, year, genre, label, musicbrainz_id,
           cover_url, rating, storage_zone, storage_slot
    FROM records
    ${where}
    ORDER BY artist, album
    `,
    params
  );
  return rows;
}

function isGratefulDeadArtist(name) {
  return slugifyName(name) === 'grateful-dead';
}

async function seedGratefulDeadShows(artistNodeId) {
  const pool = ensurePool();
  const { rows } = await pool.query(
    `
    SELECT id, show_date, venue_name, city, state, country, latitude, longitude
    FROM grateful_dead_shows
    ORDER BY show_date DESC
    LIMIT 500
    `
  );

  let showCount = 0;
  for (const row of rows) {
    const venueNode = await upsertNode({
      node_type: 'venue',
      external_id: venueExternalId(row.venue_name, row.city, row.state),
      label: [row.venue_name, row.city, row.state].filter(Boolean).join(', '),
      source: 'grateful-dead',
      metadata_json: {
        city: row.city,
        state: row.state,
        country: row.country,
        latitude: row.latitude,
        longitude: row.longitude
      }
    });

    const showNode = await upsertNode({
      node_type: 'show',
      external_id: showExternalId('gd', row.id),
      label: `${row.show_date} @ ${row.venue_name}`,
      source: 'grateful-dead',
      metadata_json: {
        showDate: row.show_date,
        venueName: row.venue_name,
        city: row.city,
        state: row.state
      }
    });

    await upsertEdge({
      from_node_id: showNode.id,
      to_node_id: venueNode.id,
      edge_type: 'PERFORMED_AT',
      confidence: 1.0,
      source: 'grateful-dead'
    });

    await upsertEdge({
      from_node_id: showNode.id,
      to_node_id: artistNodeId,
      edge_type: 'PERFORMED_BY',
      confidence: 1.0,
      source: 'grateful-dead'
    });

    showCount += 1;
  }

  return showCount;
}

async function seedConcertsForArtist(artistNodeId, artistName) {
  const pool = ensurePool();
  const { rows } = await pool.query(
    `
    SELECT c.id, c.concert_date, c.tour_name,
           v.name AS venue_name, v.city, v.state, v.country, v.latitude, v.longitude,
           a.name AS artist_name
    FROM concerts c
    JOIN venues v ON v.id = c.venue_id
    JOIN artists a ON a.id = c.artist_id
    WHERE LOWER(a.name) = LOWER($1)
    ORDER BY c.concert_date DESC
    LIMIT 200
    `,
    [artistName]
  );

  let showCount = 0;
  for (const row of rows) {
    const venueNode = await upsertNode({
      node_type: 'venue',
      external_id: venueExternalId(row.venue_name, row.city, row.state),
      label: [row.venue_name, row.city, row.state].filter(Boolean).join(', '),
      source: 'concerts',
      metadata_json: {
        city: row.city,
        state: row.state,
        country: row.country,
        latitude: row.latitude,
        longitude: row.longitude
      }
    });

    const showNode = await upsertNode({
      node_type: 'show',
      external_id: showExternalId('concert', row.id),
      label: `${row.concert_date} @ ${row.venue_name}`,
      source: 'concerts',
      metadata_json: {
        showDate: row.concert_date,
        tourName: row.tour_name,
        venueName: row.venue_name
      }
    });

    await upsertEdge({
      from_node_id: showNode.id,
      to_node_id: venueNode.id,
      edge_type: 'PERFORMED_AT',
      confidence: 1.0,
      source: 'concerts'
    });

    await upsertEdge({
      from_node_id: showNode.id,
      to_node_id: artistNodeId,
      edge_type: 'PERFORMED_BY',
      confidence: 1.0,
      source: 'concerts'
    });

    showCount += 1;
  }

  return showCount;
}

export async function seedCollectionGraph(options = {}) {
  const pool = ensurePool();
  await initMusicGraphSchema();

  const userId = options.userId != null ? String(options.userId).trim() : null;
  const force = options.force === true;

  if (!force) {
    const existing = await countCollectionAlbumNodes(userId);
    if (existing > 0) {
      return {
        skipped: true,
        reason: 'Graph already seeded for scope',
        existing: { albumNodes: existing }
      };
    }
  }

  const records = await fetchCollectionRecords(userId);
  const artistNodeIdByName = new Map();
  let albumCount = 0;
  let memberCount = 0;
  let showCount = 0;

  async function ensureArtistNode(artistName) {
    const key = slugifyName(artistName);
    if (artistNodeIdByName.has(key)) {
      return artistNodeIdByName.get(key);
    }

    const { artist, members } = await resolveArtistForGraph(artistName, null);
    const artistNode = await upsertNode({
      node_type: 'artist',
      external_id: artistExternalId(artist.mbid, artist.name),
      label: artist.name || artistName,
      source: artist.mbid ? 'musicbrainz' : 'records',
      metadata_json: {
        artistName: artist.name || artistName,
        mbid: artist.mbid || null,
        type: artist.type || null,
        disambiguation: artist.disambiguation || null
      }
    });

    for (const member of members) {
      const memberNode = await upsertNode({
        node_type: 'member',
        external_id: artistExternalId(member.mbid, member.name),
        label: member.name,
        source: 'musicbrainz',
        metadata_json: {
          mbid: member.mbid,
          type: member.type,
          instrument: member.instrument
        }
      });

      await upsertEdge({
        from_node_id: memberNode.id,
        to_node_id: artistNode.id,
        edge_type: 'MEMBER_OF',
        confidence: 0.9,
        source: 'musicbrainz',
        metadata_json: {
          instrument: member.instrument,
          begin: member.begin,
          end: member.end
        }
      });
      memberCount += 1;
    }

    if (isGratefulDeadArtist(artistName)) {
      showCount += await seedGratefulDeadShows(artistNode.id);
    } else {
      showCount += await seedConcertsForArtist(artistNode.id, artistName);
    }

    artistNodeIdByName.set(key, artistNode.id);
    return artistNode.id;
  }

  for (const row of records) {
    const artistNodeId = await ensureArtistNode(row.artist);

    const albumNode = await upsertNode({
      node_type: 'album',
      external_id: albumExternalId(row.musicbrainz_id, row.id),
      label: row.album,
      source: 'records',
      metadata_json: {
        recordId: row.id,
        userId: row.user_id,
        artistName: row.artist,
        year: row.year,
        genre: row.genre,
        label: row.label,
        coverUrl: row.cover_url,
        rating: row.rating,
        storageZone: row.storage_zone,
        storageSlot: row.storage_slot,
        musicbrainzId: row.musicbrainz_id || null
      }
    });

    await upsertEdge({
      from_node_id: artistNodeId,
      to_node_id: albumNode.id,
      edge_type: 'HAS_ALBUM',
      confidence: 1.0,
      source: 'records',
      metadata_json: { recordId: row.id }
    });

    albumCount += 1;
  }

  const totals = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM music_graph_nodes) AS node_count,
      (SELECT COUNT(*)::int FROM music_graph_edges) AS edge_count
  `);

  return {
    skipped: false,
    userId,
    recordsProcessed: records.length,
    albums: albumCount,
    members: memberCount,
    shows: showCount,
    artists: artistNodeIdByName.size,
    nodeCount: totals.rows[0]?.node_count || 0,
    edgeCount: totals.rows[0]?.edge_count || 0
  };
}

export async function getCollectionGraph(userId, depth = DEFAULT_MAX_DEPTH) {
  await ensureMusicGraphReady();
  const pool = ensurePool();
  const scopedUserId = userId != null ? String(userId).trim() : null;

  await seedCollectionGraph({ userId: scopedUserId, force: false });

  const params = [];
  let where = `node_type = 'album' AND metadata_json ? 'recordId'`;
  if (scopedUserId) {
    params.push(scopedUserId);
    where += ` AND metadata_json->>'userId' = $1`;
  }

  const { rows: albumNodes } = await pool.query(
    `SELECT id FROM music_graph_nodes WHERE ${where} ORDER BY id`,
    params
  );

  if (!albumNodes.length) {
    return {
      userId: scopedUserId,
      depth: clampDepth(depth),
      nodes: [],
      edges: [],
      albumCount: 0
    };
  }

  const mergedNodeIds = new Set();
  const mergedEdgeIds = new Set();
  const mergedNodes = [];
  const mergedEdges = [];

  for (const album of albumNodes) {
    const subgraph = await buildGraphPayload(album.id, depth);
    for (const node of subgraph.nodes) {
      if (!mergedNodeIds.has(node.id)) {
        mergedNodeIds.add(node.id);
        mergedNodes.push(node);
      }
    }
    for (const edge of subgraph.edges) {
      if (!mergedEdgeIds.has(edge.id)) {
        mergedEdgeIds.add(edge.id);
        mergedEdges.push(edge);
      }
    }
  }

  mergedNodes.sort((a, b) => a.id - b.id);
  mergedEdges.sort((a, b) => a.id - b.id);

  return {
    userId: scopedUserId,
    depth: clampDepth(depth),
    albumCount: albumNodes.length,
    nodes: mergedNodes,
    edges: mergedEdges
  };
}

export async function ensureMusicGraphReady() {
  if (!graphReadyPromise) {
    graphReadyPromise = initMusicGraphSchema().catch((err) => {
      graphReadyPromise = null;
      throw err;
    });
  }
  return graphReadyPromise;
}

export default {
  ensureMusicGraphReady,
  initMusicGraphSchema,
  upsertNode,
  upsertEdge,
  getMusicGraph,
  summarizeMusicGraph,
  findArtistNode,
  seedCollectionGraph,
  getCollectionGraph
};
