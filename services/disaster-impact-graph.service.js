/**
 * Development work by David Lane
 */
import { getPool } from './database.service.js';
import { DISASTER_ROLLING_WINDOW_DAYS } from './disasters.service.js';

const VALID_NODE_TYPES = new Set([
  'disaster_event',
  'fema_declaration',
  'nws_alert',
  'nasa_fire',
  'county',
  'state',
  'zip',
  'loan',
  'borrower',
  'processor',
  'milestone'
]);

const VALID_EDGE_TYPES = new Set([
  'AFFECTS',
  'CONTAINS',
  'LOCATED_IN',
  'HAS_ALERT',
  'HAS_DECLARATION',
  'NEAR',
  'ASSIGNED_TO',
  'CURRENTLY_IN',
  'HAS_RISK',
  'REQUIRES_REVIEW'
]);

const DEFAULT_SOURCE = 'disaster-impact-graph';
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
  if (!Number.isFinite(parsed)) {
    throw new Error('confidence must be a number between 0 and 1');
  }
  if (parsed < 0 || parsed > 1) {
    throw new Error('confidence must be between 0 and 1');
  }
  return parsed;
}

function ensurePool() {
  const pool = getPool();
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

export async function initDisasterImpactGraphSchema() {
  const pool = ensurePool();

  const tableSql = `
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id BIGSERIAL PRIMARY KEY,
      node_type TEXT NOT NULL,
      external_id TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '${DEFAULT_SOURCE}',
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_graph_nodes_type CHECK (node_type IN (
        'disaster_event',
        'fema_declaration',
        'nws_alert',
        'nasa_fire',
        'county',
        'state',
        'zip',
        'loan',
        'borrower',
        'processor',
        'milestone'
      )),
      CONSTRAINT uq_graph_nodes UNIQUE (node_type, external_id, source)
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id BIGSERIAL PRIMARY KEY,
      from_node_id BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      to_node_id BIGINT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
      edge_type TEXT NOT NULL,
      confidence NUMERIC(5,4) NOT NULL DEFAULT 0.8000,
      source TEXT NOT NULL DEFAULT '${DEFAULT_SOURCE}',
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_graph_edges_type CHECK (edge_type IN (
        'AFFECTS',
        'CONTAINS',
        'LOCATED_IN',
        'HAS_ALERT',
        'HAS_DECLARATION',
        'NEAR',
        'ASSIGNED_TO',
        'CURRENTLY_IN',
        'HAS_RISK',
        'REQUIRES_REVIEW'
      )),
      CONSTRAINT chk_graph_edges_confidence CHECK (confidence >= 0 AND confidence <= 1),
      CONSTRAINT uq_graph_edges UNIQUE (from_node_id, to_node_id, edge_type, source)
    );

    CREATE INDEX IF NOT EXISTS idx_graph_nodes_type_external ON graph_nodes(node_type, external_id);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_metadata ON graph_nodes USING GIN (metadata_json);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_node_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges(to_node_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON graph_edges(edge_type);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_metadata ON graph_edges USING GIN (metadata_json);
  `;

  await pool.query(tableSql);
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

  const query = `
    INSERT INTO graph_nodes (node_type, external_id, label, source, metadata_json, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
    ON CONFLICT (node_type, external_id, source)
    DO UPDATE SET
      label = EXCLUDED.label,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = NOW()
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [nodeType, externalId, label, source, JSON.stringify(metadata)]);
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

  const query = `
    INSERT INTO graph_edges (from_node_id, to_node_id, edge_type, confidence, source, metadata_json)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (from_node_id, to_node_id, edge_type, source)
    DO UPDATE SET
      confidence = EXCLUDED.confidence,
      metadata_json = EXCLUDED.metadata_json
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [
    fromNodeId,
    toNodeId,
    edgeType,
    confidence,
    source,
    JSON.stringify(metadata)
  ]);
  return rows[0];
}

async function getTraversalRows(startNodeId, depth = DEFAULT_MAX_DEPTH) {
  const pool = ensurePool();
  const maxDepth = clampDepth(depth);

  const traversalSql = `
    WITH RECURSIVE walk AS (
      SELECT
        n.id AS node_id,
        n.id AS start_node_id,
        0::int AS depth,
        ARRAY[n.id]::bigint[] AS node_path,
        ARRAY[]::bigint[] AS edge_path,
        NULL::bigint AS via_edge_id
      FROM graph_nodes n
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
      JOIN graph_edges e ON (e.from_node_id = w.node_id OR e.to_node_id = w.node_id)
      WHERE w.depth < $2
        AND NOT (
          CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END = ANY(w.node_path)
        )
    )
    SELECT * FROM walk;
  `;
  const { rows } = await pool.query(traversalSql, [Number(startNodeId), maxDepth]);
  return rows;
}

export async function getImpactGraph(startNodeId, depth = DEFAULT_MAX_DEPTH) {
  await ensureDisasterImpactGraphReady();
  const pool = ensurePool();
  const traversalRows = await getTraversalRows(startNodeId, depth);

  if (!traversalRows.length) {
    throw new Error(`Start node not found: ${startNodeId}`);
  }

  const nodeIds = [...new Set(traversalRows.map(row => Number(row.node_id)).filter(Number.isFinite))];
  const edgeIds = [...new Set(traversalRows.flatMap(row => row.edge_path || []).map(Number).filter(Number.isFinite))];

  const nodes = nodeIds.length
    ? (await pool.query(`SELECT * FROM graph_nodes WHERE id = ANY($1::bigint[]) ORDER BY id`, [nodeIds])).rows
    : [];

  const edges = edgeIds.length
    ? (await pool.query(`SELECT * FROM graph_edges WHERE id = ANY($1::bigint[]) ORDER BY id`, [edgeIds])).rows
    : [];

  return {
    startNodeId: Number(startNodeId),
    depth: clampDepth(depth),
    nodes,
    edges,
    paths: traversalRows
      .filter(row => Number(row.depth) > 0)
      .map(row => ({
        nodeId: Number(row.node_id),
        depth: Number(row.depth),
        nodePath: row.node_path || [],
        edgePath: row.edge_path || []
      }))
  };
}

async function findImpactedLoansFromNode(startNodeId, depth = DEFAULT_MAX_DEPTH) {
  const pool = ensurePool();
  const maxDepth = clampDepth(depth);

  const query = `
    WITH RECURSIVE walk AS (
      SELECT n.id AS node_id, 0::int AS depth, ARRAY[n.id]::bigint[] AS node_path
      FROM graph_nodes n
      WHERE n.id = $1
      UNION ALL
      SELECT
        CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END AS node_id,
        w.depth + 1 AS depth,
        w.node_path || CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END
      FROM walk w
      JOIN graph_edges e ON (e.from_node_id = w.node_id OR e.to_node_id = w.node_id)
      WHERE w.depth < $2
        AND NOT (
          CASE WHEN e.from_node_id = w.node_id THEN e.to_node_id ELSE e.from_node_id END = ANY(w.node_path)
        )
    )
    SELECT DISTINCT
      gn.id AS node_id,
      gn.external_id AS loan_external_id,
      gn.label AS loan_label,
      MIN(w.depth) AS depth
    FROM walk w
    JOIN graph_nodes gn ON gn.id = w.node_id
    WHERE gn.node_type = 'loan'
    GROUP BY gn.id, gn.external_id, gn.label
    ORDER BY depth ASC, gn.label ASC;
  `;

  const { rows } = await pool.query(query, [Number(startNodeId), maxDepth]);
  return rows;
}

async function attachLoanDetails(impactedLoanRows) {
  if (!impactedLoanRows.length) return [];
  const pool = ensurePool();
  const externalIds = impactedLoanRows.map(row => String(row.loan_external_id || ''));
  const query = `
    SELECT
      l.id,
      l.loan_number,
      l.borrower_name,
      l.county,
      l.state,
      l.zip_code,
      l.milestone,
      l.disaster_risk_score
    FROM loans l
    WHERE l.loan_number = ANY($1::text[])
       OR l.id::text = ANY($1::text[]);
  `;
  const { rows } = await pool.query(query, [externalIds]);
  const byLoanKey = new Map();
  for (const row of rows) {
    byLoanKey.set(String(row.loan_number), row);
    byLoanKey.set(String(row.id), row);
  }
  return impactedLoanRows.map(item => ({
    ...item,
    loanDetails: byLoanKey.get(String(item.loan_external_id)) || null
  }));
}

export async function findLoansImpactedByCounty(countyFips) {
  await ensureDisasterImpactGraphReady();
  const pool = ensurePool();
  const countyExternalId = String(countyFips || '').trim();
  if (!countyExternalId) throw new Error('countyFips is required');

  const countyNode = await pool.query(
    `SELECT * FROM graph_nodes WHERE node_type = 'county' AND external_id = $1 ORDER BY id LIMIT 1`,
    [countyExternalId]
  );
  if (!countyNode.rows.length) {
    return { countyFips: countyExternalId, loans: [] };
  }

  const impactedLoans = await findImpactedLoansFromNode(countyNode.rows[0].id, DEFAULT_MAX_DEPTH + 2);
  const loans = await attachLoanDetails(impactedLoans);
  return { countyFips: countyExternalId, startNodeId: countyNode.rows[0].id, loans };
}

export async function findLoansImpactedByDisaster(disasterId) {
  await ensureDisasterImpactGraphReady();
  const pool = ensurePool();
  const externalId = String(disasterId || '').trim();
  if (!externalId) throw new Error('disasterId is required');

  const disasterNode = await pool.query(
    `SELECT * FROM graph_nodes WHERE node_type = 'disaster_event' AND external_id = $1 ORDER BY id LIMIT 1`,
    [externalId]
  );
  if (!disasterNode.rows.length) {
    return { disasterId: externalId, loans: [] };
  }

  const impactedLoans = await findImpactedLoansFromNode(disasterNode.rows[0].id, DEFAULT_MAX_DEPTH + 3);
  const loans = await attachLoanDetails(impactedLoans);
  return { disasterId: externalId, startNodeId: disasterNode.rows[0].id, loans };
}

export async function calculateRiskPath(startNodeId) {
  await ensureDisasterImpactGraphReady();
  const pool = ensurePool();

  const query = `
    WITH RECURSIVE risk_walk AS (
      SELECT
        n.id AS node_id,
        n.id AS start_node_id,
        0::int AS depth,
        1.0::numeric AS path_confidence,
        ARRAY[n.id]::bigint[] AS node_path,
        ARRAY[]::bigint[] AS edge_path
      FROM graph_nodes n
      WHERE n.id = $1

      UNION ALL

      SELECT
        CASE WHEN e.from_node_id = rw.node_id THEN e.to_node_id ELSE e.from_node_id END AS node_id,
        rw.start_node_id,
        rw.depth + 1 AS depth,
        (rw.path_confidence * COALESCE(NULLIF(e.confidence, 0), 0.5))::numeric AS path_confidence,
        rw.node_path || CASE WHEN e.from_node_id = rw.node_id THEN e.to_node_id ELSE e.from_node_id END,
        rw.edge_path || e.id
      FROM risk_walk rw
      JOIN graph_edges e ON (e.from_node_id = rw.node_id OR e.to_node_id = rw.node_id)
      WHERE rw.depth < 5
        AND NOT (
          CASE WHEN e.from_node_id = rw.node_id THEN e.to_node_id ELSE e.from_node_id END = ANY(rw.node_path)
        )
    )
    SELECT
      rw.node_id,
      rw.depth,
      rw.path_confidence,
      rw.node_path,
      rw.edge_path,
      gn.node_type,
      gn.label
    FROM risk_walk rw
    JOIN graph_nodes gn ON gn.id = rw.node_id
    WHERE rw.depth > 0
    ORDER BY rw.path_confidence DESC, rw.depth ASC
    LIMIT 50;
  `;

  const { rows } = await pool.query(query, [Number(startNodeId)]);
  return rows;
}

export async function summarizeImpact(startNodeId) {
  const graph = await getImpactGraph(startNodeId, DEFAULT_MAX_DEPTH + 1);
  const riskPaths = await calculateRiskPath(startNodeId);

  const nodeTypeCounts = graph.nodes.reduce((acc, node) => {
    acc[node.node_type] = (acc[node.node_type] || 0) + 1;
    return acc;
  }, {});

  const edgeTypeCounts = graph.edges.reduce((acc, edge) => {
    acc[edge.edge_type] = (acc[edge.edge_type] || 0) + 1;
    return acc;
  }, {});

  const impactedLoans = graph.nodes.filter(node => node.node_type === 'loan');
  const highestRiskPath = riskPaths.length ? riskPaths[0] : null;

  return {
    startNodeId: Number(startNodeId),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    impactedLoanCount: impactedLoans.length,
    nodeTypeCounts,
    edgeTypeCounts,
    highestRiskPath,
    riskPaths: riskPaths.slice(0, 10)
  };
}

export async function seedGraphFromExistingDisasterData(options = {}) {
  const pool = ensurePool();
  await initDisasterImpactGraphSchema();
  const force = options.force === true;

  if (!force) {
    const existing = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM graph_nodes) AS node_count,
        (SELECT COUNT(*)::int FROM graph_edges) AS edge_count
    `);
    const nodeCount = existing.rows[0]?.node_count || 0;
    const edgeCount = existing.rows[0]?.edge_count || 0;
    if (nodeCount > 0 && edgeCount > 0) {
      return {
        skipped: true,
        reason: 'Graph already seeded',
        existing: { nodeCount, edgeCount }
      };
    }
  }

  // TODO: Reconcile this reseed pass with scripts/refresh-disasters.js so graph refresh can follow disaster source syncs.
  // TODO: Plug FEMA declaration-specific linking from services/disasters.service.js ingestion payloads.
  // TODO: Plug NASA FIRMS / NWS alert linking into nasa_fire and nws_alert nodes once source-specific adapters are added.
  // TODO: Plug production Encompass loan ownership/assignment details instead of fallback processor labels.

  const disastersQuery = `
    SELECT
      id,
      source,
      event_type,
      source_id,
      county_fips,
      county_name,
      state_abbr,
      title,
      start_time
    FROM disasters
    WHERE start_time >= NOW() - INTERVAL '${DISASTER_ROLLING_WINDOW_DAYS} days'
      AND event_type <> 'camera'
    ORDER BY start_time DESC
    LIMIT 400;
  `;
  const loansQuery = `
    SELECT
      id,
      loan_number,
      borrower_name,
      county,
      state,
      zip_code,
      milestone,
      disaster_risk_score,
      fema_data
    FROM loans
    ORDER BY id DESC
    LIMIT 400;
  `;

  const [disastersResult, loansResult] = await Promise.all([
    pool.query(disastersQuery),
    pool.query(loansQuery)
  ]);

  const countyNodeByFips = new Map();
  const disasterNodeByKey = new Map();
  const disasterNodeIdsByCountyFips = new Map();
  const zipNodeByCode = new Map();
  const milestoneNodeByName = new Map();
  const processorNodeByName = new Map();
  const loanNodeByLoanNumber = new Map();

  let edgeCount = 0;

  for (const row of disastersResult.rows) {
    const countyFips = String(row.county_fips || '').trim();
    const countyLabel = row.county_name ? `${row.county_name}, ${row.state_abbr || ''}`.trim() : countyFips;
    if (!countyFips || countyFips === '00000') continue;

    let countyNodeId = countyNodeByFips.get(countyFips);
    if (!countyNodeId) {
      const countyNode = await upsertNode({
        node_type: 'county',
        external_id: countyFips,
        label: countyLabel || `County ${countyFips}`,
        source: 'disasters',
        metadata_json: {
          county_name: row.county_name || null,
          state_abbr: row.state_abbr || null
        }
      });
      countyNodeId = countyNode.id;
      countyNodeByFips.set(countyFips, countyNodeId);
    }

    const disasterExternalId = String(row.source_id || row.id);
    let disasterNodeId = disasterNodeByKey.get(disasterExternalId);
    if (!disasterNodeId) {
      const disasterNode = await upsertNode({
        node_type: 'disaster_event',
        external_id: disasterExternalId,
        label: row.title || `${row.event_type} (${row.source})`,
        source: row.source || 'disasters',
        metadata_json: {
          event_type: row.event_type,
          county_fips: countyFips,
          started_at: row.start_time
        }
      });
      disasterNodeId = disasterNode.id;
      disasterNodeByKey.set(disasterExternalId, disasterNodeId);
    }
    if (!disasterNodeIdsByCountyFips.has(countyFips)) {
      disasterNodeIdsByCountyFips.set(countyFips, []);
    }
    disasterNodeIdsByCountyFips.get(countyFips).push(disasterNodeId);

    await upsertEdge({
      from_node_id: countyNodeId,
      to_node_id: disasterNodeId,
      edge_type: 'HAS_DECLARATION',
      confidence: 0.9,
      source: 'disasters-seed',
      metadata_json: { source: row.source }
    });
    edgeCount += 1;
  }

  for (const loan of loansResult.rows) {
    const loanExternalId = String(loan.loan_number || loan.id);
    const countyFips = String(loan.fema_data?.county_fips || '').trim();
    const zipCode = String(loan.zip_code || '').trim();
    const milestoneLabel = String(loan.milestone || 'Unknown Milestone').trim();
    const processorLabel = String(loan.fema_data?.processor_name || 'Unassigned Processor').trim();

    let loanNodeId = loanNodeByLoanNumber.get(loanExternalId);
    if (!loanNodeId) {
      const loanNode = await upsertNode({
        node_type: 'loan',
        external_id: loanExternalId,
        label: loan.borrower_name ? `${loan.borrower_name} (${loanExternalId})` : `Loan ${loanExternalId}`,
        source: 'loan-pipeline',
        metadata_json: {
          loan_id: loan.id,
          county: loan.county,
          state: loan.state,
          zip_code: zipCode,
          disaster_risk_score: loan.disaster_risk_score
        }
      });
      loanNodeId = loanNode.id;
      loanNodeByLoanNumber.set(loanExternalId, loanNodeId);
    }

    if (zipCode) {
      let zipNodeId = zipNodeByCode.get(zipCode);
      if (!zipNodeId) {
        const zipNode = await upsertNode({
          node_type: 'zip',
          external_id: zipCode,
          label: `ZIP ${zipCode}`,
          source: 'loan-pipeline',
          metadata_json: { state: loan.state || null }
        });
        zipNodeId = zipNode.id;
        zipNodeByCode.set(zipCode, zipNodeId);
      }

      await upsertEdge({
        from_node_id: zipNodeId,
        to_node_id: loanNodeId,
        edge_type: 'CONTAINS',
        confidence: 0.92,
        source: 'loan-seed',
        metadata_json: {}
      });
      edgeCount += 1;

      if (countyFips && countyNodeByFips.has(countyFips)) {
        await upsertEdge({
          from_node_id: countyNodeByFips.get(countyFips),
          to_node_id: zipNodeId,
          edge_type: 'CONTAINS',
          confidence: 0.95,
          source: 'loan-seed',
          metadata_json: {}
        });
        edgeCount += 1;
      }

      const disasterNodeIds = disasterNodeIdsByCountyFips.get(countyFips) || [];
      for (const disasterNodeId of disasterNodeIds.slice(0, 8)) {
        await upsertEdge({
          from_node_id: disasterNodeId,
          to_node_id: zipNodeId,
          edge_type: 'AFFECTS',
          confidence: 0.7,
          source: 'disaster-zip-link',
          metadata_json: { county_fips: countyFips }
        });
        edgeCount += 1;
      }
    }

    let milestoneNodeId = milestoneNodeByName.get(milestoneLabel);
    if (!milestoneNodeId) {
      const milestoneNode = await upsertNode({
        node_type: 'milestone',
        external_id: milestoneLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: milestoneLabel,
        source: 'loan-pipeline',
        metadata_json: {}
      });
      milestoneNodeId = milestoneNode.id;
      milestoneNodeByName.set(milestoneLabel, milestoneNodeId);
    }

    await upsertEdge({
      from_node_id: loanNodeId,
      to_node_id: milestoneNodeId,
      edge_type: 'CURRENTLY_IN',
      confidence: 0.97,
      source: 'loan-seed',
      metadata_json: {}
    });
    edgeCount += 1;

    let processorNodeId = processorNodeByName.get(processorLabel);
    if (!processorNodeId) {
      const processorNode = await upsertNode({
        node_type: 'processor',
        external_id: processorLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: processorLabel,
        source: 'loan-pipeline',
        metadata_json: {}
      });
      processorNodeId = processorNode.id;
      processorNodeByName.set(processorLabel, processorNodeId);
    }

    await upsertEdge({
      from_node_id: milestoneNodeId,
      to_node_id: processorNodeId,
      edge_type: 'ASSIGNED_TO',
      confidence: 0.75,
      source: 'loan-seed',
      metadata_json: {}
    });
    edgeCount += 1;
  }

  const countyToDisasterRows = await pool.query(`
    SELECT
      gn_county.id AS county_node_id,
      gn_disaster.id AS disaster_node_id
    FROM graph_nodes gn_county
    JOIN graph_nodes gn_disaster
      ON gn_disaster.node_type = 'disaster_event'
     AND gn_disaster.metadata_json->>'county_fips' = gn_county.external_id
    WHERE gn_county.node_type = 'county';
  `);

  for (const pair of countyToDisasterRows.rows) {
    await upsertEdge({
      from_node_id: pair.county_node_id,
      to_node_id: pair.disaster_node_id,
      edge_type: 'AFFECTS',
      confidence: 0.85,
      source: 'disaster-county-link',
      metadata_json: {}
    });
    edgeCount += 1;
  }

  return {
    nodes: {
      counties: countyNodeByFips.size,
      disasters: disasterNodeByKey.size,
      zips: zipNodeByCode.size,
      loans: loanNodeByLoanNumber.size,
      milestones: milestoneNodeByName.size,
      processors: processorNodeByName.size
    },
    edgesSeeded: edgeCount
  };
}

export async function refreshDisasterImpactGraphFromCurrentData() {
  const pool = ensurePool();
  await initDisasterImpactGraphSchema();
  await pool.query('BEGIN');
  try {
    await pool.query('TRUNCATE TABLE graph_edges RESTART IDENTITY');
    await pool.query('TRUNCATE TABLE graph_nodes RESTART IDENTITY CASCADE');
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    throw err;
  }

  const seeded = await seedGraphFromExistingDisasterData({ force: true });
  graphReadyPromise = Promise.resolve();
  return {
    refreshed: true,
    seeded
  };
}

export async function ensureDisasterImpactGraphReady() {
  if (!graphReadyPromise) {
    graphReadyPromise = (async () => {
      await initDisasterImpactGraphSchema();
      try {
        await seedGraphFromExistingDisasterData();
      } catch (seedErr) {
        console.warn(`⚠️ Disaster impact graph seed skipped: ${seedErr.message}`);
      }
    })();
  }
  return graphReadyPromise;
}

export default {
  ensureDisasterImpactGraphReady,
  initDisasterImpactGraphSchema,
  seedGraphFromExistingDisasterData,
  refreshDisasterImpactGraphFromCurrentData,
  upsertNode,
  upsertEdge,
  getImpactGraph,
  findLoansImpactedByCounty,
  findLoansImpactedByDisaster,
  calculateRiskPath,
  summarizeImpact
};
